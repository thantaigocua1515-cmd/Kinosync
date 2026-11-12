'use client';

import {useEffect, useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileVideo,
  HardDriveDownload,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  Subtitles,
} from 'lucide-react';
import type {BuildState, ExportState, StorySession} from '@/lib/story-session';
import type {StoryConfig} from '@/lib/story-config';
import {formatClock} from '@/lib/audio-utils';
import {formatDuration} from '@/lib/story-pipeline';
import {Badge, Button, Panel, ProgressBar, SectionLabel, Stat} from '@/components/ui/primitives';

function estimateSizeMb(durationSec: number, bitrateMbps: number): number {
  const videoMb = (bitrateMbps * 1_000_000 * durationSec) / 8 / 1_000_000;
  const audioMb = (96000 * durationSec) / 8 / 1_000_000;
  return videoMb + audioMb;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}

export default function RenderStage({
  build,
  session,
  exportState,
  config,
  canExport,
  onCancelBuild,
  onRetryBuild,
  onExport,
  onCancelExport,
  onDownloadSrt,
  onRestart,
}: {
  build: BuildState;
  session: StorySession | null;
  exportState: ExportState;
  config: StoryConfig;
  canExport: boolean;
  onCancelBuild: () => void;
  onRetryBuild: () => void;
  onExport: () => void;
  onCancelExport: () => void;
  onDownloadSrt: () => void;
  onRestart: () => void;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (build.status !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [build.status]);

  const elapsed = build.startedAt && now
    ? Math.max(1, Math.round((now - build.startedAt) / 1000))
    : 0;
  const chunkRatio =
    build.chunksTotal > 0 ? build.chunksDone / build.chunksTotal : 0;
  const percent =
    build.status === 'running'
      ? Math.round(
          build.phase === 'chapters'
            ? Math.min(12, (build.chaptersDone / Math.max(1, build.chaptersTotal)) * 12)
            : build.phase === 'assembly'
              ? 96
              : 12 + chunkRatio * 84
        )
      : 100;

  const etaSeconds =
    build.chunksDone > 0 && build.status === 'running' && build.startedAt && now
      ? Math.round(
          ((now - build.startedAt) / 1000 / build.chunksDone) *
            Math.max(0, build.chunksTotal - build.chunksDone)
        )
      : 0;

  const estimatedSize = estimateSizeMb(
    session?.durationSec ?? 0,
    config.exportConfig.bitrateMbps
  );

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <SectionLabel>Trạng thái</SectionLabel>
          {build.status === 'running' ? (
            <Badge tone="gold">Đang chạy</Badge>
          ) : build.status === 'ready' ? (
            <Badge tone="sage">Sẵn sàng</Badge>
          ) : build.status === 'error' ? (
            <Badge tone="danger">Lỗi</Badge>
          ) : (
            <Badge>Chờ</Badge>
          )}
        </div>

        {build.status === 'running' ? (
          <>
            <div className="mt-3 flex items-center gap-2 text-sm text-ink">
              <Loader2 className="h-4 w-4 animate-spin text-gold" aria-hidden />
              <span className="truncate">{build.message}</span>
            </div>
            <ProgressBar className="mt-3" value={percent} label="Tiến trình tạo giọng đọc" />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat
                label="Đoạn đọc"
                value={`${build.chunksDone}/${build.chunksTotal || '—'}`}
              />
              <Stat label="Đã chạy" value={formatClock(elapsed)} />
              <Stat
                label="Còn lại"
                value={etaSeconds > 0 ? formatClock(etaSeconds) : '—'}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-faint">
                Chương {Math.min(build.chaptersDone + 1, build.chaptersTotal)}/
                {build.chaptersTotal}
              </p>
              <Button variant="ghost" size="sm" onClick={onCancelBuild}>
                <Square className="h-3 w-3 fill-current" aria-hidden />
                Dừng
              </Button>
            </div>
          </>
        ) : build.status === 'error' ? (
          <div className="mt-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-danger/90">
                {build.error}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={onRetryBuild}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Thử lại
              </Button>
              <Button variant="ghost" size="sm" onClick={onRestart}>
                Về cấu hình
              </Button>
            </div>
          </div>
        ) : session ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
              <div>
                <p className="text-sm text-ink">
                  Đã tạo xong {session.chunkCount} đoạn giọng đọc
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {session.markers.length} chương · {formatDuration(session.durationSec)} ·{' '}
                  {session.scenes.length} phân cảnh
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
              <Stat label="Thời lượng" value={formatDuration(session.durationSec)} />
              <Stat
                label="Phụ đề"
                value={`${session.subtitles.length} dòng`}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Bấm “Tạo giọng đọc” ở bước trước để bắt đầu. Kinosync sẽ tải nội dung
            chương, tổng hợp giọng đọc và dựng phụ đề khớp thời gian thật.
          </p>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <SectionLabel>Xuất phim</SectionLabel>
          <FileVideo className="h-3.5 w-3.5 text-faint" aria-hidden />
        </div>

        <dl className="mt-3 space-y-1.5 text-[12.5px]">
          <div className="flex justify-between">
            <dt className="text-faint">Độ phân giải</dt>
            <dd className="font-mono text-muted">
              {config.exportConfig.resolution} · {config.exportConfig.fps}fps
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-faint">Khung hình</dt>
            <dd className="font-mono text-muted">{config.exportConfig.aspectRatio}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-faint">Dung lượng dự kiến</dt>
            <dd className="font-mono text-muted">
              {session ? formatSize(estimatedSize) : '—'}
            </dd>
          </div>
        </dl>

        {exportState.status === 'idle' ? (
          <Button
            className="mt-4 w-full"
            size="lg"
            onClick={onExport}
            disabled={!canExport}
          >
            <HardDriveDownload className="h-4 w-4" aria-hidden />
            Xuất MP4
          </Button>
        ) : null}

        {exportState.status === 'running' ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink">{exportState.label}</span>
              <span className="font-mono text-gold">{exportState.percent}%</span>
            </div>
            <ProgressBar className="mt-2" value={exportState.percent} label="Tiến trình xuất video" />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-faint">
                {exportState.phase === 'audio'
                  ? 'Nén giọng đọc'
                  : exportState.phase === 'video'
                    ? 'Mã hoá hình ảnh'
                    : 'Đóng gói MP4'}
              </p>
              <Button variant="ghost" size="sm" onClick={onCancelExport}>
                Huỷ
              </Button>
            </div>
            <p className="mt-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-[11px] leading-relaxed text-faint">
              Giữ tab này mở trong suốt quá trình xuất. Video dài 60–90 phút có thể
              mất 10–40 phút tuỳ máy.
            </p>
          </div>
        ) : null}

        {exportState.status === 'done' ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {exportState.savedToDisk ? 'Đã lưu MP4 xuống đĩa' : 'Đã đóng gói MP4'}
                </p>
                <p className="mt-0.5 truncate text-xs text-faint">
                  {exportState.filename}
                </p>
                {exportState.resolutionLabel ? (
                  <p className="mt-0.5 text-[11px] text-faint">
                    {exportState.resolutionLabel}
                  </p>
                ) : null}
                {exportState.sizeMb ? (
                  <p className="mt-0.5 text-[11px] text-faint">
                    {formatSize(exportState.sizeMb)}
                  </p>
                ) : null}
                {!exportState.encodedWithAudio ? (
                  <p className="mt-1 text-[11px] text-clay">
                    Trình duyệt không hỗ trợ mã hoá AAC — video này không có tiếng.
                  </p>
                ) : null}
              </div>
            </div>

            {exportState.downloadUrl ? (
              <a
                href={exportState.downloadUrl}
                download={exportState.filename}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-medium text-[#1b1305] transition-colors hover:bg-gold-soft"
              >
                <Download className="h-4 w-4" aria-hidden />
                Tải MP4
              </a>
            ) : null}

            <Button variant="secondary" className="w-full" onClick={onExport}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Xuất lại
            </Button>
          </div>
        ) : null}

        {exportState.status === 'error' ? (
          <div className="mt-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/8 px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-danger/90">
                {exportState.error}
              </p>
            </div>
            <Button className="mt-3 w-full" onClick={onExport}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Thử xuất lại
            </Button>
          </div>
        ) : null}

        <div className="mt-3 h-px bg-line" />

        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={onDownloadSrt}
            disabled={!session}
          >
            <Subtitles className="h-4 w-4" aria-hidden />
            Tải phụ đề .srt
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={onRestart}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Làm dự án mới
          </Button>
        </div>
      </Panel>
    </div>
  );
}
