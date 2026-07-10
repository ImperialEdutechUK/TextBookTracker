import { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

// Railway sleeps a service only after 10 minutes with no OUTBOUND traffic.
// Prisma's open pool sends keepalives (outbound), so the service would never
// sleep. Drop the pool after 2 idle minutes — Prisma reconnects on next query.
const IDLE_MS = Number(process.env.DB_IDLE_DISCONNECT_MS ?? 120_000);
let idleTimer: NodeJS.Timeout | null = null;

export function dbIdleMiddleware(_req: Request, _res: Response, next: NextFunction) {
  if (idleTimer) clearTimeout(idleTimer);
  if (IDLE_MS > 0) {
    idleTimer = setTimeout(() => {
      prisma.$disconnect().catch(() => { /* reconnects on next query */ });
    }, IDLE_MS);
    idleTimer.unref();
  }
  next();
}
