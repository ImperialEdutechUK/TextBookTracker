"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type SessionData = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        if (active) {
          setSession(data.session as SessionData);
          setLoading(false);
        }
      })
      .catch(() => {
        router.replace("/");
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (loading || !session) {
    return (
      <main className="main-shell">
        <div className="card">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="description">
              Welcome back. Use the navigation links to view available features.
            </p>
          </div>
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Core Access</h2>
          <ul>
            <li>Create textbooks (Creator / Admin only)</li>
            <li>Update textbook status up to requested or shared</li>
            <li>Manager can mark textbooks as sent to print and printed</li>
            <li>Admin can manage users and assign roles</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
