/**
 * Chuyển ảnh bìa bên ngoài sang proxy same-origin để tránh bị chặn hotlink
 * và để canvas được phép vẽ (không bị "tainted canvas").
 */
export function proxyImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  return `/api/image?url=${encodeURIComponent(url)}`;
}

/** Nạp trước ảnh minh họa cho canvas (bìa truyện, kho ảnh, ảnh tải lên). */
export function preloadImages(
  urls: string[],
  cache: Map<string, HTMLImageElement>,
  onLoaded?: () => void
): void {
  if (typeof window === 'undefined') return;

  for (const url of new Set(urls.filter(Boolean))) {
    if (cache.has(url)) continue;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      cache.set(url, image);
      onLoaded?.();
    };
    image.onerror = () => {
      onLoaded?.();
    };
    image.src = url;
  }
}

/** Tạo object URL cho các ảnh người dùng tải lên và thu hồi khi không dùng nữa. */
export function filesToImageAssets(
  files: File[]
): {id: string; url: string; name: string}[] {
  return files
    .filter((file) => file.type.startsWith('image/'))
    .map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
}
