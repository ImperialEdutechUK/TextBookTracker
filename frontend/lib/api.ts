// Base URL of the standalone backend API. Configured via NEXT_PUBLIC_API_URL
// so it can point at localhost in dev and a deployed URL in production.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

// The frontend and backend live on different domains in production, so the auth
// cookie is a third-party cookie that browsers block (always in incognito and
// Safari, increasingly everywhere). To make login reliable for everyone we also
// keep the JWT in localStorage and send it as an Authorization header. The
// cookie is still sent (credentials: 'include') for same-site/dev setups.
const TOKEN_KEY = 'textbook_tracker_token';

export function setToken(token: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
}

// Wrapper around fetch that authenticates the request to the backend, via both
// the auth cookie and an Authorization header when a token is stored.
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { credentials: 'include', ...init, headers });
  // Sliding session: the backend re-issues a fresh 15-minute token on every
  // authenticated request via this header. Store it so active users stay
  // logged in; only 15 idle minutes logs someone out.
  const refreshed = res.headers.get('X-Session-Token');
  if (refreshed) setToken(refreshed);
  return res;
}
