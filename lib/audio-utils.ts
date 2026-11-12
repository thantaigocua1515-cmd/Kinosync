/**
 * Tiện ích âm thanh chạy ở trình duyệt: giải mã dữ liệu giọng đọc (WAV hoặc
 * PCM thô `audio/L16;rate=24000` mà Gemini trả về) và chuyển đổi định dạng.
 */

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',').pop() ?? '' : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface PcmFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/** Đọc thông số PCM từ mime type dạng `audio/L16;rate=24000;channels=1`. */
export function parsePcmMimeType(mimeType: string): PcmFormat | null {
  const lower = mimeType.toLowerCase();
  const isPcm = lower.includes('l16') || lower.includes('pcm') || lower.includes('raw');
  if (!isPcm) return null;

  const rateMatch = lower.match(/rate=(\d+)/);
  const channelMatch = lower.match(/channels=(\d+)/);
  const bitMatch = lower.match(/bits=(\d+)/);

  return {
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    channels: channelMatch ? Number(channelMatch[1]) : 1,
    bitsPerSample: bitMatch ? Number(bitMatch[1]) : 16,
  };
}

/** Bọc PCM thô vào header WAV để `decodeAudioData` đọc được. */
export function wrapPcmAsWav(
  data: Uint8Array,
  {sampleRate, channels, bitsPerSample}: PcmFormat
): ArrayBuffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + data.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + data.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, data.length, true);
  new Uint8Array(buffer, 44).set(data);

  return buffer;
}

/** Giải mã phản hồi giọng đọc (PCM thô hoặc WAV/MP3) thành AudioBuffer. */
export async function decodeAudioPayload(
  base64: string,
  mimeType: string,
  context: AudioContext
): Promise<AudioBuffer> {
  const bytes = base64ToBytes(base64);
  const pcmFormat = parsePcmMimeType(mimeType);

  if (pcmFormat) {
    const wav = wrapPcmAsWav(bytes, pcmFormat);
    return context.decodeAudioData(wav);
  }

  // `decodeAudioData` sẽ "chiếm" buffer nên truyền bản sao.
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return context.decodeAudioData(copy);
}

/** Trộn các kênh thành mono Int16 để tiết kiệm bộ nhớ khi giữ 90 phút âm thanh. */
export function audioBufferToInt16(buffer: AudioBuffer): {
  pcm: Int16Array;
  sampleRate: number;
} {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const out = new Int16Array(length);

  if (channels === 1) {
    const source = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      out[i] = Math.max(-32768, Math.min(32767, Math.round(source[i] * 32767)));
    }
  } else {
    const data: Float32Array[] = [];
    for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += data[c][i];
      const sample = sum / channels;
      out[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }
  }

  return {pcm: out, sampleRate: buffer.sampleRate};
}

export function int16ToFloat32(pcm: Int16Array, start = 0, length?: number): Float32Array {
  const count = length ?? pcm.length - start;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = (pcm[start + i] ?? 0) / 32768;
  }
  return out;
}

/** Tạo AudioBuffer (mono) từ mẫu Int16 — dùng để phát lại hoặc giải mã lại. */
export function int16ToAudioBuffer(
  context: BaseAudioContext,
  pcm: Int16Array,
  sampleRate: number
): AudioBuffer {
  const buffer = context.createBuffer(1, Math.max(1, pcm.length), sampleRate);
  buffer.getChannelData(0).set(int16ToFloat32(pcm));
  return buffer;
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
