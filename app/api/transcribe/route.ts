import {GoogleGenAI} from '@google/genai';
import {NextResponse} from 'next/server';
import {
  parseSrtOrTextToSubtitles,
  DEFAULT_DEMO_SUBTITLES_SRT,
} from '@/lib/video-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Máy chủ chưa có GEMINI_API_KEY. Thêm biến môi trường này trong Vercel → Settings → Environment Variables.'
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      base64Audio,
      mimeType = 'audio/mp3',
      durationSec = 24,
      isDemoAudio = false,
    } = body as {
      base64Audio?: string;
      mimeType?: string;
      durationSec?: number;
      isDemoAudio?: boolean;
    };

    if (isDemoAudio || !base64Audio) {
      const demoSegments = parseSrtOrTextToSubtitles(
        DEFAULT_DEMO_SUBTITLES_SRT,
        durationSec
      );
      return NextResponse.json({
        subtitles: demoSegments,
        source: 'demo-voice-sync',
      });
    }

    const cleanBase64 = base64Audio.includes(',')
      ? base64Audio.split(',')[1]
      : base64Audio;

    const promptText = `Hãy nhận diện giọng nói trong file âm thanh này (tổng thời lượng khoảng ${Math.round(
      durationSec
    )} giây) và xuất ra định dạng phụ đề SRT chuẩn (mốc thời gian HH:MM:SS,mmm --> HH:MM:SS,mmm cho từng câu ngắn gọn 6-14 từ). Nếu âm thanh là nhạc không lời, hãy tạo 5 câu phụ đề tiếng Việt khớp thời lượng ${Math.round(
      durationSec
    )} giây. Chỉ trả về nội dung SRT, không giải thích thêm.`;

    const response = await getClient().models.generateContent({
      model: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash',
      contents: {
        parts: [
          {inlineData: {mimeType: mimeType || 'audio/mp3', data: cleanBase64}},
          {text: promptText},
        ],
      },
    });

    const rawText = (response.text ?? '').trim();
    const cleanedSrt = rawText
      .replace(/^```(?:srt|text)?/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = parseSrtOrTextToSubtitles(
      cleanedSrt || DEFAULT_DEMO_SUBTITLES_SRT,
      durationSec
    );

    return NextResponse.json({
      subtitles: parsed,
      rawSrt: cleanedSrt,
      source: 'gemini',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Không thể phân tích giọng nói từ file âm thanh.';
    return NextResponse.json({error: message}, {status: 500});
  }
}
