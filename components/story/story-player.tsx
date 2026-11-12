'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ChapterCard,
  ExportConfig,
  SceneItem,
  SubtitleSegment,
  SubtitleStyleConfig,
  VisualEffectPreset,
} from '@/lib/video-engine';
import {drawVideoFrame} from '@/lib/canvas-renderer';
import {NarrationTimeline} from '@/lib/narration-timeline';
import {formatClock} from '@/lib/audio-utils';
import type {NarrationMarkers} from '@/lib/story-pipeline';
import {cn} from '@/lib/utils';

const SVG_SIZES: Record<ExportConfig['aspectRatio'], {width: number; height: number}> = {
  '16:9': {width: 1280, height: 720},
  '9:16': {width: 720, height: 1280},
  '1:1': {width: 900, height: 900},
};

/** Phát trước bao nhiêu giây âm thanh được lên lịch để không giữ 90 phút trong bộ nhớ. */
const SCHEDULE_AHEAD_SEC = 40;

export default function StoryPlayer({
  timeline,
  scenes,
  subtitles,
  chapterCards,
  markers,
  imageCache,
  imageVersion,
  visualEffect,
  subtitleStyle,
  transitionDuration,
  aspectRatio,
}: {
  timeline: NarrationTimeline;
  scenes: SceneItem[];
  subtitles: SubtitleSegment[];
  chapterCards: ChapterCard[];
  markers: NarrationMarkers[];
  imageCache: Map<string, HTMLImageElement>;
  imageVersion: number;
  visualEffect: VisualEffectPreset;
  subtitleStyle: SubtitleStyleConfig;
  transitionDuration: number;
  aspectRatio: ExportConfig['aspectRatio'];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioBufferSourceNode[]>([]);
  const startRef = useRef({ctxTime: 0, offset: 0});
  const pointerRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const lastUiTickRef = useRef(0);

  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const duration = timeline.duration;
  const size = SVG_SIZES[aspectRatio];

  const drawAt = useCallback(
    (timeSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawVideoFrame(
        ctx,
        canvas.width,
        canvas.height,
        timeSec,
        scenes,
        subtitles,
        imageCache,
        visualEffect,
        subtitleStyle,
        transitionDuration,
        chapterCards
      );
    },
    [
      scenes,
      subtitles,
      imageCache,
      visualEffect,
      subtitleStyle,
      transitionDuration,
      chapterCards,
    ]
  );

  // Vẽ lại khi trạng thái thay đổi (kể cả ảnh vừa nạp xong).
  useEffect(() => {
    drawAt(timeRef.current);
  }, [drawAt, imageVersion, aspectRatio]);

  const stopNodes = useCallback(() => {
    nodesRef.current.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // node đã dừng
      }
    });
    nodesRef.current = [];
  }, []);

  const ensureContext = useCallback(() => {
    if (!contextRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext: typeof AudioContext})
          .webkitAudioContext;
      const ctx = new Ctor();
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : 1;
      gain.connect(ctx.destination);
      contextRef.current = ctx;
      gainRef.current = gain;
    }
    return contextRef.current;
  }, [muted]);

  const scheduleAhead = useCallback(
    (current: number) => {
      const ctx = contextRef.current;
      const gain = gainRef.current;
      if (!ctx || !gain) return;

      const horizon = current + SCHEDULE_AHEAD_SEC + 5;
      const {ctxTime, offset} = startRef.current;
      const clips = timeline.clips;

      while (pointerRef.current < clips.length) {
        const clip = clips[pointerRef.current];
        if (clip.startTime > horizon) break;

        const clipEnd = clip.startTime + clip.duration;
        const when = ctxTime + (clip.startTime - offset);
        const lateBy = ctx.currentTime - when;

        if (clipEnd > current && lateBy < clip.duration) {
          const node = ctx.createBufferSource();
          node.buffer = timeline.createBuffer(ctx, clip);
          node.connect(gain);
          const startOffset = Math.max(0, current - clip.startTime);
          node.start(Math.max(ctx.currentTime + 0.02, when), startOffset);
          nodesRef.current.push(node);
        }
        pointerRef.current += 1;
      }
    },
    [timeline]
  );

  const pause = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopNodes();
    setIsPlaying(false);
  }, [stopNodes]);

  const start = useCallback(
    (from: number) => {
      const ctx = ensureContext();
      void ctx.resume();

      pointerRef.current = Math.max(
        0,
        timeline.clips.findIndex(
          (clip) => clip.startTime + clip.duration > from
        )
      );
      startRef.current = {ctxTime: ctx.currentTime + 0.06, offset: from};
      setTime(from);
      timeRef.current = from;
      setIsPlaying(true);

      const tick = () => {
        const audioCtx = contextRef.current;
        if (!audioCtx) return;
        const {ctxTime, offset} = startRef.current;
        const current = offset + (audioCtx.currentTime - ctxTime);

        if (current >= duration) {
          timeRef.current = duration;
          setTime(duration);
          drawAt(duration);
          stopNodes();
          setIsPlaying(false);
          rafRef.current = null;
          return;
        }

        timeRef.current = current;
        drawAt(current);
        scheduleAhead(current);

        const now = performance.now();
        if (now - lastUiTickRef.current > 90) {
          lastUiTickRef.current = now;
          setTime(current);
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      scheduleAhead(from);
      rafRef.current = requestAnimationFrame(tick);
    },
    [drawAt, duration, ensureContext, scheduleAhead, stopNodes, timeline]
  );

  const seek = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(duration, target));
      const wasPlaying = isPlaying;
      pause();
      timeRef.current = clamped;
      setTime(clamped);
      drawAt(clamped);
      if (wasPlaying) start(clamped);
    },
    [drawAt, duration, isPlaying, pause, start]
  );

  const toggle = () => {
    if (isPlaying) pause();
    else start(timeRef.current >= duration - 0.15 ? 0 : timeRef.current);
  };

  const skip = (delta: number) => seek(timeRef.current + delta);

  const jumpToChapter = (startTime: number) => seek(startTime + 0.01);

  // Đổi cảnh báo/âm lượng
  useEffect(() => {
    if (gainRef.current && contextRef.current) {
      gainRef.current.gain.setTargetAtTime(
        muted ? 0 : 1,
        contextRef.current.currentTime,
        0.02
      );
    }
  }, [muted]);

  // Dọn dẹp khi unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      nodesRef.current.forEach((node) => {
        try {
          node.stop();
        } catch {
          // bỏ qua
        }
      });
      contextRef.current?.close().catch(() => undefined);
    };
  }, []);

  const currentChapter = useMemo(() => {
    const markersUpTo = markers.filter((marker) => marker.startTime <= time + 0.05);
    return markersUpTo[markersUpTo.length - 1] ?? markers[0] ?? null;
  }, [markers, time]);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-line bg-black shadow-[0_40px_90px_-50px_rgba(0,0,0,1)]',
          aspectRatio === '9:16' ? 'mx-auto max-w-[360px]' : 'w-full'
        )}
        style={{aspectRatio: aspectRatio.replace(':', '/')}}
      >
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          className="h-full w-full"
          aria-label="Khung hình xem trước video đọc truyện"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/85 backdrop-blur">
            {currentChapter ? `Chương ${currentChapter.chapterNumber}` : 'Xem trước'}
          </span>
          <span className="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 font-mono text-[10px] text-ink/85 backdrop-blur">
            {formatClock(time)} / {formatClock(duration)}
          </span>
        </div>

        {!isPlaying && time === 0 ? (
          <button
            type="button"
            onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/15"
            aria-label="Phát video xem trước"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-[#221704] shadow-[0_20px_50px_-16px_rgba(231,178,95,0.9)]">
              <Play className="ml-1 h-6 w-6 fill-current" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-[#221704] transition-colors hover:bg-gold-soft"
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" aria-hidden />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => skip(-10)}
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Lùi 10 giây"
          >
            <SkipBack className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => skip(10)}
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Tiến 10 giây"
          >
            <SkipForward className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="hidden font-mono text-[11px] text-faint sm:block">
            {formatClock(time)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.5}
            value={time}
            onChange={(event) => seek(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-gold"
            aria-label="Tua video"
          />
          <span className="hidden font-mono text-[11px] text-faint sm:block">
            {formatClock(duration)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          className="rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {markers.length > 1 ? (
        <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {markers.map((marker) => {
            const active = currentChapter?.chapterNumber === marker.chapterNumber;
            return (
              <button
                key={`${marker.chapterNumber}-${marker.startTime}`}
                type="button"
                onClick={() => jumpToChapter(marker.startTime)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10.5px] transition-colors',
                  active
                    ? 'border-gold/50 bg-gold/12 text-gold'
                    : 'border-line bg-surface-2/60 text-muted hover:border-line-strong hover:text-ink'
                )}
              >
                C.{marker.chapterNumber} · {formatClock(marker.startTime)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
