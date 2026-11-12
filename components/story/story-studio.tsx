'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, Film, Loader2, RefreshCw, Sparkles} from 'lucide-react';
import type {NovelDetail, NovelSummary} from '@/lib/truyenok';
import {
  BUILTIN_STOCK_LIBRARY,
  DEFAULT_DEMO_SUBTITLES_SRT,
  parseSrtOrTextToSubtitles,
  type ChapterCard,
} from '@/lib/video-engine';
import {
  buildChapterSrt,
  buildImagePool,
  buildStoryScenes,
  buildSubtitlesForChunk,
  chunkChapterText,
  formatDuration,
  layoutNarration,
  type ChapterNarration,
} from '@/lib/story-pipeline';
import {
  DEFAULT_STORY_CONFIG,
  getSubtitlePreset,
  type StoryConfig,
} from '@/lib/story-config';
import {NarrationTimeline} from '@/lib/narration-timeline';
import {audioBufferToInt16, decodeAudioPayload} from '@/lib/audio-utils';
import {preloadImages, proxyImageUrl} from '@/lib/image-loader';
import {
  exportLongformVideo,
  getRenderCapabilities,
  pickMp4Destination,
} from '@/lib/longform-renderer';
import {
  IDLE_BUILD,
  type BuildState,
  type ExportState,
  type StorySession,
} from '@/lib/story-session';
import {Badge, Button, Panel, ProgressBar, SectionLabel} from '@/components/ui/primitives';
import NovelLibrary from './novel-library';
import ChapterPicker from './chapter-picker';
import NarrationConfig from './narration-config';
import StoryPlayer from './story-player';
import RenderStage from './render-stage';
import {cn} from '@/lib/utils';

type Step = 'library' | 'chapters' | 'voice' | 'render';

const STEP_LABELS: {id: Step; label: string}[] = [
  {id: 'library', label: 'Thư viện'},
  {id: 'chapters', label: 'Chương'},
  {id: 'voice', label: 'Giọng đọc'},
  {id: 'render', label: 'Studio'},
];

const TTS_CONCURRENCY = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_TTS_CONCURRENCY);
  if (!Number.isFinite(raw) || raw < 1) return 3;
  return Math.min(6, Math.floor(raw));
})();

