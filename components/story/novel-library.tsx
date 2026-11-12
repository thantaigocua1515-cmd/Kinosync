'use client';

import {useMemo, useState} from 'react';
import {BookOpen, Library, RefreshCw, Search, X} from 'lucide-react';
import type {NovelSummary} from '@/lib/truyenok';
import {proxyImageUrl} from '@/lib/image-loader';
import {Badge, Button, EmptyState, Input, Segmented, Skeleton} from '@/components/ui/primitives';

type StatusFilter = 'all' | 'ongoing' | 'completed';

const MINUTES_PER_CHAPTER = 5.4;

function formatRuntime(chapters: number): string {
  const minutes = Math.round(chapters * MINUTES_PER_CHAPTER);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} phút`;
  return `${hours} giờ ${String(rest).padStart(2, '0')}`;
}

function NovelCover({novel}: {novel: NovelSummary}) {
  const [broken, setBroken] = useState(false);

  if (!novel.coverUrl || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#2a2418,#111317_70%)]">
        <BookOpen className="h-8 w-8 text-gold/40" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxyImageUrl(novel.coverUrl)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
    />
  );
}

function NovelCard({
  novel,
  onSelect,
}: {
  novel: NovelSummary;
  onSelect: (novel: NovelSummary) => void;
}) {
  const chapters = novel.translatedChaptersCount || novel.chaptersCount;

  return (
    <button
      type="button"
      onClick={() => onSelect(novel)}
      className="group flex flex-col text-left focus-visible:outline-none"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-line bg-surface-2 shadow-[0_20px_50px_-32px_rgba(0,0,0,0.95)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-gold/40 group-focus-visible:border-gold">
        <NovelCover novel={novel} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080a] via-[#07080a]/25 to-transparent opacity-90" />

        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/55 px-2 py-0.5 font-mono text-[10px] tracking-wide text-ink/90 backdrop-blur">
            {chapters} chương
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink drop-shadow">
            {novel.title}
          </p>
          <p className="mt-1 truncate text-[11px] text-muted">
            {novel.author || 'Khuyết danh'}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 px-0.5">
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
          ~{formatRuntime(chapters)} đọc
        </span>
        <span className="shrink-0 text-[11px] text-gold/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Chọn →
        </span>
      </div>
    </button>
  );
}

export default function NovelLibrary({
  novels,
  isLoading,
  error,
  onRetry,
  onSelect,
}: {
  novels: NovelSummary[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (novel: NovelSummary) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return novels.filter((novel) => {
      const matchesStatus =
        status === 'all' ||
        (status === 'completed'
          ? novel.status === 'completed'
          : novel.status !== 'completed');
      if (!matchesStatus) return false;
      if (!needle) return true;
      return (
        novel.title.toLowerCase().includes(needle) ||
        (novel.author ?? '').toLowerCase().includes(needle) ||
        (novel.originalTitle ?? '').toLowerCase().includes(needle)
      );
    });
  }, [novels, query, status]);

  const totalChapters = novels.reduce(
    (sum, novel) => sum + (novel.translatedChaptersCount || novel.chaptersCount),
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">Bước 1 / 4 · Thư viện nguồn</p>
          <h1 className="display-title mt-3 text-4xl text-ink sm:text-[46px]">
            Chọn một truyện.
            <br />
            <span className="text-gold">Kinosync lo phần còn lại.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-[15px]">
            Mỗi chương khoảng 900 từ, tương đương 5–6 phút đọc. Ghép 12–16 chương
            để có một phim đọc truyện dài 60–90 phút với giọng đọc, phụ đề và hình
            ảnh minh họa.
          </p>
        </div>

        <div className="flex gap-6 lg:gap-8">
          <div>
            <p className="eyebrow">Truyện</p>
            <p className="mt-1 font-mono text-2xl text-ink">{novels.length || '—'}</p>
          </div>
          <div className="h-10 w-px self-center bg-line" />
          <div>
            <p className="eyebrow">Chương đã dịch</p>
            <p className="mt-1 font-mono text-2xl text-ink">
              {totalChapters ? totalChapters.toLocaleString('vi-VN') : '—'}
            </p>
          </div>
          <div className="h-10 w-px self-center bg-line" />
          <div>
            <p className="eyebrow">Nguồn</p>
            <p className="mt-1 font-mono text-2xl text-ink">API v1</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên truyện hoặc tác giả…"
            className="pl-10 pr-10"
            aria-label="Tìm truyện"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-ink"
              aria-label="Xoá tìm kiếm"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Segmented
            ariaLabel="Lọc theo trạng thái"
            value={status}
            onChange={setStatus}
            options={[
              {value: 'all', label: 'Tất cả'},
              {value: 'ongoing', label: 'Đang ra'},
              {value: 'completed', label: 'Hoàn thành'},
            ]}
          />
          <Button variant="ghost" size="icon" onClick={onRetry} aria-label="Tải lại thư viện">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({length: 10}).map((_, index) => (
            <div key={index} className="space-y-2.5">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Library className="h-7 w-7" aria-hidden />}
          title="Chưa tải được thư viện"
          description={error}
          action={
            <Button variant="secondary" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Thử lại
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" aria-hidden />}
          title="Không có truyện phù hợp"
          description="Thử từ khoá khác hoặc bỏ bộ lọc trạng thái."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setStatus('all');
              }}
            >
              Xoá bộ lọc
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((novel) => (
              <NovelCard key={novel.id} novel={novel} onSelect={onSelect} />
            ))}
          </div>
          <p className="text-center text-xs text-faint">
            Hiển thị {filtered.length} / {novels.length} truyện · cập nhật từ
            truyenok.online
          </p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
        <Badge tone="gold">Mẹo</Badge>
        <p className="text-[13px] leading-relaxed text-muted">
          Truyện càng nhiều chương đã dịch, càng dễ chọn đúng 60–90 phút. Bạn có thể
          chọn theo khoảng chương ở bước tiếp theo.
        </p>
      </div>
    </div>
  );
}
