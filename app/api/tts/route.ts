import {GoogleGenAI} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';

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
    const {text, voiceName = 'Kore'} = (await req.json()) as {
      text: string;
      voiceName?: string;
    };

    if (!text || !text.trim()) {
      return NextResponse.json(
        {error: 'Vui lòng nhập nội dung văn bản để tạo giọng đọc.'},
        {status: 400}
      );
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {voiceName},
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return NextResponse.json(
        {error: 'Không nhận được dữ liệu âm thanh từ máy chủ.'},
        {status: 500}
      );
    }

    return NextResponse.json({
      base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Không thể tạo giọng đọc tự động.';
    return NextResponse.json({error: message}, {status: 500});
  }
}
