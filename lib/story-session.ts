import type {ChapterCard, SceneItem, SubtitleSegment} from './video-engine';
import type {NarrationTimeline} from './narration-timeline';
import type {NarrationMarkers} from './story-pipeline';

export interface StorySession {
  timeline: NarrationTimeline;
  subtitles: SubtitleSegment[];
  scenes: SceneItem[];
  markers: NarrationMarkers[];
  chapterCards: ChapterCard[];
  durationSec: number;
  novelTitle: string;
  novelAuthor?: string;
  imageCache: Map<string, HTMLImageElement>;
  chunkCount: number;
}

export interface BuildState {
  status: 'idle' | 'running' | 'ready' | 'error';
  phase: 'chapters' | 'narration' | 'assembly' | 'done';
  message: string;
  chaptersDone: number;
  chaptersTotal: number;
  chunksDone: number;
  chunksTotal: number;
  startedAt: number;
  error?: string;
}

export const IDLE_BUILD: BuildState = {
  status: 'idle',
  phase: 'chapters',
  message: '',
  chaptersDone: 0,
  chaptersTotal: 0,
  chunksDone: 0,
  chunksTotal: 0,
  startedAt: 0,
};

export interface ExportState {
  status: 'idle' | 'running' | 'done' | 'error';
  percent: number;
  label: string;
  phase?: 'audio' | 'video' | 'finalizing';
  savedToDisk?: boolean;
  downloadUrl?: string;
  filename?: string;
  sizeMb?: number;
  resolutionLabel?: string;
  encodedWithAudio?: boolean;
  error?: string;
}
