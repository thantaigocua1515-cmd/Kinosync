'use client';

import {useState} from 'react';
import AppShell, {type StudioMode} from './app-shell';
import StoryStudio from './story/story-studio';
import KinoSyncStudio from './KinoSyncStudio';

export default function StudioApp() {
  const [mode, setMode] = useState<StudioMode>('story');

  return (
    <AppShell mode={mode} onModeChange={setMode}>
      {/* Giữ cả hai chế độ trong DOM để không mất tiến trình khi chuyển tab. */}
      <div className={mode === 'story' ? undefined : 'hidden'}>
        <StoryStudio />
      </div>
      <div className={mode === 'manual' ? undefined : 'hidden'}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Trình dựng thủ công</p>
              <h1 className="display-title mt-2 text-3xl text-ink sm:text-4xl">
                Tự ghép nhạc, ảnh và phụ đề của bạn
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Dùng khi bạn đã có file MP3 và bộ ảnh riêng. Trình dựng này vẫn giữ
                nguyên các hiệu ứng chuyển cảnh, hiệu chỉnh màu và xuất MP4 chất
                lượng cao.
              </p>
            </div>
          </div>
          <KinoSyncStudio />
        </div>
      </div>
    </AppShell>
  );
}
