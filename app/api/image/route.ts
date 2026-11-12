import {NextResponse} from 'next/server';

/**
 * Proxy ảnh bìa truyện: nhiều máy chủ nguồn chặn hotlink (ORB/CORS) nên trình
 * duyệt không tải được, và canvas cần ảnh same-origin mới vẽ được.
 *
 * Bảo vệ cơ bản: chỉ https, chặn host nội bộ / IP literal, chỉ nhận image/*,
 * giới hạn 8 MB và timeout 8 giây.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  // IPv4 / IPv6 literal
  if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) {
    return true;
  }
  return false;
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return NextResponse.json({error: 'Thiếu tham số url.'}, {status: 400});
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({error: 'URL ảnh không hợp lệ.'}, {status: 400});
  }

  if (parsed.protocol !== 'https:' || isBlockedHost(parsed.hostname)) {
    return NextResponse.json({error: 'URL ảnh không được phép.'}, {status: 400});
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: 'image/*',
        Referer: `${parsed.protocol}//${parsed.host}/`,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return NextResponse.json(
        {error: `Không tải được ảnh (${upstream.status}).`},
        {status: 502}
      );
    }

    const declaredLength = Number(upstream.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_BYTES) {
      return NextResponse.json({error: 'Ảnh quá lớn.'}, {status: 413});
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({error: 'Ảnh quá lớn.'}, {status: 413});
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({error: 'Không tải được ảnh.'}, {status: 504});
  }
}
