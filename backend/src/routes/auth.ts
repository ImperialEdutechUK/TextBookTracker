import { Request, Router } from 'express';
import {
  comparePasswords,
  createSessionToken,
  getAuthCookieName,
} from '../lib/auth';
import { prisma } from '../lib/db';
import { getSession } from '../middleware/requireAdmin';

const router = Router();
const COOKIE_NAME = getAuthCookieName();

// The deployed frontend and backend live on different domains, so production
// requests are cross-site. A cross-site cookie must be SameSite=None + Secure,
// otherwise the browser will refuse to send it on the frontend's fetch() calls
// (which is what caused /api/auth/me to 401 for shared users).
//
// We decide per request from whether the connection is HTTPS (req.secure,
// reliable behind Railway's proxy thanks to `trust proxy`) rather than from
// NODE_ENV, since Railway does not always set NODE_ENV=production. Secure
// cookies cannot be set over plain http, so local http dev falls back to
// SameSite=Lax. CROSS_SITE_COOKIES=true can force cross-site mode on.
function cookieOptionsFor(req: Request) {
  const crossSite = process.env.CROSS_SITE_COOKIES === 'true' || req.secure;
  return {
    httpOnly: true,
    path: '/',
    sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
    secure: crossSite,
  };
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') {
    return res
      .status(401)
      .json({ message: 'Invalid credentials or account is not active.' });
  }

  const passwordMatches = await comparePasswords(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = createSessionToken({
    userId: user.id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
  });

  // Set the cookie (works for same-site setups) AND return the token in the
  // body so the frontend can send it as an Authorization header. The header is
  // what keeps auth working cross-domain, where the cookie is blocked as a
  // third-party cookie (e.g. in incognito / Safari).
  res.cookie(COOKIE_NAME, token, { ...cookieOptionsFor(req), maxAge: 60 * 60 * 24 * 1000 });
  return res.json({ message: 'Authenticated successfully', role: user.role, token });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptionsFor(req));
  return res.json({ message: 'Logged out successfully.' });
});

// Returns the current session derived from the auth cookie, or 401.
router.get('/me', (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return res.json({ session });
});

export default router;
