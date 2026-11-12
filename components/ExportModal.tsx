'use client';

import React from 'react';
import {
  ExportConfig,
  SubtitleSegment,
  exportSubtitlesToSrt,
  getResolutionDimensions,
} from '@/lib/video-engine';
import {Download, Film, CheckCircle2, X, FileText, Loader2} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  exportConfig: ExportConfig;
  isExporting: boolean;
  exportProgress: number;
  exportStatusText: string;
  exportedVideoUrl: string | null;
  exportedFilename: string;
  exportedResolutionLabel: string;
  subtitles: SubtitleSegment[];
  onClose: () => void;
  onUpdateConfig: (partial: Partial<ExportConfig>) => void;
  onStartExport: () => void;
}

export default function ExportModal({
  isOpen,
  exportConfig,
  isExporting,
  exportProgress,
  exportStatusText,
  exportedVideoUrl,
  exportedFilename,
  exportedResolutionLabel,
  subtitles,
  onClose,
  onUpdateConfig,
  onStartExport,
}: ExportModalProps) {
  if (!isOpen) return null;

  const dims = getResolutionDimensions(
    exportConfig.resolution,
    exportConfig.aspectRatio
  );

  const handleDownloadSrt = () => {
    const srtContent = exportSubtitlesToSrt(subtitles);
    const blob = new Blob([srtContent], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinosync-subtitles-${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2
              id="export-modal-title"
              className="text-lg font-semibold text-white"
              style={{fontFamily: 'var(--font-display), sans-serif'}}
            >
              Xuất Video MP4 Độ Phân Giải Cao
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mã hóa trực tiếp định dạng H.264 MP4 với hình ảnh, chuyển cảnh và phụ đề đã đồng bộ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ xuất video"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Controls */}
        <div className="py-5 space-y-4">
          {/* Resolution */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Độ phân giải đầu ra (Resolution)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  {id: '720p', label: '720p HD', desc: 'Nhanh · Mạng xã hội'},
                  {
                    id: '1080p',
                    label: '1080p Full HD',
                    desc: 'Chuẩn sắc nét cao',
                  },
                  {id: '1440p', label: '1440p 2K QHD', desc: 'Siêu nét Studio'},
                ] as const
              ).map((item) => {
                const active = exportConfig.resolution === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isExporting}
                    onClick={() => onUpdateConfig({resolution: item.id})}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border-amber-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold font-mono tabular-nums">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio & Frame Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Tỷ lệ khung hình
              </label>
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {(
                  [
                    {id: '16:9', label: '16:9 Ngang'},
                    {id: '9:16', label: '9:16 Dọc'},
                    {id: '1:1', label: '1:1 Vuông'},
                  ] as const
                ).map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    disabled={isExporting}
                    onClick={() => onUpdateConfig({aspectRatio: ar.id})}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Tốc độ khung hình (FPS)
              </label>
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {([24, 30, 60] as const).map((fpsVal) => (
                  <button
                    key={fpsVal}
                    type="button"
                    disabled={isExporting}
                    onClick={() => onUpdateConfig({fps: fpsVal})}
                    className={`flex-1 py-1.5 px-2 text-xs font-mono tabular-nums font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      exportConfig.fps === fpsVal
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fpsVal} FPS
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Specs Line (Unboxed zero-pill metadata) */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
            <span>Định dạng: MP4 (H.264 / AVC1)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Kích thước: {dims.width}×{dims.height}px
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Bitrate: {exportConfig.bitrateMbps} Mbps
            </span>
          </div>

          {/* Progress Bar or Completed Output */}
          {isExporting && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-amber-300 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {exportStatusText || 'Đang xử lý khung hình...'}
                </span>
                <span className="font-mono tabular-nums font-semibold text-white">
                  {exportProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  style={{width: `${exportProgress}%`}}
                  className="h-full bg-amber-500 transition-transform duration-150"
                />
              </div>
            </div>
          )}

          {exportedVideoUrl && !isExporting && (
            <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-lg space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Video MP4 đã sẵn sàng tải xuống ({exportedResolutionLabel})
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={exportedVideoUrl}
                  download={exportedFilename}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải xuống tệp .MP4 ({exportedConfigLabel(exportConfig)})
                </a>

                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Tải kèm tệp phụ đề .SRT
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDownloadSrt}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Xuất riêng phụ đề (.SRT)
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={onStartExport}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Film className="w-3.5 h-3.5" />
              {isExporting
                ? 'Đang kết xuất MP4...'
                : exportedVideoUrl
                  ? 'Kết xuất lại MP4'
                  : 'Bắt đầu xuất MP4'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportedConfigLabel(cfg: ExportConfig) {
  return `${cfg.resolution} · ${cfg.fps}fps`;
}
