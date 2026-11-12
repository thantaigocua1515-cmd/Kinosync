import {NextResponse} from 'next/server';
import {
  ALLOWED_VOICES,
  MAX_TTS_CHARS,
  synthesizeSpeech,
  TtsError,
  type VoiceName,
} from '@/lib/gemini-tts';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Endpoint cũ của trình dựng thủ công — nay dùng chung bộ giọng đọc với /api/narration. */
export async function POST(request: Request) {
  try {
    const {text, voiceName = 'Kore'} = (await request.json()) as {
      text?: string;
      voiceName?: string;
    };

    if (!text || !text.trim()) {
      return NextResponse.json(
        {error: 'Vui lòng nhập nội dung văn bản để tạo giọng đọc.'},
        {status: 400}
      );
    }
    if (text.length > MAX_TTS_CHARS) {
      return NextResponse.json(
        {error: `Tối đa ${MAX_TTS_CHARS} ký tự cho mỗi lần tạo giọng đọc.`},
        {status: 413}
      );
    }

    const voice = ALLOWED_VOICES.includes(voiceName as VoiceName)
      ? (voiceName as VoiceName)
      : 'Kore';

    const result = await synthesizeSpeech(text, voice);
    return NextResponse.json({
      base64Audio: result.audioBase64,
      mimeType: result.mimeType,
    });
  } catch (error) {
    const status = error instanceof TtsError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Không thể tạo giọng đọc tự động.';
    return NextResponse.json({error: message}, {status});
  }
}
