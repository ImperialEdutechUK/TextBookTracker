'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type SessionData = {
  userId: string;
  username: string;
  fullName: string;
};

type SessionState = {
  session: SessionData | null;
  loading: boolean;
};

// Loads the current session from the backend.
export function useSession(): SessionState {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unauthorized');
        const data = await res.json();
        if (active) setSession(data.session as SessionData);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { session, loading };
}
