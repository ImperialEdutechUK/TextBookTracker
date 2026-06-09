'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type Role = 'ADMIN' | 'CREATOR' | 'MANAGER' | 'VIEWER';

export type SessionData = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  status: string;
  contactNumber?: string | null;
};

type SessionState = {
  session: SessionData | null;
  loading: boolean;
};

// Loads the current session from the backend. Shared by pages that need to
// adjust UI (e.g. show the Create button only for CREATOR/ADMIN).
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
