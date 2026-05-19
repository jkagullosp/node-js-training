import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { AppError, errorHandler } from './errors/AppError';
import { authenticate } from './middleware/authenticate';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
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
  // Public health/readiness endpoints — no auth middleware
  app.use('/', healthRouter);

  // Public — no authenticate middleware
  app.use('/auth', authRouter);

  // Protected — authenticate middleware applied per router
  app.use('/boards', authenticate, boardRouter);
  app.use('/tasks', authenticate, taskRouter);

  // ── 404 catch-all ─────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Route not found', 404, 'NOT_FOUND'));
  });

  // ── Global error handler (must be last) ───────────────────────────────────
  app.use(errorHandler);

  return app;
}
