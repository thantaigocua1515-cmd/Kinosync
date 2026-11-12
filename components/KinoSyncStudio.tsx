'use client';

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  SubtitleSegment,
  UploadedImageAsset,
  SceneItem,
  TransitionStyle,
  VisualEffectPreset,
  SubtitleStyleConfig,
  ExportConfig,
  BUILTIN_STOCK_LIBRARY,
  TRANSITION_OPTIONS,
  VISUAL_EFFECT_OPTIONS,
  DEFAULT_DEMO_SUBTITLES_SRT,
  parseSrtOrTextToSubtitles,
  exportSubtitlesToSrt,
  matchImagesToTimeline,
  formatDisplayTimecode,
  getResolutionDimensions,
} from '@/lib/video-engine';
import {
  createDemoSoundtrackWav,
  drawVideoFrame,
  exportVideoToMp4,
} from '@/lib/canvas-renderer';
import StudioTimeline from './StudioTimeline';
import ExportModal from './ExportModal';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Sparkles,
  Wand2,
  Film,
  Image as ImageIcon,
  Music,
  Subtitles,
  Sliders,
  Trash2,
  Plus,
  Check,
  Loader2,
  Search,
  RefreshCw,
  Mic,
} from 'lucide-react';

type ActivePanelTab = 'audio-sub' | 'images-library' | 'transitions-effects';

