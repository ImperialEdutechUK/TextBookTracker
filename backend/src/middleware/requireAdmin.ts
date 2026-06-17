import { NextFunction, Request, Response } from 'express';
import { getAuthCookieName, verifySessionToken, SessionPayload } from '../lib/auth';

// Augment Express Request so route handlers can read the authenticated session.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

// Resolve the session token from either the auth cookie or an
// `Authorization: Bearer <token>` header. The header path is what makes auth
// work cross-domain (e.g. frontend on Vercel, API on Railway): browsers block
// the cross-site cookie as a third-party cookie (always in incognito/Safari),
// so the frontend also stores the JWT and sends it explicitly as a header.
function getToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  // Allow the token as a query param too. A direct browser navigation (used to
  // view/download PDFs natively, so the browser streams the file with Range
  // requests instead of buffering it all in JS) can't send an Authorization
  // header, so the token rides along in the URL for those GET requests.
  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }
  return req.cookies?.[getAuthCookieName()] ?? null;
}

export function getSession(req: Request): SessionPayload | null {
  const token = getToken(req);
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

// There is a single admin account, so any authenticated session is the admin.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.session = session;
  next();
}
