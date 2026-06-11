import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import textbookRoutes from './routes/textbooks';
import textbookRequestRoutes from './routes/textbookRequests';
import { ensureSchema } from './lib/ensureSchema';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// Accept the configured frontend URL plus common local dev ports (Next.js
// falls back to 3001 when 3000 is taken).
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no origin) and any allowed origin.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/textbooks', textbookRoutes);
app.use('/api/textbook-requests', textbookRequestRoutes);

async function start() {
  // Self-heal any schema drift before serving so reads/writes never crash on a
  // missing column. Best-effort: if it fails (e.g. no DDL privileges), log and
  // start anyway rather than taking the whole API down.
  try {
    await ensureSchema();
    console.log('Schema check complete.');
  } catch (err) {
    console.error('Schema check failed (continuing to start):', err);
  }

  app.listen(PORT, () => {
    console.log(`Backend API listening on http://localhost:${PORT}`);
    console.log(`Allowing CORS origins: ${allowedOrigins.join(', ')}`);
  });
}

start();
