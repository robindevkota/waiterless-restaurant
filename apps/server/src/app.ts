import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import qrRoutes from './routes/qr.routes';
import platformRoutes from './routes/platform.routes';
import restaurantRoutes from './routes/restaurant.routes';
import menuRoutes from './routes/menu.routes';
import tableRoutes from './routes/table.routes';
import sessionRoutes from './routes/session.routes';
import orderRoutes from './routes/order.routes';
import billingRoutes from './routes/billing.routes';
import reportsRoutes from './routes/reports.routes';
import staffRoutes from './routes/staff.routes';
import aiRoutes from './routes/ai.routes';
import inventoryRoutes from './routes/inventory.routes';

const app = express();

// ── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [process.env.CLIENT_URL || 'http://localhost:3000']
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://192.168.18.156:3001',
        process.env.CLIENT_URL,
      ].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
// 150kb: settings can carry an inline data:image payment QR (tens of KB);
// everything else stays tiny
app.use(express.json({ limit: '150kb' }));
app.use(express.urlencoded({ extended: true, limit: '150kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Rate limiting (disabled in development) ───────────────────────────────────
const isDev = process.env.NODE_ENV === 'development';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100_000 : process.env.NODE_ENV === 'test' ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100_000 : process.env.NODE_ENV === 'test' ? 1000 : 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req: express.Request, res: express.Response) => res.json({ status: 'ok', ts: new Date() }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/inventory', inventoryRoutes);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

export default app;
