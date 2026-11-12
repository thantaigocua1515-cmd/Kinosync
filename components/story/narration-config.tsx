'use client';

import {useRef} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  ImagePlus,
  Mic,
  Palette,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type {ChapterSummary} from '@/lib/truyenok';
import {estimateSession, formatDuration} from '@/lib/story-pipeline';
import {
  ASPECT_OPTIONS,
  FPS_OPTIONS,
  RESOLUTION_OPTIONS,
  SUBTITLE_PRESETS,
  VOICES,
  applySubtitlePreset,
  estimateCallsPerChapter,
  type StoryConfig,
} from '@/lib/story-config';
import {filesToImageAssets} from '@/lib/image-loader';
import {
  Badge,
  Button,
  Field,
  Panel,
  SectionLabel,
  Select,
  Toggle,
} from '@/components/ui/primitives';
import {cn} from '@/lib/utils';

export default function NarrationConfig({
  config,
  onChange,
  chapters,
  onBack,
  onStart,
}: {
  config: StoryConfig;
  onChange: (next: StoryConfig) => void;
  chapters: ChapterSummary[];
  onBack: () => void;
  onStart: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const estimate = estimateSession(chapters);
  const calls = chapters.reduce(
    (sum, chapter) => sum + estimateCallsPerChapter(chapter.wordCount),
    0
  );
  const updateStyle = (changes: Partial<StoryConfig['style']>) => {
    onChange({...config, style: {...config.style, ...changes}});
  };

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const assets = filesToImageAssets(Array.from(files));
    onChange({...config, images: [...config.images, ...assets]});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id: string) => {
    const target = config.images.find((image) => image.id === id);
    if (target) URL.revokeObjectURL(target.url);
    onChange({
      ...config,
      images: config.images.filter((image) => image.id !== id),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Bước 3 / 4 · Giọng đọc & phong cách</p>
        <h1 className="display-title mt-2 text-3xl text-ink sm:text-4xl">
          Chọn giọng kể cho câu chuyện
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Giọng đọc được tạo theo từng đoạn ngắn rồi ghép lại, nhờ vậy phụ đề khớp
          chính xác thời gian thật của lời đọc thay vì ước lượng.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-gold" aria-hidden />
              <SectionLabel>Giọng đọc</SectionLabel>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {VOICES.map((voice) => {
                const active = config.voice === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => onChange({...config, voice: voice.id})}
                    aria-pressed={active}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      active
                        ? 'border-gold/60 bg-gold/10'
                        : 'border-line bg-surface-2/40 hover:border-line-strong'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px]',
                        active
                          ? 'bg-gold text-[#221704]'
                          : 'bg-surface-3 text-muted'
                      )}
                    >
                      {voice.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">
                          {voice.name}
                        </span>
                        <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                          {voice.tag}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                        {voice.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-gold" aria-hidden />
              <SectionLabel>Phong cách hình ảnh & phụ đề</SectionLabel>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {SUBTITLE_PRESETS.map((item) => {
                const active = config.preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange(applySubtitlePreset(config, item.id))}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      active
                        ? 'border-gold/60 bg-gold/10'
                        : 'border-line bg-surface-2/40 hover:border-line-strong'
                    )}
                  >
                    <span className="block text-[13px] font-semibold text-ink">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-faint">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <Toggle
                label="Tô sáng từng từ"
                description="Chữ đổi màu theo nhịp đọc như karaoke."
                checked={config.style.showKaraokeHighlight}
                onChange={(value) => updateStyle({showKaraokeHighlight: value})}
              />
              <Toggle
                label="Thanh viền phim"
                description="Hai dải đen trên dưới cho cảm giác điện ảnh."
                checked={config.style.letterboxBars}
                onChange={(value) => updateStyle({letterboxBars: value})}
              />
              <Toggle
                label="Hạt phim"
                description="Thêm nhiễu hạt nhẹ để hình ảnh bớt phẳng."
                checked={config.style.filmGrain}
                onChange={(value) => updateStyle({filmGrain: value})}
              />
              <Toggle
                label="Tối góc khung hình"
                description="Vignette giúp mắt tập trung vào phụ đề."
                checked={config.style.vignette}
                onChange={(value) => updateStyle({vignette: value})}
              />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-gold" aria-hidden />
              <SectionLabel>Ảnh minh họa</SectionLabel>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              Mặc định Kinosync dùng bìa truyện và kho ảnh có sẵn, tự chọn theo ngữ
              nghĩa từng đoạn. Tải ảnh riêng nếu bạn muốn hình ảnh đồng bộ với bộ
              truyện của mình.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => handleUpload(event.target.files)}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Tải ảnh lên
              </Button>
              {config.images.length > 0 ? (
                <Badge tone="sage">{config.images.length} ảnh</Badge>
              ) : (
                <span className="text-xs text-faint">Chưa có ảnh riêng</span>
              )}
              {config.images.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    config.images.forEach((image) =>
                      URL.revokeObjectURL(image.url)
                    );
                    onChange({...config, images: []});
                  }}
                >
                  Xoá tất cả
                </Button>
              ) : null}
            </div>

            {config.images.length > 0 ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {config.images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-ink opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Xoá ${image.name}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>
        </div>

        {/* Cột cấu hình kết xuất */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel className="p-5">
            <SectionLabel>Kết xuất</SectionLabel>
            <div className="mt-4 space-y-3">
              <Field label="Độ phân giải">
                <Select
                  value={config.exportConfig.resolution}
                  onChange={(event) =>
                    onChange({
                      ...config,
                      exportConfig: {
                        ...config.exportConfig,
                        resolution: event.target.value as '720p' | '1080p' | '1440p',
                      },
                    })
                  }
                >
                  {RESOLUTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Khung hình">
                  <Select
                    value={config.exportConfig.aspectRatio}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        exportConfig: {
                          ...config.exportConfig,
                          aspectRatio: event.target.value as '16:9' | '9:16' | '1:1',
                        },
                      })
                    }
                  >
                    {ASPECT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label.split(' — ')[0]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tốc độ khung">
                  <Select
                    value={config.exportConfig.fps}
                    onChange={(event) =>
                      onChange({
                        ...config,
                        exportConfig: {
                          ...config.exportConfig,
                          fps: Number(event.target.value) as 24 | 30,
                        },
                      })
                    }
                  >
                    {FPS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Bitrate video"
                hint="4 Mbps đủ nét cho ảnh tĩnh ở 1080p và giữ tệp nhẹ."
              >
                <Select
                  value={config.exportConfig.bitrateMbps}
                  onChange={(event) =>
                    onChange({
                      ...config,
                      exportConfig: {
                        ...config.exportConfig,
                        bitrateMbps: Number(event.target.value),
                      },
                    })
                  }
                >
                  {[3, 4, 6, 8].map((value) => (
                    <option key={value} value={value}>
                      {value} Mbps
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel>Tổng kết</SectionLabel>
              <Clock3 className="h-3.5 w-3.5 text-faint" aria-hidden />
            </div>
            <p className="mt-2 font-display text-3xl text-ink">
              {formatDuration(estimate.estimatedSeconds)}
            </p>
            <dl className="mt-3 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-faint">Số chương</dt>
                <dd className="font-mono text-muted">{chapters.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-faint">Số từ</dt>
                <dd className="font-mono text-muted">
                  {estimate.words.toLocaleString('vi-VN')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-faint">Lượt gọi giọng đọc</dt>
                <dd className="font-mono text-muted">~{calls}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-faint">Ước tính chờ</dt>
                <dd className="font-mono text-muted">
                  ~{Math.max(1, Math.ceil((calls * 3) / 60))} phút
                </dd>
              </div>
            </dl>

            <Button className="mt-4 w-full" size="lg" onClick={onStart}>
              <Wand2 className="h-4 w-4" aria-hidden />
              Tạo giọng đọc
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Đổi chương
            </Button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