/** Chạy worker với giới hạn song song, giữ thứ tự kết quả. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({length: Math.min(limit, items.length)}, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      if (signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError');
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

async function requestNarration(
  text: string,
  voice: string,
  signal?: AbortSignal
): Promise<{audioBase64: string; mimeType: string}> {
  let lastError = 'Không tạo được giọng đọc.';

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('/api/narration', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text, voice}),
      signal,
    });

    if (response.ok) {
      return (await response.json()) as {audioBase64: string; mimeType: string};
    }

    const payload = (await response.json().catch(() => null)) as
      | {error?: string}
      | null;
    lastError = payload?.error || `Máy chủ trả về mã ${response.status}.`;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) throw new Error(lastError);

    await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
  }

  throw new Error(lastError);
}

export default function StoryStudio() {
  const [step, setStep] = useState<Step>('library');

  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [novelLoading, setNovelLoading] = useState(false);
  const [novelError, setNovelError] = useState<string | null>(null);

  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [config, setConfig] = useState<StoryConfig>(DEFAULT_STORY_CONFIG);

  const [session, setSession] = useState<StorySession | null>(null);
  const [build, setBuild] = useState<BuildState>(IDLE_BUILD);
  const [exportState, setExportState] = useState<ExportState>({
    status: 'idle',
    percent: 0,
    label: '',
  });
  const [imageVersion, setImageVersion] = useState(0);

  const buildAbortRef = useRef<AbortController | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const response = await fetch('/api/novels', {cache: 'no-store'});
      const payload = (await response.json()) as {
        novels?: NovelSummary[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Không tải được thư viện.');
      setNovels(payload.novels ?? []);
    } catch (error) {
      setLibraryError(
        error instanceof Error ? error.message : 'Không tải được thư viện truyện.'
      );
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const openNovel = useCallback(async (summary: NovelSummary) => {
    setNovelLoading(true);
    setNovelError(null);
    setNovel(null);
    setStep('chapters');
    try {
      const response = await fetch(`/api/novels/${encodeURIComponent(summary.id)}`);
      const payload = (await response.json()) as {
        novel?: NovelDetail;
        error?: string;
      };
      if (!response.ok || !payload.novel) {
        throw new Error(payload.error || 'Không tải được thông tin truyện.');
      }
      setNovel(payload.novel);
      setSelectedChapters(
        payload.novel.chapters.slice(0, 14).map((chapter) => chapter.chapterNumber)
      );
    } catch (error) {
      setNovelError(
        error instanceof Error ? error.message : 'Không tải được thông tin truyện.'
      );
    } finally {
      setNovelLoading(false);
    }
  }, []);

  const selectedChapterDetails = useMemo(
    () =>
      novel?.chapters.filter((chapter) =>
        selectedChapters.includes(chapter.chapterNumber)
      ) ?? [],
    [novel, selectedChapters]
  );

  const preset = getSubtitlePreset(config.preset);

  const preloadSessionImages = useCallback((poolUrls: string[]) => {
    preloadImages(
      [...poolUrls, ...BUILTIN_STOCK_LIBRARY.map((item) => item.url)],
      imageCacheRef.current,
      () => setImageVersion((version) => version + 1)
    );
  }, []);

  const startNarration = useCallback(async () => {
    if (!novel || selectedChapterDetails.length === 0) return;

    // Tạo AudioContext ngay trong lượt bấm để không bị chặn autoplay.
    const Ctor =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext})
        .webkitAudioContext;
    const audioContext = new Ctor();

    const controller = new AbortController();
    buildAbortRef.current = controller;
    setSession(null);
    setExportState({status: 'idle', percent: 0, label: ''});
    setBuild({
      ...IDLE_BUILD,
      status: 'running',
      phase: 'chapters',
      message: 'Đang tải nội dung chương…',
      chaptersTotal: selectedChapterDetails.length,
      startedAt: Date.now(),
    });

    try {
      const chapters = selectedChapterDetails;

      // 1. Tải nội dung và chia đoạn
      const contents = await mapWithConcurrency(
        chapters,
        4,
        async (chapter) => {
          const response = await fetch(
            `/api/novels/${encodeURIComponent(novel.id)}/chapters/${chapter.chapterNumber}`,
            {signal: controller.signal}
          );
          const payload = (await response.json().catch(() => null)) as
            | {chapter?: {content?: string}; error?: string}
            | null;
          if (!response.ok) {
            throw new Error(
              payload?.error || `Không tải được chương ${chapter.chapterNumber}.`
            );
          }
          const text = payload?.chapter?.content ?? '';
          const chunks = chunkChapterText(text);
          if (chunks.length === 0) {
            throw new Error(`Chương ${chapter.chapterNumber} không có nội dung.`);
          }
          return {
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            chunks,
          };
        },
        controller.signal
      );

      let offset = 0;
      const withOffsets = contents.map((chapter) => {
        const start = offset;
        offset += chapter.chunks.length;
        return {...chapter, start};
      });

      const totalChunks = offset;
      setBuild((previous) => ({
        ...previous,
        phase: 'narration',
        chaptersDone: 0,
        chunksTotal: totalChunks,
        message: `Đang tạo giọng đọc 0/${totalChunks}…`,
        startedAt: Date.now(),
      }));

      // 2. Tổng hợp giọng đọc song song có giới hạn
      const jobs = withOffsets.flatMap((chapter) =>
        chapter.chunks.map((text, chunkIndex) => ({
          text,
          chapterNumber: chapter.chapterNumber,
          globalIndex: chapter.start + chunkIndex,
          chapterIndex: withOffsets.findIndex(
            (item) => item.chapterNumber === chapter.chapterNumber
          ),
        }))
      );

      const audioByIndex: {pcm: Int16Array; sampleRate: number; duration: number}[] =
        new Array(jobs.length);

      let done = 0;
      const chaptersTouched = new Set<number>();

      await mapWithConcurrency(
        jobs,
        TTS_CONCURRENCY,
        async (job) => {
          const audio = await requestNarration(job.text, config.voice, controller.signal);
          const buffer = await decodeAudioPayload(
            audio.audioBase64,
            audio.mimeType,
            audioContext
          );
          const {pcm, sampleRate} = audioBufferToInt16(buffer);
          audioByIndex[job.globalIndex] = {
            pcm,
            sampleRate,
            duration: buffer.duration,
          };
          done += 1;
          chaptersTouched.add(job.chapterIndex);
          setBuild((previous) => ({
            ...previous,
            chunksDone: done,
            chaptersDone: chaptersTouched.size,
            message: `Đang tạo giọng đọc ${done}/${totalChunks} · chương ${job.chapterNumber}`,
          }));
        },
        controller.signal
      );

      // 3. Dựng timeline, phụ đề và phân cảnh
      setBuild((previous) => ({
        ...previous,
        phase: 'assembly',
        message: 'Đang dựng phụ đề và phân cảnh…',
      }));

      const chapterNarrations: ChapterNarration[] = withOffsets.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        chunks: chapter.chunks.map((text, chunkIndex) => ({
          text,
          durationSec:
            audioByIndex[chapter.start + chunkIndex]?.duration ??
            Math.max(1.5, text.length / 15.2),
        })),
      }));

      const layout = layoutNarration(chapterNarrations, {
        gapSec: config.gapSec,
        leadInSec: 1.2,
      });

      const clips = layout.chunks.map((chunk) => {
        const source =
          audioByIndex[
            (withOffsets[chunk.chapterIndex]?.start ?? 0) + chunk.chunkIndex
          ];
        return {
          id: chunk.id,
          chapterNumber: chunk.chapterNumber,
          chapterTitle: chunk.chapterTitle,
          text: chunk.text,
          startTime: chunk.startTime,
          duration: chunk.durationSec,
          pcm: source?.pcm ?? new Int16Array(0),
          sampleRate: source?.sampleRate ?? 24000,
        };
      });

      const timeline = new NarrationTimeline(clips);

      const subtitles = layout.chunks.flatMap((chunk) =>
        buildSubtitlesForChunk(chunk.text, chunk.startTime, chunk.durationSec)
      );

      const imagePool = buildImagePool(BUILTIN_STOCK_LIBRARY, {
        coverUrl: proxyImageUrl(novel.coverUrl),
        novelTitle: novel.title,
        description: novel.description,
        uploads: config.images,
      });

      const scenes = buildStoryScenes(subtitles, layout.markers, imagePool, {
        transition: 'crossfade',
        durationSec: layout.durationSec,
      });

      const chapterCards: ChapterCard[] = layout.markers.map((marker) => ({
        time: marker.startTime,
        title: marker.title,
        kicker: `Chương ${marker.chapterNumber}`,
      }));

      preloadSessionImages(imagePool.map((image) => image.url));

      setSession({
        timeline,
        subtitles,
        scenes,
        markers: layout.markers,
        chapterCards,
        durationSec: timeline.duration,
        novelTitle: novel.title,
        novelAuthor: novel.author,
        imageCache: imageCacheRef.current,
        chunkCount: clips.length,
      });

      setBuild((previous) => ({
        ...previous,
        status: 'ready',
        phase: 'done',
        message: 'Đã tạo xong giọng đọc',
        chunksDone: totalChunks,
        chaptersDone: chapters.length,
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setBuild({...IDLE_BUILD, message: 'Đã dừng tạo giọng đọc.'});
      } else {
        setBuild((previous) => ({
          ...previous,
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'Không tạo được giọng đọc cho dự án này.',
        }));
      }
    } finally {
      buildAbortRef.current = null;
      audioContext.close().catch(() => undefined);
    }
  }, [config.gapSec, config.images, config.voice, novel, preloadSessionImages, selectedChapterDetails]);

  const handleExport = useCallback(async () => {
    if (!session) return;

    const capabilities = getRenderCapabilities();
    if (!capabilities.webCodecs) {
      setExportState({
        status: 'error',
        percent: 0,
        label: '',
        error:
          'Trình duyệt này không hỗ trợ WebCodecs. Dùng Chrome hoặc Edge bản mới để xuất MP4.',
      });
      return;
    }

    const safeTitle = (session.novelTitle || 'kinosync')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .toLowerCase();
    const filename = `kinosync-${safeTitle || 'story'}-${Math.round(
      session.durationSec / 60
    )}phut.mp4`;

    let fileHandle: FileSystemFileHandle | undefined;
    if (capabilities.fileSystem) {
      const picked = await pickMp4Destination(filename);
      if (!picked) {
        setExportState({
          status: 'error',
          percent: 0,
          label: '',
          error:
            'Bạn đã huỷ chọn nơi lưu tệp. Bấm “Thử xuất lại” và chọn một thư mục để ghi MP4.',
        });
        return;
      }
      fileHandle = picked;
    } else if (session.durationSec > 20 * 60) {
      setExportState({
        status: 'error',
        percent: 0,
        label: '',
        error:
          'Trình duyệt hiện tại không cho ghi trực tiếp ra đĩa, nên video dài sẽ vượt bộ nhớ. Hãy mở Kinosync bằng Chrome hoặc Edge để xuất phim 60–90 phút.',
      });
      return;
    }

    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportState({
      status: 'running',
      percent: 0,
      label: 'Đang chuẩn bị…',
      filename,
    });

    try {
      const result = await exportLongformVideo({
        scenes: session.scenes,
        subtitles: session.subtitles,
        chapterCards: session.chapterCards,
        imageCache: session.imageCache,
        visualEffect: preset.effect,
        subtitleStyle: config.style,
        exportConfig: config.exportConfig,
        durationSec: session.durationSec,
        transitionDurationSec: 0.85,
        timeline: session.timeline,
        filename,
        fileHandle,
        signal: controller.signal,
        onProgress: (percent, label) =>
          setExportState((previous) => ({...previous, percent, label})),
        onPhase: (phase) =>
          setExportState((previous) => ({...previous, phase})),
      });

      if (result.blob) {
        const url = URL.createObjectURL(result.blob);
        setExportState({
          status: 'done',
          percent: 100,
          label: 'Hoàn tất',
          filename: result.filename,
          downloadUrl: url,
          sizeMb: result.blob.size / 1_000_000,
          resolutionLabel: result.resolutionLabel,
          encodedWithAudio: result.encodedWithAudio,
        });
      } else {
        setExportState({
          status: 'done',
          percent: 100,
          label: 'Hoàn tất',
          filename: result.filename,
          savedToDisk: true,
          resolutionLabel: result.resolutionLabel,
          encodedWithAudio: result.encodedWithAudio,
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setExportState({status: 'idle', percent: 0, label: ''});
      } else {
        setExportState({
          status: 'error',
          percent: 0,
          label: '',
          error:
            error instanceof Error ? error.message : 'Xuất video thất bại.',
        });
      }
    } finally {
      exportAbortRef.current = null;
    }
  }, [config.exportConfig, config.style, preset.effect, session]);

  const downloadSrt = useCallback(() => {
    if (!session) return;
    const srt = buildChapterSrt(session.subtitles);
    const blob = new Blob([srt], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${session.novelTitle.slice(0, 60)}.srt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [session]);

  const resetProject = useCallback(() => {
    buildAbortRef.current?.abort();
    exportAbortRef.current?.abort();
    setSession(null);
    setBuild(IDLE_BUILD);
    setExportState({status: 'idle', percent: 0, label: ''});
    setNovel(null);
    setSelectedChapters([]);
    setStep('library');
  }, []);

  const goToStep = (target: Step) => {
    const order: Step[] = ['library', 'chapters', 'voice', 'render'];
    if (order.indexOf(target) > order.indexOf(step)) return;
    setStep(target);
  };

  /* ----------------------------- Render ----------------------------- */

  return (
    <div className="space-y-8">
      <StepRail current={step} onSelect={goToStep} />

      {step === 'library' ? (
        <NovelLibrary
          novels={novels}
          isLoading={libraryLoading}
          error={libraryError}
          onRetry={() => void loadLibrary()}
          onSelect={(summary) => void openNovel(summary)}
        />
      ) : null}

      {step === 'chapters' ? (
        novelLoading ? (
          <Panel className="flex items-center justify-center gap-3 py-24 text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden />
            Đang tải danh sách chương…
          </Panel>
        ) : novelError ? (
          <Panel className="p-6">
            <p className="text-sm text-danger">{novelError}</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setStep('library')}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Về thư viện
            </Button>
          </Panel>
        ) : novel ? (
          <ChapterPicker
            novel={novel}
            selected={selectedChapters}
            onChange={setSelectedChapters}
            onBack={() => setStep('library')}
            onContinue={() => setStep('voice')}
          />
        ) : (
          <Panel className="p-6 text-sm text-muted">
            Chưa chọn truyện.{' '}
            <button
              type="button"
              onClick={() => setStep('library')}
              className="text-gold underline-offset-4 hover:underline"
            >
              Mở thư viện
            </button>
          </Panel>
        )
      ) : null}

      {step === 'voice' ? (
        <NarrationConfig
          config={config}
          onChange={setConfig}
          chapters={selectedChapterDetails}
          onBack={() => setStep('chapters')}
          onStart={() => {
            setStep('render');
            void startNarration();
          }}
        />
      ) : null}

      {step === 'render' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            {session ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">Bước 4 / 4 · Xem trước</p>
                    <h1 className="display-title mt-2 truncate text-2xl text-ink sm:text-3xl">
                      {session.novelTitle}
                    </h1>
                    <p className="mt-1 text-sm text-muted">
                      {session.novelAuthor || 'Khuyết danh'} ·{' '}
                      {formatDuration(session.durationSec)} · {session.markers.length}{' '}
                      chương
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone="gold">{config.voice}</Badge>
                    <Badge>{preset.label}</Badge>
                  </div>
                </div>

                <StoryPlayer
                  timeline={session.timeline}
                  scenes={session.scenes}
                  subtitles={session.subtitles}
                  chapterCards={session.chapterCards}
                  markers={session.markers}
                  imageCache={session.imageCache}
                  imageVersion={imageVersion}
                  visualEffect={preset.effect}
                  subtitleStyle={config.style}
                  transitionDuration={0.85}
                  aspectRatio={config.exportConfig.aspectRatio}
                />

                <Panel quiet className="p-4">
                  <SectionLabel>Phụ đề đang dựng</SectionLabel>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">
                    {session.subtitles[0]?.text ??
                      parseSrtOrTextToSubtitles(DEFAULT_DEMO_SUBTITLES_SRT, 24)[0]
                        ?.text}
                  </p>
                  <p className="mt-2 text-[11px] text-faint">
                    {session.subtitles.length} dòng phụ đề · mốc thời gian lấy từ độ
                    dài thật của file giọng đọc.
                  </p>
                </Panel>
              </>
            ) : (
              <Panel className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                {build.status === 'running' ? (
                  <>
                    <span className="relative flex h-16 w-16 items-center justify-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-gold/15" />
                      <Film className="relative h-7 w-7 text-gold" aria-hidden />
                    </span>
                    <p className="mt-5 font-display text-2xl text-ink">
                      Đang dựng phim của bạn
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                      {build.message}
                    </p>
                    <div className="mt-6 w-full max-w-sm">
                      <ProgressBar
                        value={
                          build.chunksTotal > 0
                            ? (build.chunksDone / build.chunksTotal) * 100
                            : 4
                        }
                      />
                      <p className="mt-2 font-mono text-[11px] text-faint">
                        {build.chunksDone}/{build.chunksTotal || '—'} đoạn ·{' '}
                        chương {Math.min(build.chaptersDone + 1, build.chaptersTotal)}/
                        {build.chaptersTotal}
                      </p>
                    </div>
                  </>
                ) : build.status === 'error' ? (
                  <>
                    <p className="font-display text-2xl text-ink">Chưa dựng được phim</p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                      {build.error}
                    </p>
                    <Button className="mt-5" onClick={() => void startNarration()}>
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      Thử lại
                    </Button>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-7 w-7 text-gold" aria-hidden />
                    <p className="mt-4 font-display text-2xl text-ink">
                      Chưa có bản dựng
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                      Quay lại bước giọng đọc và bấm “Tạo giọng đọc” để bắt đầu.
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-5"
                      onClick={() => setStep('voice')}
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Về cấu hình
                    </Button>
                  </>
                )}
              </Panel>
            )}
          </div>

          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <RenderStage
              build={build}
              session={session}
              exportState={exportState}
              config={config}
              canExport={Boolean(session) && exportState.status !== 'running'}
              onCancelBuild={() => buildAbortRef.current?.abort()}
              onRetryBuild={() => void startNarration()}
              onExport={() => void handleExport()}
              onCancelExport={() => exportAbortRef.current?.abort()}
              onDownloadSrt={downloadSrt}
              onRestart={resetProject}
            />
          </div>
        </div>
      ) : null}

      {step !== 'library' && step !== 'render' ? (
        <p className="text-center text-[11px] text-faint">
          Nội dung truyện được tải qua API công khai của truyenok.online. Vui lòng ghi
          nguồn khi đăng video.
        </p>
      ) : null}
    </div>
  );
}

function StepRail({
  current,
  onSelect,
}: {
  current: Step;
  onSelect: (step: Step) => void;
}) {
  const order: Step[] = ['library', 'chapters', 'voice', 'render'];
  const currentIndex = order.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEP_LABELS.map((item, index) => {
        const active = item.id === current;
        const done = index < currentIndex;
        const reachable = index <= currentIndex;
        return (
          <li key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              disabled={!reachable}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                active
                  ? 'border-gold/50 bg-gold/12 text-gold'
                  : done
                    ? 'border-line bg-surface-2/60 text-muted hover:text-ink'
                    : 'border-line/60 bg-transparent text-faint'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]',
                  active
                    ? 'bg-gold text-[#221704]'
                    : done
                      ? 'bg-surface-3 text-ink'
                      : 'bg-surface-2 text-faint'
                )}
              >
                {done ? '✓' : index + 1}
              </span>
              {item.label}
            </button>
            {index < STEP_LABELS.length - 1 ? (
              <span className="h-px w-4 bg-line sm:w-7" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
