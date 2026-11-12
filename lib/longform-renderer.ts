import {
  Muxer,
  ArrayBufferTarget,
  FileSystemWritableFileStreamTarget,
} from 'mp4-muxer';
import {
  ChapterCard,
  ExportConfig,
  SceneItem,
  SubtitleSegment,
  SubtitleStyleConfig,
  VisualEffectPreset,
  getResolutionDimensions,
} from './video-engine';
import {drawVideoFrame} from './canvas-renderer';
import {NarrationTimeline, pickAacConfig} from './narration-timeline';

export interface LongformRenderOptions {
  scenes: SceneItem[];
  subtitles: SubtitleSegment[];
  chapterCards: ChapterCard[];
  imageCache: Map<string, HTMLImageElement>;
  visualEffect: VisualEffectPreset;
  subtitleStyle: SubtitleStyleConfig;
  exportConfig: ExportConfig;
  durationSec: number;
  transitionDurationSec: number;
  timeline: NarrationTimeline;
  filename?: string;
  /** Nếu có, video được ghi trực tiếp xuống đĩa (không giới hạn bộ nhớ). */
  fileHandle?: FileSystemFileHandle;
  onProgress: (percent: number, label: string) => void;
  onPhase?: (phase: 'audio' | 'video' | 'finalizing') => void;
  signal?: AbortSignal;
}

export interface LongformRenderResult {
  filename: string;
  resolutionLabel: string;
  /** Có khi render vào bộ nhớ (không chọn tệp đích). */
  blob?: Blob;
  /** Có khi ghi trực tiếp xuống đĩa. */
  savedToDisk: boolean;
  encodedWithAudio: boolean;
  totalFrames: number;
}

const CODEC_BY_PIXELS: {codec: string; maxPixels: number}[] = [
  {codec: 'avc1.42001f', maxPixels: 1280 * 720},
  {codec: 'avc1.640028', maxPixels: 1920 * 1080},
  {codec: 'avc1.640033', maxPixels: 2560 * 1440},
];

function pickCodec(width: number, height: number): string {
  const pixels = width * height;
  const match = CODEC_BY_PIXELS.find((entry) => pixels <= entry.maxPixels);
  return match?.codec ?? 'avc1.640033';
}

/** Kiểm tra nhanh khả năng xuất video dài của trình duyệt. */
export function getRenderCapabilities(): {
  webCodecs: boolean;
  fileSystem: boolean;
  audioEncode: boolean;
} {
  if (typeof window === 'undefined') {
    return {webCodecs: false, fileSystem: false, audioEncode: false};
  }
  const picker = (window as WindowWithFilePicker).showSaveFilePicker;
  return {
    webCodecs: 'VideoEncoder' in window && 'VideoFrame' in window,
    fileSystem: typeof picker === 'function',
    audioEncode: 'AudioEncoder' in window,
  };
}

/**
 * Xuất video đọc truyện dài (60–90 phút) gồm hình ảnh, phụ đề và giọng đọc.
 *
 * Video được mã hoá bằng WebCodecs H.264 + AAC và đóng gói bởi mp4-muxer.
 * Khi trình duyệt hỗ trợ File System Access API, dữ liệu được ghi theo từng
 * khối 16 MB xuống tệp đã chọn nên không cần giữ cả bộ phim trong RAM.
 */
