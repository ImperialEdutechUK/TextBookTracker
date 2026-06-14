import { NextRequest } from 'next/server';

// Same-origin proxy for textbook PDFs. The browser fetches this (localhost:3000)
// and we fetch the file from the backend server-side, then return it as a single
// buffered response. Two things matter here:
//  1. Same-origin: avoids the browser making a cross-origin request to the API
//     port (:4000).
//  2. Buffered (not streamed): a streamed/chunked binary response to the browser
//     was being reset (ERR_CONNECTION_RESET) on some local setups; reading the
//     bytes fully and sending one response with Content-Length is reliable.
// The whole PDF is buffered server-side before being returned.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Forward the auth cookie (sent automatically to this same-host route) so the
  // backend authorizes the request.
  const cookie = request.headers.get('cookie') ?? '';
  const download = request.nextUrl.searchParams.get('download') ? '?download=1' : '';
  const backendUrl = `${API_BASE}/api/textbooks/${params.id}/file${download}`;

  const upstream = await fetch(backendUrl, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ message: 'Unable to load the PDF.' }),
      { status: upstream.status || 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Buffer the whole file server-side, then send it as one response.
  const body = Buffer.from(await upstream.arrayBuffer());

  // NOTE: we deliberately do NOT forward Content-Disposition. Marking the
  // response as a file download causes some local security/AV software to
  // intercept and reset the browser connection (ERR_CONNECTION_RESET). The PDF
  // is served inline; the client sets the filename via the <a download> attr.
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/pdf');
  headers.set('Content-Length', String(body.length));

  return new Response(body, { status: 200, headers });
}
