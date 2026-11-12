/**
 * Các hàm thuần (pure) cho pipeline "truyện → video": chia đoạn văn bản cho
 * giọng đọc, tính thời lượng, dựng phụ đề và ghép phân cảnh.
 *
 * File này không phụ thuộc DOM nên chạy được cả ở server, client và trong test.
 */
import {
  StockImageItem,
  SubtitleSegment,
  SceneItem,
  TransitionStyle,
  matchImagesToTimeline,
} from './video-engine';

/** Số ký tự tối đa cho một lần gọi giọng đọc (giữ mỗi câu trọn vẹn). */
export const DEFAULT_CHUNK_MAX_CHARS = 420;

/** Tốc độ đọc tiếng Việt tham chiếu: ~165 từ/phút ≈ 15.2 ký tự/giây. */
export const CHARS_PER_SECOND = 15.2;

/** Độ dài mục tiêu của một khung hình minh họa (giây). */
export const DEFAULT_SCENE_SECONDS = 22;

/**
 * Số từ trung bình của một chương truyện dịch (đo trên dữ liệu thật).
 * trường `wordCount` của API nguồn thực chất là số đoạn văn nên không dùng trực tiếp.
 */
export const DEFAULT_CHAPTER_WORDS = 900;

/** Dùng `wordCount` khi đáng tin, nếu không thì lấy độ dài chương trung bình. */
export function effectiveWordCount(chapter: {wordCount?: number}): number {
  const words = chapter.wordCount ?? 0;
  return words >= 250 ? words : DEFAULT_CHAPTER_WORDS;
}

export interface ChapterEstimateInput {
  chapterNumber: number;
  title: string;
  wordCount: number;
}

export interface SessionEstimate {
  chapters: number;
  words: number;
  chunks: number;
  estimatedSeconds: number;
  estimatedMinutes: number;
}

export interface NarrationMarkers {
  chapterNumber: number;
  title: string;
  startTime: number;
  endTime: number;
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .trim();
}