export async function exportLongformVideo(
  options: LongformRenderOptions
): Promise<LongformRenderResult> {
  const {
    scenes,
    subtitles,
    chapterCards,
    imageCache,
    visualEffect,
    subtitleStyle,
    exportConfig,
    durationSec,
    transitionDurationSec,
    timeline,
    onProgress,
    onPhase,
    signal,
  } = options;

  const capabilities = getRenderCapabilities();
  if (!capabilities.webCodecs) {
    throw new Error(
      'Trình duyệt này không hỗ trợ WebCodecs. Hãy dùng Chrome hoặc Edge bản mới để xuất video dài.'
    );
  }

  const {width, height} = getResolutionDimensions(
    exportConfig.resolution,
    exportConfig.aspectRatio
  );
  const fps = exportConfig.fps;
  const safeDuration = Math.max(4, durationSec);
  const totalFrames = Math.ceil(safeDuration * fps);
  const codec = pickCodec(width, height);
  const bitrate = Math.max(1, exportConfig.bitrateMbps) * 1_000_000;

  const support = await VideoEncoder.isConfigSupported({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
  });
  if (!support.supported) {
    throw new Error(
      `Máy này không mã hoá được H.264 ${width}×${height}@${fps}fps. Hạ độ phân giải hoặc chọn 720p.`
    );
  }

  const audioConfig = await pickAacConfig(timeline.clips[0]?.sampleRate ?? 24000);
  const encodedWithAudio = Boolean(audioConfig);

  let writable: FileSystemWritableFileStream | null = null;
  let bufferTarget: ArrayBufferTarget | null = null;
  let fileTarget: FileSystemWritableFileStreamTarget | null = null;

  if (options.fileHandle) {
    writable = await options.fileHandle.createWritable();
    fileTarget = new FileSystemWritableFileStreamTarget(writable, {
      chunkSize: 16 * 1024 * 1024,
    });
  } else {
    bufferTarget = new ArrayBufferTarget();
  }

  const muxer = new Muxer({
    target: (fileTarget ?? bufferTarget)!,
    video: {codec: 'avc', width, height, frameRate: fps},
    ...(audioConfig
      ? {
          audio: {
            codec: 'aac' as const,
            numberOfChannels: audioConfig.numberOfChannels,
            sampleRate: audioConfig.sampleRate,
          },
        }
      : {}),
    fastStart: fileTarget ? 'fragmented' : 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  const cleanup = async () => {
    if (writable) {
      try {
        await writable.abort();
      } catch {
        // tệp có thể đã đóng
      }
    }
  };

  try {
    let encoderError: Error | null = null;

    // ---------- 1. Giọng đọc (AAC) ----------
    if (audioConfig) {
      onPhase?.('audio');
      onProgress(1, 'Đang nén giọng đọc thành AAC…');
      await timeline.encodeAac({
        sampleRate: audioConfig.sampleRate,
        numberOfChannels: audioConfig.numberOfChannels,
        bitrate: audioConfig.bitrate,
        signal,
        onProgress: (ratio) =>
          onProgress(
            Math.round(2 + ratio * 11),
            `Đang nén giọng đọc ${Math.round(ratio * 100)}%`
          ),
        onChunk: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      });
    }

    // ---------- 2. Hình ảnh ----------
    onPhase?.('video');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) throw new Error('Không khởi tạo được Canvas 2D để dựng hình.');

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (error) => {
        encoderError = error instanceof Error ? error : new Error(String(error));
      },
    });
    encoder.configure({codec, width, height, bitrate, framerate: fps, latencyMode: 'quality'});

    const keyFrameInterval = fps * 4;
    const startedAt = performance.now();

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (signal?.aborted) {
        throw new DOMException('Đã huỷ', 'AbortError');
      }
      if (encoderError) throw encoderError;

      const timeSec = Math.min(safeDuration, frameIndex / fps);
      drawVideoFrame(
        ctx,
        width,
        height,
        timeSec,
        scenes,
        subtitles,
        imageCache,
        visualEffect,
        subtitleStyle,
        transitionDurationSec,
        chapterCards
      );

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((frameIndex / fps) * 1_000_000),
        duration: Math.round((1 / fps) * 1_000_000),
      });
      encoder.encode(frame, {keyFrame: frameIndex % keyFrameInterval === 0});
      frame.close();

      // Giữ hàng đợi mã hoá ở mức an toàn để không phình bộ nhớ.
      while (encoder.encodeQueueSize > 12) {
        await new Promise((resolve) => setTimeout(resolve, 8));
        if (signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError');
      }

      if (frameIndex % fps === 0 || frameIndex === totalFrames - 1) {
        const ratio = (frameIndex + 1) / totalFrames;
        const elapsed = (performance.now() - startedAt) / 1000;
        const fpsActual = (frameIndex + 1) / Math.max(0.001, elapsed);
        const remaining = (totalFrames - frameIndex - 1) / Math.max(0.1, fpsActual);
        onProgress(
          Math.round(13 + ratio * 84),
          `Khung hình ${frameIndex + 1}/${totalFrames} · còn ~${Math.ceil(
            remaining / 60
          )} phút`
        );
      }
    }

    await encoder.flush();
    encoder.close();
    if (encoderError) throw encoderError;

    // ---------- 3. Đóng gói ----------
    onPhase?.('finalizing');
    onProgress(98, 'Đang hoàn tất tệp MP4…');
    muxer.finalize();

    const filename =
      options.filename ?? `kinosync-story-${exportConfig.resolution}-${Date.now()}.mp4`;
    const resolutionLabel = `${width}×${height} · ${fps}fps · ${
      encodedWithAudio ? 'AAC 96 kbps' : 'không âm thanh'
    }`;

    if (writable) {
      await writable.close();
      onProgress(100, 'Đã ghi xong tệp MP4 xuống đĩa');
      return {
        filename,
        resolutionLabel,
        savedToDisk: true,
        encodedWithAudio,
        totalFrames,
      };
    }

    const blob = new Blob([bufferTarget!.buffer], {type: 'video/mp4'});
    onProgress(100, 'Đã đóng gói xong MP4');
    return {
      filename,
      resolutionLabel,
      blob,
      savedToDisk: false,
      encodedWithAudio,
      totalFrames,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

interface WindowWithFilePicker extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: {description?: string; accept: Record<string, string[]>}[];
  }) => Promise<FileSystemFileHandle>;
}

/** Mở hộp thoại chọn nơi lưu tệp MP4 (chỉ Chrome/Edge). */
export async function pickMp4Destination(filename: string) {
  const picker = (window as WindowWithFilePicker).showSaveFilePicker;
  if (typeof window === 'undefined' || !picker) return null;
  try {
    return await picker({
      suggestedName: filename,
      types: [
        {
          description: 'Video MP4',
          accept: {'video/mp4': ['.mp4']},
        },
      ],
    });
  } catch {
    return null;
  }
}
