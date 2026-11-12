'use client';

import React, {useRef} from 'react';
import {
  SceneItem,
  SubtitleSegment,
  TRANSITION_OPTIONS,
  formatDisplayTimecode,
} from '@/lib/video-engine';
import {Music, Image as ImageIcon, Subtitles, Sparkles} from 'lucide-react';

interface StudioTimelineProps {
  duration: number;
  currentTime: number;
  scenes: SceneItem[];
  subtitles: SubtitleSegment[];
  waveform: number[];
  selectedSceneId: string | null;
  onSeek: (timeSec: number) => void;
  onSelectScene: (sceneId: string) => void;
  onAutoSyncAll: () => void;
}

export default function StudioTimeline({
  duration,
  currentTime,
  scenes,
  subtitles,
  waveform,
  selectedSceneId,
  onSeek,
  onSelectScene,
  onAutoSyncAll,
}: StudioTimelineProps) {
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const safeDuration = Math.max(1, duration);
  const playheadPercent = Math.min(
    100,
    Math.max(0, (currentTime / safeDuration) * 100)
  );

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackContainerRef.current) return;
    const rect = trackContainerRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetTime = (clickX / rect.width) * safeDuration;
    onSeek(Number(targetTime.toFixed(2)));
  };

  // Generate ruler ticks every ~4 seconds
  const tickCount = 6;
  const ticks = Array.from({length: tickCount + 1}, (_, i) =>
    Number(((i / tickCount) * safeDuration).toFixed(1))
  );

  return (
    <section
      aria-label="Dòng thời gian đa tầng"
      className="border-t border-line bg-surface/95 px-6 py-4 select-none"
    >
      {/* Timeline Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="font-semibold text-ink">
            Dòng thời gian đồng bộ (Multi-Track Timeline)
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-gold">
            {formatDisplayTimecode(currentTime)} /{' '}
            {formatDisplayTimecode(safeDuration)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {scenes.length} phân cảnh
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {subtitles.length} câu phụ đề
          </span>
        </div>

        <button
          type="button"
          onClick={onAutoSyncAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink bg-surface-2 hover:bg-surface-3 border border-line-strong rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          Tự động khớp lại Nhạc, Ảnh & Phụ đề
        </button>
      </div>

      {/* Tracks Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[195px_1fr] gap-3 items-stretch pb-2">
        {/* Track Labels */}
        <div className="hidden lg:flex flex-col justify-between py-6 pl-3 pr-2 text-xs text-muted space-y-2">
          <div className="h-14 flex items-center gap-2 font-medium text-muted">
            <ImageIcon className="w-3.5 h-3.5 text-gold shrink-0" />
            <span>Lớp hình ảnh & Cảnh</span>
          </div>
          <div className="h-10 flex items-center gap-2 font-medium text-muted">
            <Subtitles className="w-3.5 h-3.5 text-sage shrink-0" />
            <span>Lớp phụ đề (SRT)</span>
          </div>
          <div className="h-10 flex items-center gap-2 font-medium text-muted">
            <Music className="w-3.5 h-3.5 text-ok shrink-0" />
            <span>Sóng âm thanh MP3</span>
          </div>
        </div>

        {/* Interactive Timeline Scrub Area */}
        <div
          ref={trackContainerRef}
          onClick={handleTrackClick}
          data-testid="timeline-scrubber"
          className="relative bg-canvas border border-line rounded-lg p-3 cursor-pointer overflow-hidden"
        >
          {/* Timecode Ruler */}
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-faint pb-2 mb-2 border-b border-line/80">
            {ticks.map((t, idx) => (
              <span key={idx}>{formatDisplayTimecode(t)}</span>
            ))}
          </div>

          <div className="space-y-2.5">
            {/* Track 1: Visual Scenes */}
            <div className="relative h-14 bg-surface/80 rounded border border-line/90 overflow-hidden flex">
              {scenes.map((scene, idx) => {
                const widthPct =
                  ((scene.endTime - scene.startTime) / safeDuration) * 100;
                const isSelected = scene.id === selectedSceneId;
                const fullLabel =
                  TRANSITION_OPTIONS.find((t) => t.id === scene.transition)
                    ?.label || scene.transition;
                const matchParen = fullLabel.match(/\(([^)]+)\)/);
                const transLabel = matchParen
                  ? matchParen[1].split(' ').pop()
                  : fullLabel;

                return (
                  <div
                    key={scene.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectScene(scene.id);
                      onSeek(Number((scene.startTime + 0.05).toFixed(2)));
                    }}
                    style={{width: `${Math.max(4, widthPct)}%`}}
                    className={`relative h-full border-r border-line group overflow-hidden transition-colors ${
                      isSelected
                        ? 'ring-1 ring-inset ring-gold bg-surface-2/90'
                        : 'hover:bg-surface-2/60'
                    }`}
                  >
                    <img
                      src={scene.imageUrl}
                      alt={scene.title}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover:opacity-60 transition-opacity"
                    />
                    <div className="relative z-10 p-1.5 flex flex-col justify-between h-full bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent">
                      <div className="flex items-center justify-between gap-1 text-[10px] text-muted font-mono tabular-nums">
                        <span className="truncate font-sans font-medium text-ink">
                          Cảnh {idx + 1}: {scene.title}
                        </span>
                        <span className="shrink-0 text-gold-soft/90">
                          {transLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted truncate">
                        {scene.source === 'library'
                          ? `Thư viện · Khớp: ${scene.matchedKeyword || 'Tự động'}`
                          : 'Ảnh tải lên'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Track 2: Subtitles */}
            <div className="relative h-10 bg-surface/80 rounded border border-line/90 overflow-hidden">
              {subtitles.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-faint">
                  Chưa có phụ đề — Nhấn &ldquo;Tự động tạo phụ đề từ giọng nói&rdquo; để nhận diện âm thanh
                </div>
              ) : (
                subtitles.map((sub) => {
                  const leftPct = (sub.startTime / safeDuration) * 100;
                  const widthPct =
                    ((sub.endTime - sub.startTime) / safeDuration) * 100;
                  const isActive =
                    currentTime >= sub.startTime && currentTime <= sub.endTime;
                  return (
                    <div
                      key={sub.id}
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(2, widthPct)}%`,
                      }}
                      className={`absolute top-1 bottom-1 px-2 rounded border text-[11px] flex items-center truncate transition-colors ${
                        isActive
                          ? 'bg-sky-500/25 border-sage text-sky-100 font-medium'
                          : 'bg-surface-2/90 border-line-strong text-muted'
                      }`}
                      title={sub.text}
                    >
                      <span className="truncate">{sub.text}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Track 3: Audio Waveform */}
            <div className="relative h-10 bg-surface/80 rounded border border-line/90 px-2 flex items-center gap-[2px]">
              {waveform.map((val, idx) => {
                const barProgress = idx / waveform.length;
                const isPlayed = barProgress <= currentTime / safeDuration;
                return (
                  <div
                    key={idx}
                    style={{height: `${Math.max(18, Math.round(val * 85))}%`}}
                    className={`flex-1 rounded-xs transition-colors ${
                      isPlayed ? 'bg-ok' : 'bg-surface-3'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Playhead Vertical Line */}
          <div
            style={{left: `${playheadPercent}%`}}
            className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-gold z-20"
          >
            <div className="w-3 h-3 -ml-[5px] bg-gold rotate-45 rounded-xs" />
          </div>
        </div>
      </div>
    </section>
  );
}
