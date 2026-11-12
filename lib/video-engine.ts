export type TransitionStyle =
  | 'crossfade'
  | 'zoom-cut'
  | 'slide-left'
  | 'wipe-right'
  | 'flash-cut'
  | 'iris-reveal';

export type VisualEffectPreset =
  | 'none'
  | 'cinematic-warm'
  | 'noir-contrast'
  | 'vintage-film'
  | 'cool-twilight'
  | 'vibrant-editorial';

export interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  keywords?: string[];
}

export interface StockImageItem {
  id: string;
  title: string;
  category: string;
  url: string;
  keywords: string[];
  dominantColor: string;
  description: string;
}

export interface UploadedImageAsset {
  id: string;
  url: string;
  name: string;
}

export interface SceneItem {
  id: string;
  startTime: number;
  endTime: number;
  imageUrl: string;
  title: string;
  source: 'upload' | 'library';
  transition: TransitionStyle;
  zoomDirection: 'in' | 'out' | 'pan-left' | 'pan-right';
  matchedKeyword?: string;
}

export interface SubtitleStyleConfig {
  fontSize: 'sm' | 'md' | 'lg';
  position: 'bottom' | 'center' | 'top';
  boxStyle: 'scrim' | 'solid' | 'outline';
  highlightColor: string;
  showKaraokeHighlight: boolean;
  letterboxBars: boolean;
  filmGrain: boolean;
  vignette: boolean;
}

export interface ExportConfig {
  resolution: '720p' | '1080p' | '1440p';
  aspectRatio: '16:9' | '9:16' | '1:1';
  fps: 24 | 30 | 60;
  bitrateMbps: number;
}

export const BUILTIN_STOCK_LIBRARY: StockImageItem[] = [
  {
    id: 'stock-nature-sunrise',
    title: 'Bình minh trên đỉnh núi sương mù',
    category: 'Thiên nhiên & Khởi đầu',
    url: '/assets/images/scene_nature_sunrise_1794401649840.jpg',
    keywords: [
      'bình minh',
      'mặt trời',
      'núi',
      'hành trình',
      'khởi đầu',
      'ánh sáng',
      'ước mơ',
      'vươn lên',
      'tương lai',
      'sáng',
      'mây',
      'đỉnh cao',
      'sunrise',
      'mountain',
      'morning',
      'journey',
      'hope',
      'light',
      'sky',
    ],
    dominantColor: '#d97706',
    description: 'Ánh nắng ban mai chiếu qua biển mây trên dãy núi hùng vĩ',
  },
  {
    id: 'stock-urban-night',
    title: 'Nhịp sống đô thị lúc chạng vạng',
    category: 'Đô thị & Công nghệ',
    url: '/assets/images/scene_urban_night_1794401650620.jpg',
    keywords: [
      'thành phố',
      'đô thị',
      'đêm',
      'công nghệ',
      'hiện đại',
      'nhịp sống',
      'phố',
      'đèn',
      'kinh doanh',
      'kỷ nguyên',
      'sáng tạo',
      'chuyển động',
      'city',
      'urban',
      'night',
      'tech',
      'modern',
      'street',
      'future',
    ],
    dominantColor: '#2563eb',
    description: 'Đường chân trời thành phố hiện đại phản chiếu ánh đèn trên mặt đường',
  },
  {
    id: 'stock-ocean-waves',
    title: 'Sóng biển hoàng hôn tĩnh lặng',
    category: 'Biển cả & Cảm xúc',
    url: '/assets/images/scene_ocean_waves_1794401652559.jpg',
    keywords: [
      'biển',
      'sóng',
      'đại dương',
      'hoàng hôn',
      'bình yên',
      'ký ức',
      'nước',
      'chiều',
      'lắng đọng',
      'cảm xúc',
      'tâm hồn',
      'chân trời',
      'ocean',
      'sea',
      'waves',
      'sunset',
      'calm',
      'peace',
      'memory',
    ],
    dominantColor: '#0284c7',
    description: 'Sóng biển dịu êm vỗ bờ cát dưới ánh hoàng hôn vàng ấm',
  },
  {
    id: 'stock-creative-workspace',
    title: 'Góc làm việc sáng tạo & Kể chuyện',
    category: 'Đời sống & Tri thức',
    url: '/assets/images/scene_creative_workspace_1794401654634.jpg',
    keywords: [
      'sách',
      'viết',
      'cà phê',
      'học',
      'làm việc',
      'câu chuyện',
      'ý tưởng',
      'nhật ký',
      'tri thức',
      'âm nhạc',
      'nghệ thuật',
      'tập trung',
      'study',
      'work',
      'coffee',
      'book',
      'story',
      'camera',
      'creative',
    ],
    dominantColor: '#b45309',
    description: 'Bàn gỗ ấm áp bên khung cửa sổ ngập nắng với sổ tay và máy ảnh',
  },
  {
    id: 'stock-forest-path',
    title: 'Lối mòn rừng thông trong sương sớm',
    category: 'Khám phá & Sinh thái',
    url: '/assets/images/scene_forest_path_1794401654747.jpg',
    keywords: [
      'rừng',
      'cây',
      'thiên nhiên',
      'bước đi',
      'con đường',
      'khám phá',
      'xanh',
      'sương',
      'hơi thở',
      'tự do',
      'phiêu lưu',
      'yên tĩnh',
      'forest',
      'trees',
      'path',
      'nature',
      'walk',
      'green',
      'adventure',
    ],
    dominantColor: '#15803d',
    description: 'Tia nắng xuyên qua tán rừng thông cổ thụ phủ rêu xanh mướt',
  },
];

