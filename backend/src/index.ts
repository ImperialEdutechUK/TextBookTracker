import 'dotenv/config';
import express, { ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import textbookRequestRoutes from './routes/textbookRequests';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

// Railway (and most PaaS) terminate TLS at a proxy and forward over http.
// Trust the proxy so `req.secure` / `req.protocol` reflect the original HTTPS
// connection, which the auth route uses to decide on Secure/SameSite=None
// cookies. Harmless locally where there is no forwarding proxy.
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Reject cleanly (no CORS headers) rather than throwing, which would
        // surface as a confusing 500 instead of a normal blocked request.
        console.warn(`Blocked CORS origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/textbook-requests', textbookRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Central error handler. Async route rejections are routed here by makeRouter()
// (see lib/router.ts). A transient database connectivity error returns a 503 so
// the client can retry, instead of crashing the server.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Transient database problems — usually the Railway proxy under load:
  //   P1001 can't reach server, P1002 connection timed out,
  //   P1008 operation/socket timed out, P1017 connection closed by server.
  // Surface these as 503 so the client knows to retry.
  const code = (err as { code?: string })?.code;
  const dbUnavailable = code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017';
  console.error('[API error]', err);
  if (res.headersSent) return;
  res.status(dbUnavailable ? 503 : 500).json({
    message: dbUnavailable
      ? 'The database is temporarily unavailable. Please try again in a moment.'
      : 'Something went wrong. Please try again.',
  });
};
app.use(errorHandler);

// Last-resort safety net: never let a stray rejection or exception terminate
// the process. Log it and keep serving — a transient DB blip must not take the
// whole backend down.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

app.listen(PORT, () => {
  console.log(`Backend API listening on http://localhost:${PORT}`);
  console.log(`Allowing CORS origins: ${allowedOrigins.join(', ')}`);
});
