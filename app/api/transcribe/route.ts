import {GoogleGenAI} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
import {
  parseSrtOrTextToSubtitles,
  DEFAULT_DEMO_SUBTITLES_SRT,
} from '@/lib/video-engine';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function POST(req: NextRequest) {
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

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/mp3',
        data: cleanBase64,
      },
    };

    const promptText = `Hãy nhận diện giọng nói trong file âm thanh này (tổng thời lượng khoảng ${Math.round(durationSec)} giây) và xuất ra định dạng phụ đề SRT chuẩn (có mốc thời gian HH:MM:SS,mmm --> HH:MM:SS,mmm cho từng câu ngắn gọn từ 6-14 từ). Nếu âm thanh là nhạc không lời hoặc không rõ tiếng nói, hãy tạo 5 câu phụ đề truyền cảm hứng bằng tiếng Việt khớp với giai điệu và thời lượng ${Math.round(durationSec)} giây theo chuẩn SRT. Chỉ trả về nội dung SRT, không giải thích thêm.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [audioPart, {text: promptText}],
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
      source: 'gemini-3.5-transcribe',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Không thể phân tích giọng nói từ file âm thanh.';
    return NextResponse.json({error: message}, {status: 500});
  }
}
