import { Router } from 'express';
import {
  comparePasswords,
  createSessionToken,
  getAuthCookieName,
} from '../lib/auth';
import { prisma } from '../lib/db';
import { getSession } from '../middleware/requireAdmin';

const router = Router();
const COOKIE_NAME = getAuthCookieName();

// Cross-site cookies require SameSite=None + Secure. For local same-site dev
// (frontend and backend both on localhost) SameSite=Lax works over http.
const crossSite = process.env.CROSS_SITE_COOKIES === 'true';
const cookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
  secure: crossSite || process.env.NODE_ENV === 'production',
};

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

  // Accounts with no password (Learner/Viewer) can't authenticate here.
  if (!user.passwordHash) {
    return res.status(401).json({ message: 'Invalid credentials.' });
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
    contactNumber: user.contactNumber,
    address: user.address,
  });

  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 1000 });
  return res.json({ message: 'Authenticated successfully', role: user.role });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
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