export const TRANSITION_OPTIONS: {
  id: TransitionStyle;
  label: string;
  description: string;
}[] = [
  {
    id: 'crossfade',
    label: 'Hòa tan mềm (Crossfade)',
    description: 'Chuyển cảnh mượt mà giữa hai khung hình theo nhịp nhạc',
  },
  {
    id: 'zoom-cut',
    label: 'Phóng cận cảnh (Dynamic Zoom)',
    description: 'Thu phóng chiều sâu điện ảnh kết hợp mờ dần',
  },
  {
    id: 'slide-left',
    label: 'Trượt ngang (Cinema Slide)',
    description: 'Đẩy khung hình mới từ phải sang trái tạo nhịp điệu nhanh',
  },
  {
    id: 'wipe-right',
    label: 'Quét màn ảnh (Linear Wipe)',
    description: 'Quét dải phân cách sắc nét dọc theo khung hình',
  },
  {
    id: 'flash-cut',
    label: 'Chớp sáng phim (Film Flash)',
    description: 'Hiệu ứng lóe sáng máy ảnh phim cổ điển khi đổi cảnh',
  },
  {
    id: 'iris-reveal',
    label: 'Mở khẩu độ (Iris Reveal)',
    description: 'Mở rộng vòng tròn tâm điểm từ giữa khung hình',
  },
];

export const VISUAL_EFFECT_OPTIONS: {
  id: VisualEffectPreset;
  label: string;
  description: string;
  cssFilter: string;
}[] = [
  {
    id: 'none',
    label: 'Nguyên bản (Original)',
    description: 'Giữ nguyên độ tương phản và màu sắc gốc của ảnh',
    cssFilter: 'none',
  },
  {
    id: 'cinematic-warm',
    label: 'Điện ảnh ấm (Kodak Gold)',
    description: 'Tông vàng hổ phách ấm áp, tăng độ sâu vùng tối',
    cssFilter: 'contrast(1.08) saturate(1.18) sepia(0.14)',
  },
  {
    id: 'cool-twilight',
    label: 'Chạng vạng xanh (Teal & Blue)',
    description: 'Sắc lạnh hiện đại phù hợp chủ đề công nghệ và đô thị',
    cssFilter: 'contrast(1.12) saturate(0.92) hue-rotate(-8deg)',
  },
  {
    id: 'vintage-film',
    label: 'Phim nhựa 35mm (Retro Film)',
    description: 'Giảm bão hòa nhẹ, phủ lớp màu hoài niệm thập niên 90',
    cssFilter: 'contrast(0.95) brightness(1.03) sepia(0.28) saturate(0.85)',
  },
  {
    id: 'noir-contrast',
    label: 'Đen trắng nghệ thuật (Monochrome)',
    description: 'Tương phản cao đen trắng làm nổi bật phụ đề',
    cssFilter: 'grayscale(1) contrast(1.22) brightness(0.98)',
  },
  {
    id: 'vibrant-editorial',
    label: 'Rực rỡ sắc nét (HDR Editorial)',
    description: 'Tăng cường độ tươi và chi tiết cho khung cảnh thiên nhiên',
    cssFilter: 'contrast(1.14) saturate(1.32)',
  },
];

/**
 * Parse a timestamp string like "00:01:23,450" or "01:23.45" or "01:23" into seconds
 */
export function parseTimestampToSeconds(ts: string): number {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':').map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

/**
 * Format seconds into SRT timestamp "HH:MM:SS,mmm"
 */
