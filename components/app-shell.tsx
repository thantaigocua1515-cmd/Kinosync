'use client';

import Link from 'next/link';
import {Clapperboard, Github, Sparkles} from 'lucide-react';
import {cn} from '@/lib/utils';

export type StudioMode = 'story' | 'manual';

function BrandMark() {
  return (
    <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-br from-gold-soft via-gold to-gold-deep shadow-[0_10px_24px_-12px_rgba(231,178,95,0.8)]">
      <span className="absolute inset-x-0 top-1 flex justify-between px-1.5">
        <i className="h-1 w-1 rounded-full bg-[#2a1c05]/50" />
        <i className="h-1 w-1 rounded-full bg-[#2a1c05]/50" />
        <i className="h-1 w-1 rounded-full bg-[#2a1c05]/50" />
      </span>
      <span className="absolute inset-x-0 bottom-1 flex justify-between px-1.5">
        <i className="h-1 w-1 rounded-full bg-[#2a1c05]/50" />
        <i className="h-1 w-1 rounded-full bg-[#2a1c05]/50" />
        <i className="h-1 w-1 rounded-full bg-[#2a1c05]/50" />
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#241703]" aria-hidden>
        <path d="M9 6.5v11l9-5.5-9-5.5Z" />
      </svg>
    </span>
  );
}

export default function AppShell({
  mode,
  onModeChange,
  children,
}: {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  children: React.ReactNode;
}) {
  const tabs: {value: StudioMode; label: string; icon: React.ReactNode}[] = [
    {
      value: 'story',
      label: 'Truyện → Video',
      icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
    },
    {
      value: 'manual',
      label: 'Dựng thủ công',
      icon: <Clapperboard className="h-3.5 w-3.5" aria-hidden />,
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="leading-none">
              <span className="block font-display text-[19px] tracking-tight text-ink">
                Kinosync
              </span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.3em] text-faint">
                Story Studio
              </span>
            </span>
          </Link>

          <nav
            aria-label="Chế độ làm việc"
            className="ml-auto flex items-center gap-1 rounded-full border border-line bg-surface-2/70 p-1"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onModeChange(tab.value)}
                aria-current={mode === tab.value ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                  mode === tab.value
                    ? 'bg-gold/15 text-gold'
                    : 'text-muted hover:text-ink'
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          <a
            href="https://github.com/thantaigocua1515-cmd/Kinosync"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
            aria-label="Mã nguồn trên GitHub"
          >
            <Github className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {children}
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>
            Kinosync Studio · dựng video đọc truyện ngay trên trình duyệt. Nội dung
            truyện thuộc bản quyền của tác giả và nguồn phát hành.
          </p>
          <p className="font-mono uppercase tracking-[0.18em]">
            Nguồn truyện · truyenok.online API v1
          </p>
        </div>
      </footer>
    </div>
  );
}
