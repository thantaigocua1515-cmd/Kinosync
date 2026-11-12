import {NextResponse} from 'next/server';
import {fetchChapter, UpstreamError} from '@/lib/truyenok';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: {params: Promise<{id: string; chapterNumber: string}>}
) {
  const {id, chapterNumber} = await context.params;
  const chapter = Number.parseInt(chapterNumber, 10);

  if (!Number.isFinite(chapter) || chapter < 1) {
    return NextResponse.json({error: 'Số chương không hợp lệ.'}, {status: 400});
  }

  const formatParam = new URL(request.url).searchParams.get('format');
  const format =
    formatParam === 'original' || formatParam === 'both' ? formatParam : 'translated';

  try {
    const content = await fetchChapter(id, chapter, format);
    return NextResponse.json(
      {chapter: content},
      {headers: {'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'}}
    );
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Không tải được nội dung chương.';
    return NextResponse.json({error: message}, {status});
  }
}