export function formatSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return (
    String(hrs).padStart(2, '0') +
    ':' +
    String(mins).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    ',' +
    String(Math.min(999, ms)).padStart(3, '0')
  );
}

/**
 * Format seconds into clean display timecode "MM:SS.d"
 */
export function formatDisplayTimecode(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped - Math.floor(clamped)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

/**
 * Extract salient keywords from a Vietnamese or English text line
 */
export function extractKeywordsFromText(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[.,!?;:"'()\[\]\-—]/g, ' ')
    .trim();
  if (!normalized) return [];
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  return Array.from(new Set(words));
}

/**
 * Parses SRT, bracketed timestamps "[00:05] text", or plain text lines into timed SubtitleSegments.
 * Automatically aligns total duration when timestamps are missing.
 */
export function parseSrtOrTextToSubtitles(
  rawInput: string,
  totalDurationSec: number = 24
): SubtitleSegment[] {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const safeDuration = Math.max(4, totalDurationSec);

  // 1. Check for standard SRT blocks (contains "-->")
  if (trimmed.includes('-->')) {
    const blocks = trimmed.split(/\r?\n\s*\r?\n/);
    const segments: SubtitleSegment[] = [];
    blocks.forEach((block, idx) => {
      const lines = block
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIdx !== -1) {
        const [startRaw, endRaw] = lines[timeLineIdx].split('-->');
        const startTime = parseTimestampToSeconds(startRaw);
        const endTime = Math.max(
          startTime + 0.8,
          parseTimestampToSeconds(endRaw)
        );
        const textLines = lines.slice(timeLineIdx + 1).join(' ');
        if (textLines) {
          segments.push({
            id: `sub-${idx + 1}`,
            startTime: Number(startTime.toFixed(2)),
            endTime: Number(endTime.toFixed(2)),
            text: textLines,
            keywords: extractKeywordsFromText(textLines),
          });
        }
      }
    });
    if (segments.length > 0) {
      return segments;
    }
  }

  // 2. Check for bracketed timestamp lines like "[00:03.5] Lời thoại..."
  const rawLines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bracketRegex = /^\[?(\d{1,2}:\d{2}(?:[.,]\d+)?)\]?\s*(.+)$/;
  const hasBracketTimestamps = rawLines.some((l) => bracketRegex.test(l));

  if (hasBracketTimestamps) {
    const temp: { startTime: number; text: string }[] = [];
    for (const line of rawLines) {
      const match = line.match(bracketRegex);
      if (match) {
        temp.push({
          startTime: parseTimestampToSeconds(match[1]),
          text: match[2].trim(),
        });
      }
    }
    if (temp.length > 0) {
      return temp.map((item, idx) => {
        const nextStart =
          idx < temp.length - 1
            ? temp[idx + 1].startTime
            : Math.max(item.startTime + 3.5, safeDuration);
        return {
          id: `sub-${idx + 1}`,
          startTime: Number(item.startTime.toFixed(2)),
          endTime: Number(Math.max(item.startTime + 1, nextStart).toFixed(2)),
          text: item.text,
          keywords: extractKeywordsFromText(item.text),
        };
      });
    }
  }

  // 3. Plain text: split by lines or sentences and distribute proportionally by word count
  let sentences = rawLines;
  if (sentences.length === 1 && sentences[0].length > 70) {
    sentences = sentences[0]
      .split(/(?<=[.!?।])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const wordWeights = sentences.map((s) =>
    Math.max(3, s.split(/\s+/).filter(Boolean).length)
  );
  const totalWeight = wordWeights.reduce((acc, w) => acc + w, 0);

  let cursor = 0;
  return sentences.map((sentence, idx) => {
    const share = (wordWeights[idx] / totalWeight) * safeDuration;
    const startTime = cursor;
    const endTime =
      idx === sentences.length - 1 ? safeDuration : cursor + share;
    cursor = endTime;
    return {
      id: `sub-${idx + 1}`,
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(endTime.toFixed(2)),
      text: sentence,
      keywords: extractKeywordsFromText(sentence),
    };
  });
}

/**
 * Convert SubtitleSegment[] back to standard SRT format string
 */
export function exportSubtitlesToSrt(subtitles: SubtitleSegment[]): string {
  return subtitles
    .map((sub, index) => {
      return `${index + 1}\n${formatSrtTimestamp(sub.startTime)} --> ${formatSrtTimestamp(sub.endTime)}\n${sub.text}`;
    })
    .join('\n\n');
}

/**
 * Score a stock library item against a text/keyword query
 */
export function scoreStockItemForText(
  item: StockImageItem,
  text: string
): { score: number; matchedKeyword?: string } {
  const lowerText = text.toLowerCase();
  let score = 0;
  let matchedKeyword: string | undefined;

  for (const kw of item.keywords) {
    const lowerKw = kw.toLowerCase();
    if (lowerText.includes(lowerKw)) {
      const points = lowerKw.includes(' ') ? 5 : 3;
      score += points;
      if (!matchedKeyword) {
        matchedKeyword = kw;
      }
    }
  }
  return { score, matchedKeyword };
}

/**
 * Automatically matches and synchronizes images to subtitle segments (or beat intervals).
 * If uploadedImages is empty, searches BUILTIN_STOCK_LIBRARY for contextually relevant images.
 */
export function matchImagesToTimeline(
  subtitles: SubtitleSegment[],
  uploadedImages: UploadedImageAsset[],
  stockLibrary: StockImageItem[] = BUILTIN_STOCK_LIBRARY,
  totalDurationSec: number = 24,
  defaultTransition: TransitionStyle = 'crossfade'
): SceneItem[] {
  const safeDuration = Math.max(
    4,
    subtitles.length > 0
      ? Math.max(totalDurationSec, subtitles[subtitles.length - 1].endTime)
      : totalDurationSec
  );

  const zoomCycle: SceneItem['zoomDirection'][] = [
    'in',
    'pan-right',
    'out',
    'pan-left',
  ];

  // Determine time intervals based on subtitles (grouping short subtitles or 1-to-1)
  const intervals: { startTime: number; endTime: number; text: string }[] = [];
  if (subtitles.length > 0) {
    for (let i = 0; i < subtitles.length; i++) {
      const seg = subtitles[i];
      const prevEnd = i === 0 ? 0 : intervals[intervals.length - 1].endTime;
      const startTime = i === 0 ? 0 : prevEnd;
      const endTime =
        i === subtitles.length - 1 ? safeDuration : seg.endTime;
      intervals.push({
        startTime: Number(startTime.toFixed(2)),
        endTime: Number(Math.max(startTime + 1, endTime).toFixed(2)),
        text: seg.text,
      });
    }
  } else {
    // No subtitles yet: divide totalDurationSec into 5 balanced scenes
    const sceneCount = Math.max(
      1,
      uploadedImages.length > 0 ? uploadedImages.length : 5
    );
    const step = safeDuration / sceneCount;
    for (let i = 0; i < sceneCount; i++) {
      intervals.push({
        startTime: Number((i * step).toFixed(2)),
        endTime: Number(((i + 1) * step).toFixed(2)),
        text: '',
      });
    }
  }

  let lastPickedStockId = '';

  return intervals.map((interval, idx) => {
    // If user uploaded images, use them first (cycling if fewer than intervals)
    if (uploadedImages.length > 0) {
      const asset = uploadedImages[idx % uploadedImages.length];
      return {
        id: `scene-${idx + 1}`,
        startTime: interval.startTime,
        endTime: interval.endTime,
        imageUrl: asset.url,
        title: asset.name,
        source: 'upload',
        transition: defaultTransition,
        zoomDirection: zoomCycle[idx % zoomCycle.length],
      };
    }

    // Otherwise, automatically search the stock library for the best contextual illustration
    let bestItem = stockLibrary[idx % stockLibrary.length];
    let bestScore = -1;
    let bestKeyword: string | undefined;

    for (const candidate of stockLibrary) {
      const { score, matchedKeyword } = scoreStockItemForText(
        candidate,
        interval.text
      );
      // Avoid immediate repetition unless strongly matched
      const repetitionPenalty = candidate.id === lastPickedStockId ? -2 : 0;
      const effectiveScore = score + repetitionPenalty;
      if (effectiveScore > bestScore) {
        bestScore = effectiveScore;
        bestItem = candidate;
        bestKeyword = matchedKeyword;
      }
    }

    // If no keyword matched at all (score <= 0), pick deterministically from library avoiding repeat
    if (bestScore <= 0) {
      const available = stockLibrary.filter((s) => s.id !== lastPickedStockId);
      bestItem =
        available.length > 0
          ? available[idx % available.length]
          : stockLibrary[0];
      bestKeyword = bestItem.category;
    }

    lastPickedStockId = bestItem.id;

    return {
      id: `scene-${idx + 1}`,
      startTime: interval.startTime,
      endTime: interval.endTime,
      imageUrl: bestItem.url,
      title: bestItem.title,
      source: 'library',
      transition: defaultTransition,
      zoomDirection: zoomCycle[idx % zoomCycle.length],
      matchedKeyword: bestKeyword || bestItem.category,
    };
  });
}

/**
 * Given a playback timestamp (in seconds), computes the active scene,
 * previous scene (if currently inside a transition window), transition progress (0..1),
 * active subtitle segment, and active word progress.
 */
export function getRenderStateAtTime(
  timeSec: number,
  scenes: SceneItem[],
  subtitles: SubtitleSegment[],
  transitionDurationSec: number = 0.8
) {
  const clampedTime = Math.max(0, timeSec);

  // Active scene
  let activeSceneIndex = scenes.findIndex(
    (s) => clampedTime >= s.startTime && clampedTime <= s.endTime
  );
  if (activeSceneIndex === -1 && scenes.length > 0) {
    activeSceneIndex =
      clampedTime < scenes[0].startTime ? 0 : scenes.length - 1;
  }

  const activeScene = activeSceneIndex >= 0 ? scenes[activeSceneIndex] : null;
  const previousScene =
    activeSceneIndex > 0 ? scenes[activeSceneIndex - 1] : null;

  let isTransitioning = false;
  let transitionProgress = 1;

  if (activeScene && previousScene) {
    const timeIntoScene = clampedTime - activeScene.startTime;
    const effectiveTransDur = Math.min(
      transitionDurationSec,
      (activeScene.endTime - activeScene.startTime) * 0.45
    );
    if (timeIntoScene >= 0 && timeIntoScene < effectiveTransDur && effectiveTransDur > 0) {
      isTransitioning = true;
      transitionProgress = Number((timeIntoScene / effectiveTransDur).toFixed(4));
    }
  }

  const sceneProgress =
    activeScene && activeScene.endTime > activeScene.startTime
      ? Math.min(
          1,
          Math.max(
            0,
            (clampedTime - activeScene.startTime) /
              (activeScene.endTime - activeScene.startTime)
          )
        )
      : 0;

  // Active subtitle
  const activeSubtitle =
    subtitles.find(
      (sub) => clampedTime >= sub.startTime && clampedTime <= sub.endTime
    ) || null;

  let activeWordIndex = -1;
  let words: string[] = [];
  if (activeSubtitle) {
    words = activeSubtitle.text.split(/\s+/).filter(Boolean);
    const subDur = Math.max(0.1, activeSubtitle.endTime - activeSubtitle.startTime);
    const subRatio = Math.min(
      0.999,
      Math.max(0, (clampedTime - activeSubtitle.startTime) / subDur)
    );
    activeWordIndex = Math.floor(subRatio * words.length);
  }

  return {
    activeScene,
    activeSceneIndex,
    previousScene,
    isTransitioning,
    transitionProgress,
    sceneProgress,
    activeSubtitle,
    words,
    activeWordIndex,
  };
}

/**
 * Returns pixel width and height for export based on resolution and aspect ratio
 */
export function getResolutionDimensions(
  resolution: ExportConfig['resolution'],
  aspectRatio: ExportConfig['aspectRatio']
): { width: number; height: number } {
  const baseLongEdge =
    resolution === '1440p' ? 2560 : resolution === '1080p' ? 1920 : 1280;
  const baseShortEdge =
    resolution === '1440p' ? 1440 : resolution === '1080p' ? 1080 : 720;

  if (aspectRatio === '16:9') {
    return { width: baseLongEdge, height: baseShortEdge };
  }
  if (aspectRatio === '9:16') {
    return { width: baseShortEdge, height: baseLongEdge };
  }
  return { width: baseShortEdge, height: baseShortEdge };
}

export const DEFAULT_DEMO_SUBTITLES_SRT = `1
00:00:00,000 --> 00:00:04,800
Mỗi hành trình lớn đều bắt đầu từ ánh bình minh trên đỉnh núi cao.

2
00:00:04,800 --> 00:00:09,600
Giữa nhịp sống thành phố hiện đại, những ý tưởng công nghệ không ngừng chuyển động.

3
00:00:09,600 --> 00:00:14,400
Tại góc làm việc nhỏ bên tách cà phê, từng câu chuyện sáng tạo được viết nên.

4
00:00:14,400 --> 00:00:19,200
Bước chân khám phá lối mòn rừng xanh để tìm lại hơi thở tự do của thiên nhiên.

5
00:00:19,200 --> 00:00:24,000
Và lắng nghe tiếng sóng biển hoàng hôn vỗ về những ký ức bình yên.`;
