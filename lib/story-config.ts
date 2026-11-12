import {
  ExportConfig,
  SubtitleStyleConfig,
  VisualEffectPreset,
  UploadedImageAsset,
} from './video-engine';
import {effectiveWordCount} from './story-pipeline';

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  tag: string;
}

/** Danh sách giọng đọc Gemini — phải khớp `ALLOWED_VOICES` ở lib/gemini-tts.ts. */
export const VOICES: VoiceOption[] = [
  {
    id: 'Kore',
    name: 'Kore',
    description: 'Giọng nữ ấm, nhịp kể chậm rãi',
    tag: 'Kể chuyện',
  },
  {
    id: 'Charon',
    name: 'Charon',
    description: 'Giọng nam trầm, nhiều chất điện ảnh',
    tag: 'Kiếm hiệp',
  },
  {
    id: 'Puck',
    name: 'Puck',
    description: 'Giọng nam trẻ, linh hoạt và nhanh',
    tag: 'Phiêu lưu',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    description: 'Giọng nam mạnh, dứt khoát',
    tag: 'Hành động',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    description: 'Giọng nữ nhẹ, trong và bay bổng',
    tag: 'Ngôn tình',
  },
  {
    id: 'Leda',
    name: 'Leda',
    description: 'Giọng nữ trẻ, tươi sáng',
    tag: 'Học đường',
  },
  {
    id: 'Orus',
    name: 'Orus',
    description: 'Giọng nam chắc, điềm tĩnh',
    tag: 'Trinh thám',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    description: 'Giọng nữ mềm, phù hợp huyền huyễn',
    tag: 'Huyền huyễn',
  },
];

export type SubtitlePresetId = 'cinematic' | 'noir' | 'clean';

export interface SubtitlePreset {
  id: SubtitlePresetId;
  label: string;
  description: string;
  style: SubtitleStyleConfig;
  effect: VisualEffectPreset;
}

export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  {
    id: 'cinematic',
    label: 'Điện ảnh ấm',
    description: 'Chữ lớn, viền tối, viền phim và hạt phim nhẹ',
    style: {
      fontSize: 'lg',
      position: 'bottom',
      boxStyle: 'scrim',
      highlightColor: '#f5d49f',
      showKaraokeHighlight: true,
      letterboxBars: true,
      filmGrain: true,
      vignette: true,
    },
    effect: 'cinematic-warm',
  },
  {
    id: 'noir',
    label: 'Đêm tối giản',
    description: 'Chữ trắng gọn, tương phản cao, không hiệu ứng thừa',
    style: {
      fontSize: 'md',
      position: 'bottom',
      boxStyle: 'outline',
      highlightColor: '#ffffff',
      showKaraokeHighlight: false,
      letterboxBars: true,
      filmGrain: false,
      vignette: true,
    },
    effect: 'cool-twilight',
  },
  {
    id: 'clean',
    label: 'Giấy cũ',
    description: 'Nền chữ đặc, tông phim nhựa, phù hợp truyện cổ trang',
    style: {
      fontSize: 'md',
      position: 'bottom',
      boxStyle: 'solid',
      highlightColor: '#e7b25f',
      showKaraokeHighlight: true,
      letterboxBars: false,
      filmGrain: true,
      vignette: false,
    },
    effect: 'vintage-film',
  },
];

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  resolution: '1080p',
  aspectRatio: '16:9',
  fps: 24,
  bitrateMbps: 4,
};

export interface StoryConfig {
  voice: string;
  preset: SubtitlePresetId;
  style: SubtitleStyleConfig;
  effect: VisualEffectPreset;
  gapSec: number;
  exportConfig: ExportConfig;
  images: UploadedImageAsset[];
}

export const DEFAULT_STORY_CONFIG: StoryConfig = {
  voice: 'Kore',
  preset: 'cinematic',
  style: {...SUBTITLE_PRESETS[0].style},
  effect: SUBTITLE_PRESETS[0].effect,
  gapSec: 0.9,
  exportConfig: DEFAULT_EXPORT_CONFIG,
  images: [],
};

export function getSubtitlePreset(id: SubtitlePresetId): SubtitlePreset {
  return SUBTITLE_PRESETS.find((preset) => preset.id === id) ?? SUBTITLE_PRESETS[0];
}

/** Đổi phong cách: sao chép style của preset vào cấu hình hiện tại. */
export function applySubtitlePreset(
  config: StoryConfig,
  id: SubtitlePresetId
): StoryConfig {
  const preset = getSubtitlePreset(id);
  return {
    ...config,
    preset: id,
    style: {...preset.style},
    effect: preset.effect,
  };
}

/** Ước lượng số lần gọi giọng đọc cho một chương. */
export function estimateCallsPerChapter(wordCount: number): number {
  return Math.max(1, Math.ceil(effectiveWordCount({wordCount}) / 75));
}

export const RESOLUTION_OPTIONS: {value: ExportConfig['resolution']; label: string}[] = [
  {value: '720p', label: '720p — nhẹ, nhanh'},
  {value: '1080p', label: '1080p — tiêu chuẩn'},
  {value: '1440p', label: '1440p — nét, nặng'},
];

export const ASPECT_OPTIONS: {value: ExportConfig['aspectRatio']; label: string}[] = [
  {value: '16:9', label: '16:9 — YouTube'},
  {value: '9:16', label: '9:16 — Shorts / TikTok'},
  {value: '1:1', label: '1:1 — vuông'},
];

export const FPS_OPTIONS: {value: ExportConfig['fps']; label: string}[] = [
  {value: 24, label: '24 fps'},
  {value: 30, label: '30 fps'},
];
