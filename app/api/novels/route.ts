import {NextResponse} from 'next/server';
import {fetchNovels, UpstreamError} from '@/lib/truyenok';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const novels = await fetchNovels();
    return NextResponse.json(
      {novels},
      {headers: {'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'}}
    );
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Không tải được thư viện truyện.';
    return NextResponse.json({error: message}, {status});
  }
}
