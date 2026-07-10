import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-long-secret';
const COOKIE_NAME = 'textbook_tracker_token';
// Sliding session: every authenticated request re-issues a token with this
// TTL, so this is an IDLE timeout - active users stay logged in.
// Seconds. Env-tunable: SESSION_IDLE_TTL_SECONDS (default 900 = 15 min).
const SESSION_IDLE_TTL = Number(process.env.SESSION_IDLE_TTL_SECONDS ?? 900);

export type SessionPayload = {
  userId: string;
  username: string;
  fullName: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_IDLE_TTL });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}

export function getAuthCookieName() {
  return COOKIE_NAME;
}
