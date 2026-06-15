import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import textbookRoutes from './routes/textbooks';
import textbookRequestRoutes from './routes/textbookRequests';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notifications';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const allowedOrigins = [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'];

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
app.use('/api/users', userRoutes);
app.use('/api/textbooks', textbookRoutes);
app.use('/api/textbook-requests', textbookRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

app.listen(PORT, () => {
  console.log(`Backend API listening on http://localhost:${PORT}`);
  console.log(`Allowing CORS origins: ${allowedOrigins.join(', ')}`);
});
