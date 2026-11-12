import {NextResponse} from 'next/server';
import {fetchNovel, UpstreamError} from '@/lib/truyenok';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: {params: Promise<{id: string}>}
) {
  const {id} = await context.params;
  try {
    const novel = await fetchNovel(id);
    return NextResponse.json(
      {novel},
      {headers: {'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'}}
    );
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Không tải được thông tin truyện.';
    return NextResponse.json({error: message}, {status});
  }
}
