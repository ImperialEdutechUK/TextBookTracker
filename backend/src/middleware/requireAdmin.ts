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

export function getSession(req: Request): SessionPayload | null {
  const token = req.cookies?.[getAuthCookieName()];
  if (!token) return null;
  try {
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  req.session = session;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (session.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  req.session = session;
  next();
}

// Guard that allows any of the given roles. Use for endpoints shared across
// several roles, e.g. requireRole('CREATOR', 'ADMIN').
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!roles.includes(session.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.session = session;
    next();
  };
}
