'use client';

import {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Clock3,
  Layers,
  Wand2,
} from 'lucide-react';
import type {NovelDetail} from '@/lib/truyenok';
import {
  effectiveWordCount,
  estimateSession,
  formatDuration,
} from '@/lib/story-pipeline';
import {proxyImageUrl} from '@/lib/image-loader';
import {estimateCallsPerChapter} from '@/lib/story-config';
import {
  Badge,
  Button,
  Field,
  Input,
  Panel,
  SectionLabel,
} from '@/components/ui/primitives';
import {cn} from '@/lib/utils';

export default function ChapterPicker({
  novel,
  selected,
  onChange,
  onBack,
  onContinue,
}: {
  novel: NovelDetail;
  selected: number[];
  onChange: (numbers: number[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const available = novel.chapters;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const [from, setFrom] = useState(
    () => selected[0] ?? available[0]?.chapterNumber ?? 1
  );
  const [to, setTo] = useState(
    () =>
      selected[selected.length - 1] ??
      available[Math.min(available.length - 1, 11)]?.chapterNumber ??
      1
  );
  const [descOpen, setDescOpen] = useState(false);

  const estimate = useMemo(() => {
    const chapters = available.filter((chapter) =>
      selectedSet.has(chapter.chapterNumber)
    );
    return estimateSession(chapters);
  }, [available, selectedSet]);

  const calls = useMemo(
    () =>
      available
        .filter((chapter) => selectedSet.has(chapter.chapterNumber))
        .reduce((sum, chapter) => sum + estimateCallsPerChapter(chapter.wordCount), 0),
    [available, selectedSet]
  );

  const applyRange = (start = from, end = to) => {
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    onChange(
      available
        .filter(
          (chapter) => chapter.chapterNumber >= low && chapter.chapterNumber <= high
        )
        .map((chapter) => chapter.chapterNumber)
    );
  };

  const toggleChapter = (chapterNumber: number) => {
    const next = new Set(selectedSet);
    if (next.has(chapterNumber)) next.delete(chapterNumber);
    else next.add(chapterNumber);
    onChange([...next].sort((a, b) => a - b));
  };

  const selectFirstN = (count: number) => {
    const startIndex = Math.max(
      0,
      available.findIndex((chapter) => chapter.chapterNumber === from)
    );
    const slice = available.slice(startIndex, startIndex + count);
    if (slice.length === 0) return;
    onChange(slice.map((chapter) => chapter.chapterNumber));
    setTo(slice[slice.length - 1].chapterNumber);
  };

  const minutes = estimate.estimatedMinutes;
  const tooShort = minutes < 45;
  const tooLong = minutes > 110;
  const canContinue = selected.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Thư viện
        </Button>
        <span className="text-faint">/</span>
        <span className="truncate text-sm text-muted">{novel.title}</span>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Thông tin truyện */}
        <div className="min-w-0 space-y-5">
          <div className="relative aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]">
            {novel.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxyImageUrl(novel.coverUrl)}
                alt={`Bìa ${novel.title}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-surface-3">
                <BookMarked className="h-10 w-10 text-gold/40" aria-hidden />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07080a] to-transparent p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                {novel.translatedChaptersCount || novel.chaptersCount} chương
              </p>
            </div>
          </div>

          <div>
            <p className="eyebrow">Bước 2 / 4 · Chọn chương</p>
            <h1 className="display-title mt-2 text-3xl text-ink">{novel.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {novel.author || 'Khuyết danh'}
              {novel.originalTitle ? (
                <span className="text-faint"> · {novel.originalTitle}</span>
              ) : null}
            </p>
          </div>

          {novel.description ? (
            <div>
              <p
                className={cn(
                  'whitespace-pre-line text-[13px] leading-relaxed text-muted',
                  descOpen ? '' : 'line-clamp-6'
                )}
              >
                {novel.description}
              </p>
              <button
                type="button"
                onClick={() => setDescOpen((value) => !value)}
                className="mt-2 text-[12px] font-medium text-gold hover:text-gold-soft"
              >
                {descOpen ? 'Thu gọn' : 'Đọc thêm'}
              </button>
            </div>
          ) : null}

          <Panel quiet className="p-4">
            <SectionLabel>Thời lượng phim</SectionLabel>
            <p className="mt-2 font-display text-4xl text-ink">
              {formatDuration(estimate.estimatedSeconds)}
            </p>
            <p className="mt-1 text-xs text-faint">
              {selected.length} chương · {estimate.words.toLocaleString('vi-VN')} từ
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  tooShort || tooLong ? 'bg-clay' : 'bg-gold'
                )}
                style={{width: `${Math.min(100, (minutes / 90) * 100)}%`}}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              <span>0</span>
              <span className="text-gold/80">60–90 phút</span>
              <span>120</span>
            </div>
          </Panel>
        </div>

        {/* Chọn chương */}
        <div className="min-w-0 space-y-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Từ chương" className="w-[120px]">
                <Input
                  type="number"
                  min={1}
                  max={available[available.length - 1]?.chapterNumber ?? 1}
                  value={from}
                  onChange={(event) => setFrom(Number(event.target.value) || 1)}
                />
              </Field>
              <Field label="Đến chương" className="w-[120px]">
                <Input
                  type="number"
                  min={1}
                  max={available[available.length - 1]?.chapterNumber ?? 1}
                  value={to}
                  onChange={(event) => setTo(Number(event.target.value) || 1)}
                />
              </Field>
              <Button variant="secondary" onClick={() => applyRange()}>
                <Layers className="h-4 w-4" aria-hidden />
                Chọn khoảng này
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                {[10, 14, 18].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => selectFirstN(count)}
                    className="rounded-full border border-line bg-surface-2/70 px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    {count} chương
                  </button>
                ))}
              </div>
            </div>

            <div className="my-4 h-px bg-line" />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="eyebrow">Đã chọn</p>
                <p className="mt-1 font-mono text-lg text-ink">
                  {selected.length} chương
                </p>
              </div>
              <div>
                <p className="eyebrow">Lượt gọi giọng đọc</p>
                <p className="mt-1 font-mono text-lg text-ink">~{calls}</p>
              </div>
              <div>
                <p className="eyebrow">Thời gian tạo dự kiến</p>
                <p className="mt-1 font-mono text-lg text-ink">
                  ~{Math.max(1, Math.round(calls * 3 / 60))} phút
                </p>
              </div>
            </div>

            {selected.length > 0 && (tooShort || tooLong) ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-clay/30 bg-clay/8 px-3.5 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-clay" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-clay/90">
                  {tooShort
                    ? `Ước lượng ${Math.round(minutes)} phút — hơi ngắn so với mục tiêu 60–90 phút. Thêm vài chương để phim đủ dài.`
                    : `Ước lượng ${Math.round(minutes)} phút — khá dài. Quá trình tạo giọng đọc và xuất video sẽ mất nhiều thời gian; nên chia thành 2 phần.`}
                </p>
              </div>
            ) : selected.length > 0 ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ok/25 bg-ok/8 px-3.5 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-ok/90">
                  Độ dài nằm trong khoảng lý tưởng cho một video đọc truyện dài.
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-faint" aria-hidden />
                <p className="text-[13px] font-medium text-ink">Danh sách chương</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange([])}
                  disabled={selected.length === 0}
                >
                  Bỏ chọn
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange(available.map((chapter) => chapter.chapterNumber))
                  }
                >
                  Chọn tất cả
                </Button>
              </div>
            </div>

            <div className="scroll-thin max-h-[420px] overflow-y-auto p-2">
              {available.map((chapter) => {
                const active = selectedSet.has(chapter.chapterNumber);
                return (
                  <button
                    key={chapter.chapterNumber}
                    type="button"
                    onClick={() => toggleChapter(chapter.chapterNumber)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      active ? 'bg-gold/8' : 'hover:bg-surface-2'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        active
                          ? 'border-gold bg-gold text-[#221704]'
                          : 'border-line-strong bg-transparent'
                      )}
                      aria-hidden
                    >
                      {active ? (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
                          <path d="M4.6 9.2 1.7 6.3l1-1 1.9 1.9 4.7-4.7 1 1-5.7 5.7Z" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="w-14 shrink-0 font-mono text-[11px] text-faint">
                      C.{chapter.chapterNumber}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-[13px]',
                        active ? 'text-ink' : 'text-muted'
                      )}
                    >
                      {chapter.title.replace(/^Chương\s+\d+[:.\s-]*/i, '') || chapter.title}
                    </span>
                    <span className="hidden shrink-0 font-mono text-[10px] text-faint sm:block">
                      ~{Math.max(1, Math.round((effectiveWordCount(chapter) / 165) * 60))}{' '}
                      phút
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-faint">
                <Badge tone="sage">Đã dịch</Badge>
                <span>{available.length} chương khả dụng</span>
              </div>
              <Button onClick={onContinue} disabled={!canContinue}>
                <Wand2 className="h-4 w-4" aria-hidden />
                Tiếp tục: giọng đọc
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
