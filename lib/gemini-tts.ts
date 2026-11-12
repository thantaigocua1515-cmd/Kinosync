import {GoogleGenAI} from '@google/genai';

/**
 * Giọng đọc Gemini (multi-speaker prebuilt voices).
 * Giữ danh sách này đồng bộ với `lib/voices.ts` ở phía giao diện.
 */
export const ALLOWED_VOICES = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
  'Zephyr',
] as const;

export type VoiceName = (typeof ALLOWED_VOICES)[number];

export const MAX_TTS_CHARS = 900;

export class TtsError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'TtsError';
    this.status = status;
  }
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new TtsError(
      'Máy chủ chưa có GEMINI_API_KEY. Thêm biến môi trường này trong Vercel → Settings → Environment Variables rồi deploy lại.',
      503
    );
  }
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {headers: {'User-Agent': 'kinosync'}},
    });
  }
  return client;
}

export function ttsModel(): string {
  return process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
}

export interface SpeechResult {
  audioBase64: string;
  mimeType: string;
  model: string;
}

/** Tạo giọng đọc cho một đoạn văn bản ngắn (<= 900 ký tự). */
export async function synthesizeSpeech(
  text: string,
  voice: VoiceName
): Promise<SpeechResult> {
  const clean = text.trim();
  if (!clean) {
    throw new TtsError('Đoạn văn bản cần đọc đang trống.', 400);
  }
  if (clean.length > MAX_TTS_CHARS) {
    throw new TtsError(
      `Đoạn văn bản quá dài (${clean.length} ký tự, tối đa ${MAX_TTS_CHARS}).`,
      413
    );
  }

  const model = ttsModel();
  const ai = getClient();

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{role: 'user', parts: [{text: clean}]}],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {prebuiltVoiceConfig: {voiceName: voice}},
        },
      },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (/not found|404|invalid model/i.test(raw)) {
      throw new TtsError(
        `Model giọng đọc "${model}" không khả dụng với khoá API này. Đặt biến GEMINI_TTS_MODEL sang model TTS mà khoá của bạn có.`,
        502
      );
    }
    if (/quota|429|resource exhausted/i.test(raw)) {
      throw new TtsError(
        'Đã vượt hạn mức giọng đọc của Google AI. Thử lại sau ít phút hoặc giảm số chương.',
        429
      );
    }
    throw new TtsError(`Không tạo được giọng đọc: ${raw}`, 502);
  }

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find((part) => part.inlineData?.data);
  const audioBase64 = audioPart?.inlineData?.data;

  if (!audioBase64) {
    throw new TtsError(
      'Máy chủ giọng đọc không trả về dữ liệu âm thanh. Thử lại hoặc rút ngắn đoạn văn bản.',
      502
    );
  }

  return {
    audioBase64,
    mimeType: audioPart?.inlineData?.mimeType || 'audio/L16;rate=24000',
    model,
  };
}
