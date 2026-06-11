import { NextRequest } from 'next/server';

// Same-origin proxy for textbook cover thumbnails, mirroring the PDF proxy
// (see ../textbook-file/[id]/route.ts). The browser fetches this same-origin
// route and we fetch the small JPEG from the backend server-side.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookie = request.headers.get('cookie') ?? '';
  const upstream = await fetch(`${API_BASE}/api/textbooks/${params.id}/cover`, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ message: 'No cover available.' }),
      { status: upstream.status || 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'image/jpeg');
  headers.set('Content-Length', String(body.length));
  headers.set('Cache-Control', 'private, max-age=86400');
  return new Response(body, { status: 200, headers });
}
