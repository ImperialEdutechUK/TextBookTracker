// Base URL of the standalone backend API. Configured via NEXT_PUBLIC_API_URL
// so it can point at localhost in dev and a deployed URL in production.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

// Wrapper around fetch that always sends the auth cookie to the backend.
export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), { credentials: 'include', ...init });
}