/** Tách đoạn văn thành từng câu, giữ dấu câu của bản gốc. */
export function splitIntoSentences(paragraph: string): string[] {
  const clean = normalizeWhitespace(paragraph).replace(/\n+/g, ' ');
  if (!clean) return [];

  const sentences = clean.match(/[^.!?…]+[.!?…]+["'”’)\]]*|[^.!?…]+$/g) ?? [];
  return sentences.map((s) => s.trim()).filter(Boolean);
}

/** Chẻ một câu quá dài ở dấu phẩy/chấm phẩy để phụ đề không tràn màn hình. */
export function splitLongSentence(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];

  const pieces: string[] = [];
  let buffer = '';
  const parts = sentence.split(/(?<=[,;:—-])\s+/);

  for (const part of parts) {
    const candidate = buffer ? `${buffer} ${part}` : part;
    if (candidate.length > maxChars && buffer) {
      pieces.push(buffer);
      buffer = part;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) pieces.push(buffer);

  // Vẫn quá dài (không có dấu ngắt) thì cắt cứng theo khoảng trắng.
  const result: string[] = [];
  for (const piece of pieces) {
    if (piece.length <= maxChars) {
      result.push(piece);
      continue;
    }
    let rest = piece;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(' ', maxChars);
      const index = cut > 40 ? cut : maxChars;
      result.push(rest.slice(0, index).trim());
      rest = rest.slice(index).trim();
    }
    if (rest) result.push(rest);
  }
  return result.filter(Boolean);
}

/**
 * Chia nội dung chương thành các khối văn bản gửi cho giọng đọc.
 * Mỗi khối gồm các câu trọn vẹn, không vượt quá `maxChars`.
 */
export function chunkChapterText(
  content: string,
  maxChars: number = DEFAULT_CHUNK_MAX_CHARS
): string[] {
  const paragraphs = normalizeWhitespace(content)
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const paragraph of paragraphs) {
    for (const sentence of splitIntoSentences(paragraph)) {
      for (const piece of splitLongSentence(sentence, maxChars)) {
        sentences.push(piece);
      }
    }
  }

  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Ước lượng thời lượng đọc của một khối văn bản (giây). */
export function estimateSeconds(text: string): number {
  return Math.max(1.5, text.trim().length / CHARS_PER_SECOND);
}

/** Ước lượng số khối và thời lượng cho danh sách chương (dùng wordCount từ API). */
export function estimateSession(
  chapters: ChapterEstimateInput[],
  maxChars: number = DEFAULT_CHUNK_MAX_CHARS
): SessionEstimate {
  const words = chapters.reduce((sum, c) => sum + effectiveWordCount(c), 0);
  const wordsPerChunk = Math.max(40, Math.round(maxChars / 5.6));
  const chunks = chapters.reduce(
    (sum, c) =>
      sum + Math.max(1, Math.ceil(effectiveWordCount(c) / wordsPerChunk)),
    0
  );
  const estimatedSeconds = chapters.reduce(
    (sum, c) => sum + (effectiveWordCount(c) / 165) * 60,
    0
  );

  return {
    chapters: chapters.length,
    words,
    chunks,
    estimatedSeconds: Math.round(estimatedSeconds),
    estimatedMinutes: Math.round((estimatedSeconds / 60) * 10) / 10,
  };
}

/** Chia thời lượng của một khối thành các dòng phụ đề theo độ dài từng câu. */
export function buildSubtitlesForChunk(
  text: string,
  startTime: number,
  durationSec: number,
  maxChars = 64
): SubtitleSegment[] {
  const sentences = splitIntoSentences(text)
    .flatMap((sentence) => splitLongSentence(sentence, maxChars))
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const weights = sentences.map((s) => Math.max(1, s.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const safeDuration = Math.max(0.8, durationSec);

  let cursor = startTime;
  return sentences.map((sentence, index) => {
    const share = (weights[index] / totalWeight) * safeDuration;
    const isLast = index === sentences.length - 1;
    const end = isLast ? startTime + safeDuration : cursor + share;
    const segment: SubtitleSegment = {
      id: `sub-${startTime.toFixed(2)}-${index + 1}`,
      startTime: Number(cursor.toFixed(2)),
      endTime: Number(Math.max(cursor + 0.6, end).toFixed(2)),
      text: sentence,
      keywords: [],
    };
    cursor = end;
    return segment;
  });
}

export interface ChapterNarration {
  chapterNumber: number;
  title: string;
  chunks: {text: string; durationSec: number}[];
}

export interface StoryAssembly {
  subtitles: SubtitleSegment[];
  markers: NarrationMarkers[];
  durationSec: number;
}

export interface LaidOutChunk {
  id: string;
  chapterIndex: number;
  chunkIndex: number;
  chapterNumber: number;
  chapterTitle: string;
  text: string;
  startTime: number;
  durationSec: number;
}

export interface NarrationLayout {
  chunks: LaidOutChunk[];
  markers: NarrationMarkers[];
  durationSec: number;
}

/**
 * Tính vị trí thời gian của từng đoạn đọc dựa trên thời lượng thật.
 * Đây là nguồn thời gian duy nhất cho phụ đề, mốc chương và bản âm thanh.
 */
export function layoutNarration(
  chapters: ChapterNarration[],
  options: {gapSec?: number; leadInSec?: number} = {}
): NarrationLayout {
  const gapSec = options.gapSec ?? 0.9;
  const leadInSec = options.leadInSec ?? 1.2;

  const chunks: LaidOutChunk[] = [];
  const markers: NarrationMarkers[] = [];
  let cursor = leadInSec;

  chapters.forEach((chapter, chapterIndex) => {
    const chapterStart = cursor;
    chapter.chunks.forEach((chunk, chunkIndex) => {
      const durationSec = Math.max(0.4, chunk.durationSec);
      chunks.push({
        id: `c${chapterIndex}-${chunkIndex}`,
        chapterIndex,
        chunkIndex,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        text: chunk.text,
        startTime: Number(cursor.toFixed(3)),
        durationSec,
      });
      cursor += durationSec;
    });

    markers.push({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      startTime: Number(chapterStart.toFixed(2)),
      endTime: Number(cursor.toFixed(2)),
    });

    if (chapterIndex < chapters.length - 1) {
      cursor += gapSec;
    }
  });

  return {
    chunks,
    markers,
    durationSec: Number((cursor + 1.5).toFixed(2)),
  };
}

/** Dựng phụ đề + mốc chương từ thời lượng thật của từng đoạn giọng đọc. */
export function assembleNarrationTimeline(
  chapters: ChapterNarration[],
  options: {gapSec?: number; leadInSec?: number} = {}
): StoryAssembly {
  const layout = layoutNarration(chapters, options);
  const subtitles = layout.chunks.flatMap((chunk) =>
    buildSubtitlesForChunk(chunk.text, chunk.startTime, chunk.durationSec)
  );

  return {
    subtitles,
    markers: layout.markers,
    durationSec: layout.durationSec,
  };
}

export interface ImagePoolOptions {
  coverUrl?: string;
  novelTitle?: string;
  description?: string;
  uploads?: {id: string; url: string; name: string}[];
}

/** Gộp ảnh bìa + ảnh minh họa có sẵn + ảnh người dùng tải lên thành một "kho ảnh". */
export function buildImagePool(
  stockLibrary: StockImageItem[],
  options: ImagePoolOptions = {}
): StockImageItem[] {
  const pool: StockImageItem[] = [];

  if (options.uploads && options.uploads.length > 0) {
    options.uploads.forEach((upload, index) => {
      pool.push({
        id: `upload-${index}`,
        title: upload.name,
        category: 'Ảnh của bạn',
        url: upload.url,
        keywords: [],
        dominantColor: '#1f2937',
        description: 'Kho ảnh tải lên',
      });
    });
    return pool;
  }

  if (options.coverUrl) {
    pool.push({
      id: 'novel-cover',
      title: options.novelTitle ?? 'Bìa truyện',
      category: 'Bìa truyện',
      url: options.coverUrl,
      keywords: [],
      dominantColor: '#7c5c2a',
      description: options.description?.slice(0, 160) ?? 'Ảnh bìa truyện',
    });
  }

  return [...pool, ...stockLibrary];
}

/**
 * Ghép phân cảnh cho toàn bộ phim: mỗi chương được chia thành các cụm
 * ~22 giây, mỗi cụm chọn một hình minh họa phù hợp ngữ nghĩa.
 */
export function buildStoryScenes(
  subtitles: SubtitleSegment[],
  markers: NarrationMarkers[],
  imagePool: StockImageItem[],
  options: {
    transition?: TransitionStyle;
    targetSceneSeconds?: number;
    durationSec?: number;
  } = {}
): SceneItem[] {
  if (subtitles.length === 0) return [];
  const transition = options.transition ?? 'crossfade';
  const targetSceneSeconds = options.targetSceneSeconds ?? DEFAULT_SCENE_SECONDS;

  const scenes: SceneItem[] = [];
  let sceneIndex = 0;
  let lastImageId = '';

  for (const marker of markers) {
    const chapterSubs = subtitles.filter(
      (sub) => sub.startTime >= marker.startTime - 0.01 && sub.startTime < marker.endTime
    );
    if (chapterSubs.length === 0) continue;

    // Chia phụ đề của chương thành các nhóm dài ~targetSceneSeconds.
    const groups: SubtitleSegment[][] = [];
    let group: SubtitleSegment[] = [];
    let groupStart = chapterSubs[0].startTime;

    for (const sub of chapterSubs) {
      group.push(sub);
      if (sub.endTime - groupStart >= targetSceneSeconds) {
        groups.push(group);
        group = [];
        groupStart = sub.endTime;
      }
    }
    if (group.length > 0) groups.push(group);

    for (const chunk of groups) {
      const text = chunk.map((sub) => sub.text).join(' ');
      const startTime = chunk[0].startTime;
      const endTime = chunk[chunk.length - 1].endTime;

      // Chấm điểm ảnh trên toàn bộ cụm phụ đề thay vì chỉ câu đầu tiên.
      const pick = (pool: StockImageItem[]) => {
        const synthetic: SubtitleSegment[] = [
          {
            id: 'group',
            startTime,
            endTime,
            text,
            keywords: [],
          },
        ];
        const matched = matchImagesToTimeline(
          synthetic,
          [],
          pool,
          Math.max(1, endTime - startTime),
          transition
        );
        return matched[0];
      };

      let picked = pick(imagePool);
      if (picked && picked.imageUrl === lastImageId && imagePool.length > 1) {
        const alternatives = imagePool.filter(
          (image) => image.url !== lastImageId
        );
        picked = pick(alternatives) ?? picked;
      }

      if (!picked) continue;
      lastImageId = picked.imageUrl;

      scenes.push({
        id: `scene-${sceneIndex + 1}`,
        startTime: Number(startTime.toFixed(2)),
        endTime: Number(endTime.toFixed(2)),
        imageUrl: picked.imageUrl,
        title: text.slice(0, 120),
        source: picked.source,
        transition: picked.transition,
        zoomDirection: picked.zoomDirection,
        matchedKeyword: picked.matchedKeyword,
      });
      sceneIndex += 1;
    }
  }

  return scenes;
}

/** Dựng file SRT để tải riêng (dùng cho YouTube hoặc phần mềm dựng phim khác). */
export function buildChapterSrt(subtitles: SubtitleSegment[]): string {
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  const stamp = (seconds: number) => {
    const clamped = Math.max(0, seconds);
    const h = Math.floor(clamped / 3600);
    const m = Math.floor((clamped % 3600) / 60);
    const s = Math.floor(clamped % 60);
    const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(Math.min(999, ms), 3)}`;
  };

  return subtitles
    .map(
      (sub, index) =>
        `${index + 1}\n${stamp(sub.startTime)} --> ${stamp(sub.endTime)}\n${sub.text}`
    )
    .join('\n\n');
}

/** Định dạng phút:giây gọn để hiển thị trên giao diện. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}g ${String(m).padStart(2, '0')}p`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
