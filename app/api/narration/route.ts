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

export async function POST(request: Request) {
  let body: {text?: unknown; voice?: unknown};
  try {
    body = (await request.json()) as {text?: unknown; voice?: unknown};
  } catch {
    return NextResponse.json({error: 'Dữ liệu gửi lên không hợp lệ.'}, {status: 400});
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const voice = ALLOWED_VOICES.includes(body.voice as VoiceName)
    ? (body.voice as VoiceName)
    : 'Kore';

  if (!text.trim()) {
    return NextResponse.json(
      {error: 'Cần nội dung văn bản để tạo giọng đọc.'},
      {status: 400}
    );
  }
  if (text.length > MAX_TTS_CHARS) {
    return NextResponse.json(
      {error: `Đoạn văn bản vượt quá ${MAX_TTS_CHARS} ký tự.`},
      {status: 413}
    );
  }

  try {
    const result = await synthesizeSpeech(text, voice);
    return NextResponse.json(
      {...result, voice, chars: text.length},
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch (error) {
    const status = error instanceof TtsError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Không tạo được giọng đọc.';
    return NextResponse.json({error: message}, {status});
  }
}