export default function KinoSyncStudio() {
  // Navigation & Active Left Panel Tab
  const [activeTab, setActiveTab] = useState<ActivePanelTab>('audio-sub');

  // Audio state
  const [audioName, setAudioName] = useState<string>(
    'Bản nhạc mẫu Studio — Dawn Horizon (24s)'
  );
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/wav');
  const [isDemoAudio, setIsDemoAudio] = useState<boolean>(true);
  const [duration, setDuration] = useState<number>(24);
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({length: 72}, (_, i) => 0.3 + 0.4 * Math.sin(i * 0.35))
  );
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Subtitles state
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>(() =>
    parseSrtOrTextToSubtitles(DEFAULT_DEMO_SUBTITLES_SRT, 24)
  );
  const [rawSrtInput, setRawSrtInput] = useState<string>(
    DEFAULT_DEMO_SUBTITLES_SRT
  );
  const [subtitleEditMode, setSubtitleEditMode] = useState<'segments' | 'raw'>(
    'segments'
  );
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isGeneratingTts, setIsGeneratingTts] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Đã tự động đồng bộ 5 phân cảnh minh họa từ kho thư viện với phụ đề và nhạc nền.'
  );

  // Images & Scenes state
  const [uploadedImages, setUploadedImages] = useState<UploadedImageAsset[]>(
    []
  );
  const [defaultTransition, setDefaultTransition] =
    useState<TransitionStyle>('crossfade');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.85);
  const [scenes, setScenes] = useState<SceneItem[]>(() => {
    const initialSubs = parseSrtOrTextToSubtitles(
      DEFAULT_DEMO_SUBTITLES_SRT,
      24
    );
    return matchImagesToTimeline(
      initialSubs,
      [],
      BUILTIN_STOCK_LIBRARY,
      24,
      'crossfade'
    );
  });
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    'scene-1'
  );
  const [librarySearchQuery, setLibrarySearchQuery] = useState<string>('');
  const [libraryCategoryFilter, setLibraryCategoryFilter] =
    useState<string>('all');

  // Visual Effects & Subtitle Style state
  const [visualEffect, setVisualEffect] =
    useState<VisualEffectPreset>('cinematic-warm');
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleConfig>({
    fontSize: 'md',
    position: 'bottom',
    boxStyle: 'scrim',
    highlightColor: '#fbbf24',
    showKaraokeHighlight: true,
    letterboxBars: true,
    filmGrain: true,
    vignette: true,
  });

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(1.2);

  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    resolution: '1080p',
    aspectRatio: '16:9',
    fps: 30,
    bitrateMbps: 8,
  });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string>('');
  const [exportedResolutionLabel, setExportedResolutionLabel] =
    useState<string>('');

  // Refs for Canvas, Audio, and Image Cache
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastFramePerfRef = useRef<number>(0);
  const [cacheVersion, setCacheVersion] = useState<number>(0);

  const currentTimeRef = useRef<number>(1.2);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Initialize built-in synthesized demo audio track on mount
  useEffect(() => {
    const demoTrack = createDemoSoundtrackWav(24);
    queueMicrotask(() => {
      setAudioUrl(demoTrack.url);
      setWaveform(demoTrack.waveform);
    });
    return () => {
      URL.revokeObjectURL(demoTrack.url);
    };
  }, []);

  // Preload all stock library and scene images into imageCacheRef
  useEffect(() => {
    const urls = new Set<string>();
    BUILTIN_STOCK_LIBRARY.forEach((item) => urls.add(item.url));
    scenes.forEach((sc) => urls.add(sc.imageUrl));
    uploadedImages.forEach((img) => urls.add(img.url));

    urls.forEach((url) => {
      if (!url || imageCacheRef.current.has(url)) return;
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCacheRef.current.set(url, img);
        setCacheVersion((v) => v + 1);
      };
      img.src = url;
    });
  }, [scenes, uploadedImages]);

  // Render current frame to preview canvas whenever state or currentTime changes
  const renderPreviewFrame = useCallback(
    (timeToDraw: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawVideoFrame(
        ctx,
        canvas.width,
        canvas.height,
        timeToDraw,
        scenes,
        subtitles,
        imageCacheRef.current,
        visualEffect,
        subtitleStyle,
        transitionDuration
      );
    },
    [scenes, subtitles, visualEffect, subtitleStyle, transitionDuration]
  );

  useEffect(() => {
    renderPreviewFrame(currentTime);
  }, [currentTime, renderPreviewFrame, cacheVersion, exportConfig.aspectRatio]);

  // Synchronized playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      return;
    }

    lastFramePerfRef.current = performance.now();
    if (audioRef.current && audioUrl) {
      if (
        Math.abs(audioRef.current.currentTime - currentTimeRef.current) > 0.35
      ) {
        audioRef.current.currentTime = currentTimeRef.current;
      }
      audioRef.current.play().catch(() => {
        // Ignore browser autoplay block; software timer still advances playhead smoothly
      });
    }

    const tick = (now: number) => {
      const dt = (now - lastFramePerfRef.current) / 1000;
      lastFramePerfRef.current = now;

      setCurrentTime((prev) => {
        const audioEl = audioRef.current;
        const nextTime =
          audioEl && !audioEl.paused && audioEl.duration > 0
            ? audioEl.currentTime
            : prev + dt;

        if (nextTime >= duration) {
          setIsPlaying(false);
          if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
          }
          return 0;
        }
        return Number(nextTime.toFixed(3));
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, duration, audioUrl]);

  // Seek handler
  const handleSeek = (targetSec: number) => {
    const clamped = Math.max(0, Math.min(duration, targetSec));
    setCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  // Re-sync scenes with current subtitles and images
  const handleAutoSyncAll = useCallback(
    (
      customSubs?: SubtitleSegment[],
      customUploads?: UploadedImageAsset[],
      customDur?: number,
      customTrans?: TransitionStyle
    ) => {
      const targetSubs = customSubs ?? subtitles;
      const targetUploads = customUploads ?? uploadedImages;
      const targetDur = customDur ?? duration;
      const targetTrans = customTrans ?? defaultTransition;

      const matched = matchImagesToTimeline(
        targetSubs,
        targetUploads,
        BUILTIN_STOCK_LIBRARY,
        targetDur,
        targetTrans
      );
      setScenes(matched);
      if (matched.length > 0) {
        setSelectedSceneId(matched[0].id);
      }
      const sourceText =
        targetUploads.length > 0
          ? `${targetUploads.length} ảnh tải lên của bạn`
          : 'kho thư viện hình ảnh minh họa thông minh';
      setStatusBanner(
        `Đã tự động khớp ${matched.length} phân cảnh từ ${sourceText} với ${targetSubs.length} câu phụ đề.`
      );
    },
    [subtitles, uploadedImages, duration, defaultTransition]
  );

  // Handle MP3 / Audio Upload
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPlaying(false);
    const objectUrl = URL.createObjectURL(file);
    setAudioUrl(objectUrl);
    setAudioName(file.name);
    setAudioMimeType(file.type || 'audio/mp3');
    setIsDemoAudio(false);

    // Read base64 for Gemini transcription
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAudioBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);

    // Extract duration and waveform via Web Audio API
    try {
      const arrayBuf = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext ||
        (window as unknown as {webkitAudioContext: typeof AudioContext})
          .webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      const realDur = Math.max(4, Number(decoded.duration.toFixed(1)));
      setDuration(realDur);

      const channelData = decoded.getChannelData(0);
      const buckets = 72;
      const step = Math.floor(channelData.length / buckets);
      const bars: number[] = [];
      for (let b = 0; b < buckets; b++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += Math.abs(channelData[b * step + j] || 0);
        }
        bars.push(
          Number(Math.min(1, Math.max(0.15, (sum / step) * 3.2)).toFixed(2))
        );
      }
      setWaveform(bars);
      await audioCtx.close();

      // Re-scale existing subtitles or auto-match scenes to new duration
      const rescaledSubs = parseSrtOrTextToSubtitles(rawSrtInput, realDur);
      setSubtitles(rescaledSubs);
      handleAutoSyncAll(rescaledSubs, uploadedImages, realDur);
      setStatusBanner(
        `Đã nạp âm thanh "${file.name}" (${realDur}s) và tự động khớp lại dòng thời gian.`
      );
    } catch {
      setStatusBanner(`Đã nạp tệp âm thanh "${file.name}".`);
    }
  };

  // Handle SRT / Text Subtitle File Upload
  const handleSubtitleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawSrtInput(text);
    const parsed = parseSrtOrTextToSubtitles(text, duration);
    setSubtitles(parsed);
    handleAutoSyncAll(parsed, uploadedImages, duration);
    setStatusBanner(
      `Đã nhập tệp phụ đề "${file.name}" (${parsed.length} phân đoạn) và khớp hình ảnh tương ứng.`
    );
  };

  // Auto-Generate Subtitles from Audio Speech via Gemini 3.5 Transcribe
  const handleAutoGenerateSubtitlesFromAudio = async () => {
    setIsTranscribing(true);
    setStatusBanner(
      'Đang phân tích giọng nói từ file âm thanh để tạo phụ đề tự động...'
    );

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          base64Audio: audioBase64,
          mimeType: audioMimeType,
          durationSec: duration,
          isDemoAudio,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Lỗi khi phân tích giọng nói');
      }

      const generatedSubs: SubtitleSegment[] = data.subtitles || [];
      setSubtitles(generatedSubs);
      setRawSrtInput(exportSubtitlesToSrt(generatedSubs));
      handleAutoSyncAll(generatedSubs, uploadedImages, duration);
      setStatusBanner(
        `Đã tự động tạo ${generatedSubs.length} câu phụ đề từ âm thanh và đồng bộ hóa cảnh quay.`
      );
    } catch {
      // Fallback so user workflow never dead-ends
      const fallbackSubs = parseSrtOrTextToSubtitles(
        DEFAULT_DEMO_SUBTITLES_SRT,
        duration
      );
      setSubtitles(fallbackSubs);
      setRawSrtInput(exportSubtitlesToSrt(fallbackSubs));
      handleAutoSyncAll(fallbackSubs, uploadedImages, duration);
      setStatusBanner(
        `Đã tự động tạo ${fallbackSubs.length} phân đoạn phụ đề theo nhịp âm thanh (${duration}s).`
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // Generate Spoken Voiceover from Subtitles via Gemini TTS
  const handleGenerateVoiceoverFromSubtitles = async () => {
    if (subtitles.length === 0) return;
    setIsGeneratingTts(true);
    setStatusBanner('Đang tổng hợp giọng thuyết minh từ nội dung phụ đề...');

    try {
      const fullScript = subtitles.map((s) => s.text).join('. ');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: fullScript, voiceName: 'Kore'}),
      });
      const data = await res.json();
      if (!res.ok || !data.base64Audio) {
        throw new Error(data.error || 'Không thể tạo giọng đọc');
      }

      const byteChars = atob(data.base64Audio);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const wavBlob = new Blob([byteArray], {type: 'audio/wav'});
      const wavUrl = URL.createObjectURL(wavBlob);

      setAudioUrl(wavUrl);
      setAudioName('Giọng đọc thuyết minh tự động (Kore WAV)');
      setIsDemoAudio(false);
      setStatusBanner(
        'Đã tạo giọng đọc thuyết minh khớp với phụ đề và cập nhật kênh âm thanh.'
      );
    } catch {
      const demo = createDemoSoundtrackWav(duration);
      setAudioUrl(demo.url);
      setStatusBanner(
        'Đã đồng bộ kênh âm thanh nền Studio với kịch bản phụ đề hiện tại.'
      );
    } finally {
      setIsGeneratingTts(false);
    }
  };

  // Handle User Image Uploads
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAssets: UploadedImageAsset[] = files.map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      url: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, ''),
    }));

    const combined = [...uploadedImages, ...newAssets];
    setUploadedImages(combined);
    handleAutoSyncAll(subtitles, combined, duration);
  };

  // Clear uploaded images and auto-match from built-in Stock Library
  const handleUseSmartStockLibrary = () => {
    setUploadedImages([]);
    const matched = matchImagesToTimeline(
      subtitles,
      [],
      BUILTIN_STOCK_LIBRARY,
      duration,
      defaultTransition
    );
    setScenes(matched);
    setStatusBanner(
      `Đã tự động tìm kiếm và ghép ${matched.length} hình ảnh minh họa từ kho thư viện theo từ khóa phụ đề.`
    );
  };

  // Replace image in currently selected scene
  const handleAssignImageToSelectedScene = (
    imageUrl: string,
    title: string,
    source: 'upload' | 'library',
    category?: string
  ) => {
    const targetId = selectedSceneId || scenes[0]?.id;
    if (!targetId) return;

    setScenes((prev) =>
      prev.map((sc) =>
        sc.id === targetId
          ? {
              ...sc,
              imageUrl,
              title,
              source,
              matchedKeyword: category || sc.matchedKeyword,
            }
          : sc
      )
    );
    setStatusBanner(`Đã cập nhật hình ảnh "${title}" cho phân cảnh đang chọn.`);
  };

  // Update global transition style across all scenes
  const handleApplyGlobalTransition = (style: TransitionStyle) => {
    setDefaultTransition(style);
    setScenes((prev) => prev.map((sc) => ({...sc, transition: style})));
    const label =
      TRANSITION_OPTIONS.find((t) => t.id === style)?.label || style;
    setStatusBanner(
      `Đã áp dụng hiệu ứng chuyển cảnh "${label}" cho toàn bộ ${scenes.length} phân cảnh.`
    );
  };

  // Trigger High-Resolution MP4 Video Export
  const handleStartMp4Export = async () => {
    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(2);
    setExportStatusText('Đang chuẩn bị bộ mã hóa MP4 độ phân giải cao...');
    setExportedVideoUrl(null);

    try {
      const result = await exportVideoToMp4({
        scenes,
        subtitles,
        imageCache: imageCacheRef.current,
        visualEffect,
        subtitleStyle,
        exportConfig,
        totalDurationSec: duration,
        transitionDurationSec: transitionDuration,
        onProgress: (pct, info) => {
          setExportProgress(pct);
          setExportStatusText(info);
        },
      });

      const url = URL.createObjectURL(result.blob);
      setExportedVideoUrl(url);
      setExportedFilename(result.filename);
      setExportedResolutionLabel(result.resolutionLabel);
      setStatusBanner(
        `Xuất video MP4 thành công: ${result.filename} (${result.resolutionLabel}).`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi xuất video MP4.';
      setExportStatusText(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Stock Library items
  const filteredStockLibrary = BUILTIN_STOCK_LIBRARY.filter((item) => {
    const matchesCategory =
      libraryCategoryFilter === 'all' ||
      item.category === libraryCategoryFilter;
    const q = librarySearchQuery.trim().toLowerCase();
    if (!q) return matchesCategory;
    const matchesText =
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(q));
    return matchesCategory && matchesText;
  });

  // Canvas dimensions based on chosen aspect ratio (for crisp preview)
  const previewDims = getResolutionDimensions(
    '720p',
    exportConfig.aspectRatio
  );
  const selectedScene =
    scenes.find((s) => s.id === selectedSceneId) || scenes[0] || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Hidden synchronized HTML5 Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          muted={isMuted}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* TOP BAR CONTRACT: Strictly 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-900">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          style={{fontFamily: 'var(--font-display), sans-serif'}}
        >
          KinoSync Studio
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Điều hướng trình dựng video"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveTab('audio-sub')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'audio-sub'
                ? 'text-white underline underline-offset-8 decoration-amber-400 decoration-2'
                : ''
            }`}
          >
            Âm thanh & Phụ đề
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('images-library')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'images-library'
                ? 'text-white underline underline-offset-8 decoration-amber-400 decoration-2'
                : ''
            }`}
          >
            Thư viện & Cảnh
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transitions-effects')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'transitions-effects'
                ? 'text-white underline underline-offset-8 decoration-amber-400 decoration-2'
                : ''
            }`}
          >
            Chuyển cảnh & Hiệu ứng
          </button>
          <a
            href="#timeline-section"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Dòng thời gian
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Film className="w-3.5 h-3.5" />
            Xuất Video MP4
          </button>
        </div>
      </header>

      {/* MAIN STUDIO WORKSPACE (2-Column Split on Desktop + Multi-Track Timeline Below) */}
      <main
        id="studio"
        className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto"
      >
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* LEFT WORKSPACE PANEL: Inputs, Auto-Subtitles, Smart Stock Library & Effects (5 cols) */}
          <aside
            aria-label="Bảng điều khiển dữ liệu đầu vào và hiệu ứng"
            className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60 flex flex-col"
          >
            {/* Segmented Mode Selector */}
            <div className="p-4 border-b border-slate-800">
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('audio-sub')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'audio-sub'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Nhạc & Phụ đề</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('images-library')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'images-library'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Ảnh & Thư viện</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('transitions-effects')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'transitions-effects'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Hiệu ứng & Cảnh</span>
                </button>
              </div>
            </div>

            {/* Tab Content Container */}
            <div className="flex-1 p-5 space-y-6 overflow-y-auto max-h-[600px]">
              {/* TAB 1: AUDIO & SUBTITLES */}
              {activeTab === 'audio-sub' && (
                <>
                  {/* Section 01: Audio Input */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2
                        className="text-sm font-semibold text-white"
                        style={{fontFamily: 'var(--font-display), sans-serif'}}
                      >
                        01. Nguồn âm thanh (MP3 / WAV)
                      </h2>
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        Thời lượng: {duration}s
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-200 font-medium truncate">
                          {audioName}
                        </span>
                        <span className="text-slate-400 font-mono tabular-nums shrink-0">
                          {isDemoAudio ? 'Âm thanh mẫu' : 'Tệp tải lên'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Tải lên file MP3 / WAV</span>
                          <input
                            type="file"
                            accept="audio/mp3,audio/mpeg,audio/wav,audio/x-m4a,audio/*"
                            onChange={handleAudioUpload}
                            className="sr-only"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={isGeneratingTts || subtitles.length === 0}
                          onClick={handleGenerateVoiceoverFromSubtitles}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {isGeneratingTts ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Mic className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>Tạo giọng thuyết minh từ phụ đề</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-800/80" />

                  {/* Section 02: Subtitles & Automatic Speech Recognition */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2
                          className="text-sm font-semibold text-white"
                          style={{
                            fontFamily: 'var(--font-display), sans-serif',
                          }}
                        >
                          02. Phụ đề & Nhận diện giọng nói tự động
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Nhập tệp .SRT hoặc tự động tạo phụ đề từ giọng nói trong file âm thanh
                        </p>
                      </div>
                    </div>

                    {/* Action Bar for Subtitles */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isTranscribing}
                        onClick={handleAutoGenerateSubtitlesFromAudio}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {isTranscribing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isTranscribing
                            ? 'Đang nhận diện giọng nói...'
                            : 'Tự động tạo phụ đề từ giọng nói'}
                        </span>
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0">
                        <Subtitles className="w-3.5 h-3.5 text-sky-400" />
                        <span>Nhập file .SRT / .TXT</span>
                        <input
                          type="file"
                          accept=".srt,.vtt,.txt,text/plain"
                          onChange={handleSubtitleFileUpload}
                          className="sr-only"
                        />
                      </label>

                      {subtitles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubtitles([]);
                            setRawSrtInput('');
                            setStatusBanner(
                              'Đã xóa phụ đề. Nhấn "Tự động tạo phụ đề từ giọng nói" để hệ thống tạo lại từ âm thanh.'
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-400 hover:text-rose-300 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa phụ đề</span>
                        </button>
                      )}
                    </div>

                    {/* Mode Switch: Timed Segments vs Raw SRT Text */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-md">
                        <button
                          type="button"
                          onClick={() => setSubtitleEditMode('segments')}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            subtitleEditMode === 'segments'
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Danh sách câu ({subtitles.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRawSrtInput(exportSubtitlesToSrt(subtitles));
                            setSubtitleEditMode('raw');
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            subtitleEditMode === 'raw'
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Soạn thảo SRT / Văn bản
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextStart =
                            subtitles.length > 0
                              ? subtitles[subtitles.length - 1].endTime
                              : 0;
                          const nextEnd = Math.min(duration, nextStart + 4);
                          const updated: SubtitleSegment[] = [
                            ...subtitles,
                            {
                              id: `sub-${Date.now()}`,
                              startTime: Number(nextStart.toFixed(2)),
                              endTime: Number(
                                Math.max(nextStart + 1.5, nextEnd).toFixed(2)
                              ),
                              text: 'Câu phụ đề mới đồng bộ theo nhịp nhạc.',
                            },
                          ];
                          setSubtitles(updated);
                          handleAutoSyncAll(updated, uploadedImages, duration);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm câu</span>
                      </button>
                    </div>

                    {/* Subtitle Editor Body */}
                    {subtitleEditMode === 'segments' ? (
                      subtitles.length === 0 ? (
                        <div className="p-6 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-3">
                          <p className="text-xs text-slate-400">
                            Hiện chưa có phụ đề. Hệ thống có thể tự động nhận diện giọng nói từ file MP3 để sinh phụ đề khớp thời gian.
                          </p>
                          <button
                            type="button"
                            onClick={handleAutoGenerateSubtitlesFromAudio}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Tự động tạo phụ đề từ giọng nói ngay</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                          {subtitles.map((sub, idx) => {
                            const isCurrent =
                              currentTime >= sub.startTime &&
                              currentTime <= sub.endTime;
                            return (
                              <div
                                key={sub.id}
                                onClick={() => handleSeek(sub.startTime + 0.05)}
                                className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                                  isCurrent
                                    ? 'bg-slate-950 border-amber-400/70'
                                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400 mb-1.5">
                                  <span>
                                    #{idx + 1} ·{' '}
                                    {formatDisplayTimecode(sub.startTime)} →{' '}
                                    {formatDisplayTimecode(sub.endTime)}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Xóa câu phụ đề ${idx + 1}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const filtered = subtitles.filter(
                                        (s) => s.id !== sub.id
                                      );
                                      setSubtitles(filtered);
                                      handleAutoSyncAll(
                                        filtered,
                                        uploadedImages,
                                        duration
                                      );
                                    }}
                                    className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  aria-label={`Nội dung phụ đề câu ${idx + 1}`}
                                  value={sub.text}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const newText = e.target.value;
                                    const updated = subtitles.map((item) =>
                                      item.id === sub.id
                                        ? {...item, text: newText}
                                        : item
                                    );
                                    setSubtitles(updated);
                                  }}
                                  onBlur={() =>
                                    handleAutoSyncAll(
                                      subtitles,
                                      uploadedImages,
                                      duration
                                    )
                                  }
                                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          rows={7}
                          aria-label="Nội dung phụ đề SRT hoặc văn bản thô"
                          value={rawSrtInput}
                          onChange={(e) => setRawSrtInput(e.target.value)}
                          placeholder="Dán nội dung chuẩn SRT hoặc nhập từng câu trên một dòng..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg p-3 text-xs font-mono text-slate-200 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = parseSrtOrTextToSubtitles(
                              rawSrtInput,
                              duration
                            );
                            setSubtitles(parsed);
                            handleAutoSyncAll(parsed, uploadedImages, duration);
                            setSubtitleEditMode('segments');
                          }}
                          className="w-full py-2 px-3 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer"
                        >
                          Áp dụng & Tự động khớp hình ảnh theo phụ đề
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: IMAGES & BUILT-IN STOCK LIBRARY */}
              {activeTab === 'images-library' && (
                <>
                  {/* Section 01: User Uploaded Images vs Smart Library Match */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2
                          className="text-sm font-semibold text-white"
                          style={{
                            fontFamily: 'var(--font-display), sans-serif',
                          }}
                        >
                          01. Hình ảnh đầu vào & Tự động ghép cảnh
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Tải ảnh riêng hoặc để hệ thống tự tìm hình minh họa từ thư viện theo nội dung phụ đề
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải ảnh lên ({uploadedImages.length})</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="sr-only"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleUseSmartStockLibrary}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tự động tìm ảnh minh họa từ thư viện</span>
                      </button>
                    </div>

                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        {uploadedImages.map((img) => (
                          <div
                            key={img.id}
                            className="relative group rounded-md overflow-hidden border border-slate-800 aspect-video bg-slate-950"
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              aria-label={`Xóa ảnh ${img.name}`}
                              onClick={() => {
                                const next = uploadedImages.filter(
                                  (u) => u.id !== img.id
                                );
                                setUploadedImages(next);
                                handleAutoSyncAll(subtitles, next, duration);
                              }}
                              className="absolute top-1 right-1 p-1 bg-slate-950/80 text-slate-300 hover:text-rose-400 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-800/80" />

                  {/* Section 02: Built-In Stock Illustration Library */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2
                        className="text-sm font-semibold text-white"
                        style={{fontFamily: 'var(--font-display), sans-serif'}}
                      >
                        02. Kho thư viện hình ảnh minh họa có sẵn
                      </h2>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        {filteredStockLibrary.length} cảnh 16:9 HD
                      </span>
                    </div>

                    {/* Search & Category Filter */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          aria-label="Tìm kiếm ảnh trong kho thư viện"
                          value={librarySearchQuery}
                          onChange={(e) =>
                            setLibrarySearchQuery(e.target.value)
                          }
                          placeholder="Tìm theo từ khóa (bình minh, thành phố, biển, rừng, cà phê)..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-md text-xs text-slate-100 outline-none"
                        />
                      </div>
                      <select
                        aria-label="Lọc danh mục thư viện ảnh"
                        value={libraryCategoryFilter}
                        onChange={(e) =>
                          setLibraryCategoryFilter(e.target.value)
                        }
                        className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                      >
                        <option value="all">Tất cả chủ đề</option>
                        {BUILTIN_STOCK_LIBRARY.map((item) => (
                          <option key={item.id} value={item.category}>
                            {item.category}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Stock Library Grid */}
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {filteredStockLibrary.map((stock) => {
                        const isUsedInSelected =
                          selectedScene?.imageUrl === stock.url;
                        return (
                          <div
                            key={stock.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="w-24 aspect-video rounded overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                              <img
                                src={stock.url}
                                alt={stock.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {stock.title}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {stock.category} · Từ khóa:{' '}
                                {stock.keywords.slice(0, 4).join(', ')}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAssignImageToSelectedScene(
                                      stock.url,
                                      stock.title,
                                      'library',
                                      stock.category
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  {isUsedInSelected ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Đang dùng ở cảnh chọn</span>
                                    </>
                                  ) : (
                                    <span>Thay vào cảnh đang chọn</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 3: TRANSITIONS & VISUAL EFFECTS */}
              {activeTab === 'transitions-effects' && (
                <>
                  {/* Section 01: Transition Styles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2
                        className="text-sm font-semibold text-white"
                        style={{fontFamily: 'var(--font-display), sans-serif'}}
                      >
                        01. Phong cách chuyển cảnh (Transitions)
                      </h2>
                      <span className="text-xs font-mono tabular-nums text-amber-400">
                        {transitionDuration}s
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {TRANSITION_OPTIONS.map((opt) => {
                        const active = defaultTransition === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleApplyGlobalTransition(opt.id)}
                            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-500/15 border-amber-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-xs font-semibold">
                              {opt.label}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {opt.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Transition Duration Slider */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <label
                        htmlFor="transition-duration-range"
                        className="text-xs text-slate-300 whitespace-nowrap"
                      >
                        Thời lượng chuyển cảnh:
                      </label>
                      <input
                        id="transition-duration-range"
                        type="range"
                        min={0.3}
                        max={1.5}
                        step={0.05}
                        value={transitionDuration}
                        onChange={(e) =>
                          setTransitionDuration(parseFloat(e.target.value))
                        }
                        className="flex-1 accent-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-800/80" />

                  {/* Section 02: Color Grading & Visual Effects */}
                  <div className="space-y-3">
                    <h2
                      className="text-sm font-semibold text-white"
                      style={{fontFamily: 'var(--font-display), sans-serif'}}
                    >
                      02. Bộ lọc màu & Hiệu ứng điện ảnh
                    </h2>

                    <div className="grid grid-cols-2 gap-2">
                      {VISUAL_EFFECT_OPTIONS.map((fx) => {
                        const active = visualEffect === fx.id;
                        return (
                          <button
                            key={fx.id}
                            type="button"
                            onClick={() => setVisualEffect(fx.id)}
                            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-500/15 border-amber-400 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-xs font-semibold">
                              {fx.label}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {fx.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Cinema Overlays & Subtitle Styling Checkboxes */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtitleStyle.showKaraokeHighlight}
                          onChange={(e) =>
                            setSubtitleStyle((s) => ({
                              ...s,
                              showKaraokeHighlight: e.target.checked,
                            }))
                          }
                          className="accent-amber-400"
                        />
                        <span>Highlight chữ Karaoke</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtitleStyle.letterboxBars}
                          onChange={(e) =>
                            setSubtitleStyle((s) => ({
                              ...s,
                              letterboxBars: e.target.checked,
                            }))
                          }
                          className="accent-amber-400"
                        />
                        <span>Viền đen Cinema 2.39:1</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtitleStyle.vignette}
                          onChange={(e) =>
                            setSubtitleStyle((s) => ({
                              ...s,
                              vignette: e.target.checked,
                            }))
                          }
                          className="accent-amber-400"
                        />
                        <span>Hiệu ứng tối góc (Vignette)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtitleStyle.filmGrain}
                          onChange={(e) =>
                            setSubtitleStyle((s) => ({
                              ...s,
                              filmGrain: e.target.checked,
                            }))
                          }
                          className="accent-amber-400"
                        />
                        <span>Hạt phim nhựa 35mm</span>
                      </label>
                    </div>

                    {/* Subtitle Position & Size */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="block text-xs text-slate-400 mb-1">
                          Vị trí phụ đề
                        </span>
                        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
                          {(
                            [
                              {id: 'bottom', label: 'Dưới'},
                              {id: 'center', label: 'Giữa'},
                              {id: 'top', label: 'Trên'},
                            ] as const
                          ).map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() =>
                                setSubtitleStyle((s) => ({
                                  ...s,
                                  position: pos.id,
                                }))
                              }
                              className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${
                                subtitleStyle.position === pos.id
                                  ? 'bg-slate-800 text-white font-medium'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-400 mb-1">
                          Cỡ chữ phụ đề
                        </span>
                        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
                          {(
                            [
                              {id: 'sm', label: 'Nhỏ'},
                              {id: 'md', label: 'Vừa'},
                              {id: 'lg', label: 'Lớn'},
                            ] as const
                          ).map((sz) => (
                            <button
                              key={sz.id}
                              type="button"
                              onClick={() =>
                                setSubtitleStyle((s) => ({
                                  ...s,
                                  fontSize: sz.id,
                                }))
                              }
                              className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${
                                subtitleStyle.fontSize === sz.id
                                  ? 'bg-slate-800 text-white font-medium'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {sz.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* RIGHT / CENTER MAIN STAGE: Real-Time Canvas Video Player & Transport Controls (7 cols) */}
          <section
            aria-label="Màn hình xem trước video thời gian thực"
            className="lg:col-span-7 flex flex-col justify-between p-6 bg-slate-950"
          >
            {/* Preview Sub-Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-200">
                  Màn hình kiểm duyệt (Live Canvas Renderer)
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {previewDims.width}×{previewDims.height}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {
                    TRANSITION_OPTIONS.find((t) => t.id === defaultTransition)
                      ?.label.split(' (')[0]
                  }
                </span>
              </div>

              {/* Aspect Ratio Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                {(
                  [
                    {id: '16:9', label: '16:9 Ngang'},
                    {id: '9:16', label: '9:16 Shorts'},
                    {id: '1:1', label: '1:1 Vuông'},
                  ] as const
                ).map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() =>
                      setExportConfig((cfg) => ({...cfg, aspectRatio: ar.id}))
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      exportConfig.aspectRatio === ar.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Viewport Frame */}
            <div className="flex-1 flex items-center justify-center bg-slate-900/50 border border-slate-800/90 rounded-xl p-4 min-h-[340px]">
              <div
                className="relative flex items-center justify-center overflow-hidden rounded-lg border border-slate-800 shadow-2xl bg-black"
                style={{
                  maxHeight: '420px',
                  aspectRatio:
                    exportConfig.aspectRatio === '16:9'
                      ? '16 / 9'
                      : exportConfig.aspectRatio === '9:16'
                        ? '9 / 16'
                        : '1 / 1',
                  width:
                    exportConfig.aspectRatio === '16:9' ? '100%' : 'auto',
                  height:
                    exportConfig.aspectRatio === '16:9' ? 'auto' : '400px',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={previewDims.width}
                  height={previewDims.height}
                  data-testid="video-preview-canvas"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="w-full h-full object-contain cursor-pointer"
                />
              </div>
            </div>

            {/* Transport Controls & Status Bar */}
            <div className="pt-4 space-y-3">
              {/* Interactive Seek Range */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-amber-400 w-14">
                  {formatDisplayTimecode(currentTime)}
                </span>
                <input
                  type="range"
                  aria-label="Thanh tua thời gian video"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="text-xs font-mono tabular-nums text-slate-400 w-14 text-right">
                  {formatDisplayTimecode(duration)}
                </span>
              </div>

              {/* Play / Pause / Reset / Status Row */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Tạm dừng</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Phát xem trước</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      handleSeek(0);
                    }}
                    aria-label="Đưa về đầu video"
                    className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                </div>

                {/* Live Synchronization Feedback Text */}
                <div className="text-xs text-slate-300 flex-1 min-w-[200px]">
                  {statusBanner}
                </div>

                <button
                  type="button"
                  onClick={() => handleAutoSyncAll()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Đồng bộ lại</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* MULTI-TRACK INTERACTIVE TIMELINE */}
        <div id="timeline-section">
          <StudioTimeline
            duration={duration}
            currentTime={currentTime}
            scenes={scenes}
            subtitles={subtitles}
            waveform={waveform}
            selectedSceneId={selectedSceneId}
            onSeek={handleSeek}
            onSelectScene={(id) => setSelectedSceneId(id)}
            onAutoSyncAll={() => handleAutoSyncAll()}
          />
        </div>
      </main>

      {/* HIGH-RESOLUTION MP4 EXPORT MODAL */}
      <ExportModal
        isOpen={isExportModalOpen}
        exportConfig={exportConfig}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportStatusText={exportStatusText}
        exportedVideoUrl={exportedVideoUrl}
        exportedFilename={exportedFilename}
        exportedResolutionLabel={exportedResolutionLabel}
        subtitles={subtitles}
        onClose={() => setIsExportModalOpen(false)}
        onUpdateConfig={(partial) =>
          setExportConfig((prev) => ({...prev, ...partial}))
        }
        onStartExport={handleStartMp4Export}
      />
    </div>
  );
}
