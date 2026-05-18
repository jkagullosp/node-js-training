import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { AppError, errorHandler } from './errors/AppError';
import taskRouter from './routes/tasks';
import boardRouter from './routes/boards';

export function createApp(): Express {
  const app = express();

  // ── Trust proxy (required for correct IP behind Nginx) ────────────────────
  app.set('trust proxy', 1);

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = process.env['ALLOWED_ORIGINS']
    ? process.env['ALLOWED_ORIGINS'].split(',').map((o) => o.trim())
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (process.env['NODE_ENV'] !== 'production') return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} is not allowed`));
      },
      credentials: true,
    })
  );

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));

  // ── Routes ────────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/tasks', taskRouter);
  app.use('/boards', boardRouter);

  // ── 404 catch-all ─────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Route not found', 404, 'NOT_FOUND'));
  });

  // ── Global error handler (must be last) ───────────────────────────────────
  app.use(errorHandler);

  return app;
}
