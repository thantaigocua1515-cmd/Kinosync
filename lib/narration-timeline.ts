import {int16ToAudioBuffer, int16ToFloat32} from './audio-utils';

export interface NarrationClipInput {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  text: string;
  startTime: number;
  duration: number;
  pcm: Int16Array;
  sampleRate: number;
}

export interface NarrationClip extends NarrationClipInput {}

export interface AacEncodeOptions {
  sampleRate: number;
  numberOfChannels: number;
  bitrate: number;
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

/**
 * Giữ toàn bộ lời đọc đã tổng hợp dưới dạng PCM 16-bit (≈260 MB cho 90 phút
 * ở 24 kHz) và cung cấp thời lượng, phát lại theo cửa sổ, và mã hoá AAC.
 */
export class NarrationTimeline {
  readonly clips: NarrationClip[];

  constructor(clips: NarrationClipInput[]) {
    this.clips = [...clips].sort((a, b) => a.startTime - b.startTime);
  }

  get duration(): number {
    const last = this.clips[this.clips.length - 1];
    return last ? last.startTime + last.duration : 0;
  }

  get totalSamples(): number {
    return this.clips.reduce(
      (sum, clip) => sum + Math.round(clip.duration * clip.sampleRate),
      0
    );
  }

  clipAt(timeSec: number): NarrationClip | null {
    for (const clip of this.clips) {
      if (timeSec >= clip.startTime && timeSec < clip.startTime + clip.duration) {
        return clip;
      }
    }
    return null;
  }

  chapterAt(timeSec: number): NarrationClip | null {
    const current = this.clipAt(timeSec);
    if (current) return current;
    const previous = this.clips.filter((c) => c.startTime <= timeSec).pop();
    return previous ?? this.clips[0] ?? null;
  }

  createBuffer(context: BaseAudioContext, clip: NarrationClip): AudioBuffer {
    return int16ToAudioBuffer(context, clip.pcm, clip.sampleRate);
  }

  /**
   * Mã hoá toàn bộ lời đọc thành các gói AAC (mp4a.40.2), chèn khoảng lặng
   * đúng vị trí để khớp timeline phụ đề.
   */
  async encodeAac(options: AacEncodeOptions): Promise<void> {
    const {sampleRate, numberOfChannels, bitrate, onChunk, onProgress, signal} = options;

    if (typeof AudioEncoder === 'undefined') {
      throw new Error(
        'Trình duyệt không hỗ trợ WebCodecs AudioEncoder. Hãy dùng Chrome hoặc Edge phiên bản mới.'
      );
    }

    const encoder = new AudioEncoder({
      output: (chunk, meta) => onChunk(chunk, meta),
      error: (error) => {
        console.error('AudioEncoder error', error);
      },
    });
    encoder.configure({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels,
      bitrate,
    });

    const totalSeconds = Math.max(1, this.duration);
    let writtenSamples = 0;
    let pending = new Float32Array(0);

    const pushSamples = (samples: Float32Array) => {
      if (samples.length === 0) return;
      const merged = new Float32Array(pending.length + samples.length);
      merged.set(pending);
      merged.set(samples, pending.length);

      const blockSize = 1024;
      let offset = 0;
      while (merged.length - offset >= blockSize) {
        const block = merged.subarray(offset, offset + blockSize);
        const timestamp = Math.round((writtenSamples / sampleRate) * 1_000_000);
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: blockSize,
          numberOfChannels,
          timestamp,
          data: block.slice().buffer,
        });
        encoder.encode(audioData);
        audioData.close();
        writtenSamples += blockSize;
        offset += blockSize;
      }
      pending = merged.slice(offset);
    };

    const pushSilence = (seconds: number) => {
      const frames = Math.max(0, Math.round(seconds * sampleRate));
      const chunk = 4800;
      for (let i = 0; i < frames; i += chunk) {
        pushSamples(new Float32Array(Math.min(chunk, frames - i)));
      }
    };

    let cursor = 0;

    for (let index = 0; index < this.clips.length; index++) {
      if (signal?.aborted) {
        encoder.close();
        throw new DOMException('Đã huỷ', 'AbortError');
      }

      const clip = this.clips[index];
      const gap = Math.max(0, clip.startTime - cursor);
      if (gap > 0) pushSilence(gap);

      let samples: Float32Array;
      if (clip.sampleRate === sampleRate) {
        samples = int16ToFloat32(clip.pcm);
      } else {
        samples = await this.resample(clip, sampleRate);
      }
      pushSamples(samples);

      cursor = clip.startTime + clip.duration;
      onProgress?.(Math.min(1, cursor / totalSeconds));

      // Nhường luồng cho UI để thanh tiến trình cập nhật.
      if (index % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    if (pending.length > 0) {
      pushSamples(pending);
    }

    await encoder.flush();
    encoder.close();
    onProgress?.(1);
  }

  private async resample(clip: NarrationClip, sampleRate: number): Promise<Float32Array> {
    const source = int16ToAudioBuffer(
      new OfflineAudioContext(1, 1, clip.sampleRate),
      clip.pcm,
      clip.sampleRate
    );
    const frames = Math.max(1, Math.ceil((source.duration + 0.01) * sampleRate));
    const offline = new OfflineAudioContext(1, frames, sampleRate);
    const node = offline.createBufferSource();
    node.buffer = source;
    node.connect(offline.destination);
    node.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  }
}

/** Chọn cấu hình AAC mà trình duyệt hỗ trợ (24 kHz gốc, dự phòng 48 kHz). */
export async function pickAacConfig(
  preferredSampleRate: number
): Promise<{sampleRate: number; numberOfChannels: number; bitrate: number} | null> {
  if (typeof AudioEncoder === 'undefined' || !AudioEncoder.isConfigSupported) {
    return null;
  }

  const candidates = [
    {sampleRate: preferredSampleRate || 24000, numberOfChannels: 1, bitrate: 96000},
    {sampleRate: 48000, numberOfChannels: 1, bitrate: 96000},
    {sampleRate: 44100, numberOfChannels: 2, bitrate: 128000},
  ];

  for (const candidate of candidates) {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        ...candidate,
      });
      if (support.supported) return candidate;
    } catch {
      // thử cấu hình kế tiếp
    }
  }
  return null;
}
