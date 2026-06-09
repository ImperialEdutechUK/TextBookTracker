import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-long-secret';
const COOKIE_NAME = 'textbook_tracker_token';

export type SessionPayload = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  contactNumber?: string | null;
  address?: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}

export function getAuthCookieName() {
  return COOKIE_NAME;
}
