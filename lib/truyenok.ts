/**
 * Client phía máy chủ cho API đọc truyện mở rộng của truyenok.online.
 * Tài liệu: https://truyenok.online/api/v1/openapi.json
 *
 * Toàn bộ request đi qua Route Handler của Next.js để:
 *  - che dấu origin/không gặp lỗi CORS ở trình duyệt,
 *  - chuẩn hoá dữ liệu (chapterNumber có lúc là string, có lúc là number),
 *  - dùng cache dữ liệu của Vercel cho các truyện ít thay đổi.
 */

const DEFAULT_BASE = 'https://truyenok.online';

export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

export function truyenokBase(): string {
  return (process.env.TRUYENOK_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
}

async function getJson<T>(path: string, revalidate = 300): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${truyenokBase()}${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Kinosync/1.0 (+https://github.com/thantaigocua1515-cmd/Kinosync)',
      },
      next: { revalidate },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'không rõ nguyên nhân';
    throw new UpstreamError(`Không kết nối được máy chủ truyện: ${detail}`, 504);
  }

  if (res.status === 404) {
    throw new UpstreamError('Không tìm thấy dữ liệu trên máy chủ truyện.', 404);
  }
  if (!res.ok) {
    throw new UpstreamError(
      `Máy chủ truyện trả về mã lỗi ${res.status}.`,
      res.status >= 500 ? 502 : res.status
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError('Máy chủ truyện trả về dữ liệu không phải JSON.', 502);
  }
}

export interface ChapterSummary {
  chapterNumber: number;
  title: string;
  originalTitle?: string;
  wordCount: number;
  translationStatus?: string;
}

export interface NovelSummary {
  id: string;
  title: string;
  originalTitle?: string;
  author?: string;
  description?: string;
  coverUrl?: string;
  status?: string;
  chaptersCount: number;
  translatedChaptersCount: number;
  updatedAt?: string;
}

export interface NovelDetail extends NovelSummary {
  chapters: ChapterSummary[];
}

export interface ChapterContent {
  novelId: string;
  novelTitle: string;
  chapterNumber: number;
  title: string;
  content: string;
  wordCount: number;
  translationStatus?: string;
  format: string;
}

interface RawNovel {
  id?: unknown;
  title?: unknown;
  originalTitle?: unknown;
  author?: unknown;
  description?: unknown;
  coverUrl?: unknown;
  status?: unknown;
  chaptersCount?: unknown;
  translatedChaptersCount?: unknown;
  updatedAt?: unknown;
  chapters?: unknown;
}

interface RawChapterContent {
  novelId?: unknown;
  novelTitle?: unknown;
  chapterNumber?: unknown;
  title?: unknown;
  content?: unknown;
  wordCount?: unknown;
  translationStatus?: unknown;
  format?: unknown;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeNovel(raw: RawNovel): NovelSummary {
  return {
    id: str(raw.id),
    title: str(raw.title, 'Không tên'),
    originalTitle: str(raw.originalTitle) || undefined,
    author: str(raw.author) || undefined,
    description: str(raw.description) || undefined,
    coverUrl: str(raw.coverUrl) || undefined,
    status: str(raw.status) || undefined,
    chaptersCount: num(raw.chaptersCount),
    translatedChaptersCount: num(raw.translatedChaptersCount),
    updatedAt: str(raw.updatedAt) || undefined,
  };
}

export async function fetchNovels(): Promise<NovelSummary[]> {
  const payload = await getJson<{ data?: RawNovel[] }>('/api/v1/novels', 300);
  const list = Array.isArray(payload.data) ? payload.data : [];
  return list
    .map(normalizeNovel)
    .filter((novel) => Boolean(novel.id))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export async function fetchNovel(id: string): Promise<NovelDetail> {
  const payload = await getJson<{ data?: RawNovel }>(
    `/api/v1/novels/${encodeURIComponent(id)}`,
    300
  );
  if (!payload.data) {
    throw new UpstreamError('Không tìm thấy truyện.', 404);
  }
  const novel = normalizeNovel(payload.data);
  const rawChapters = Array.isArray(payload.data.chapters) ? payload.data.chapters : [];
  const chapters: ChapterSummary[] = rawChapters
    .map((item) => {
      const chapter = item as Record<string, unknown>;
      return {
        chapterNumber: num(chapter.chapterNumber),
        title: str(chapter.title, `Chương ${num(chapter.chapterNumber)}`),
        originalTitle: str(chapter.originalTitle) || undefined,
        wordCount: num(chapter.wordCount),
        translationStatus: str(chapter.translationStatus) || undefined,
      };
    })
    .filter((chapter) => Number.isFinite(chapter.chapterNumber) && chapter.chapterNumber > 0)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  return {...novel, chapters};
}

export async function fetchChapter(
  id: string,
  chapterNumber: number,
  format: 'translated' | 'original' | 'both' = 'translated'
): Promise<ChapterContent> {
  const payload = await getJson<{ data?: RawChapterContent }>(
    `/api/v1/novels/${encodeURIComponent(id)}/chapters/${chapterNumber}?format=${format}`,
    3600
  );
  const data = payload.data;
  if (!data) {
    throw new UpstreamError('Không tìm thấy chương truyện.', 404);
  }
  return {
    novelId: str(data.novelId, id),
    novelTitle: str(data.novelTitle),
    chapterNumber: num(data.chapterNumber, chapterNumber),
    title: str(data.title, `Chương ${chapterNumber}`),
    content: str(data.content),
    wordCount: num(data.wordCount),
    translationStatus: str(data.translationStatus) || undefined,
    format: str(data.format, format),
  };
}
