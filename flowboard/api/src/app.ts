import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config';
import { AppError, errorHandler } from './errors/AppError';
import { authenticate } from './middleware/authenticate';
import logger from './lib/logger';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import taskRouter from './routes/tasks';
import boardRouter from './routes/boards';
import auditLogRouter from './routes/auditLogs';

export function createApp(): Express {
  const app = express();

  // ── Trust proxy (required for correct IP behind Nginx) ────────────────────
  app.set('trust proxy', 1);

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ───────────────────────────────────────────────────────────────────
  /* istanbul ignore next */
  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        /* istanbul ignore next */
        if (env.NODE_ENV !== 'production') return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} is not allowed`));
      },
      credentials: true,
    })
  );

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));

  // ── Structured HTTP logging ───────────────────────────────────────────────
  app.use(pinoHttp({ logger }));

  // ── Routes ────────────────────────────────────────────────────────────────
  // Public health/readiness endpoints — no auth middleware
  app.use('/', healthRouter);

  // Public — no authenticate middleware
  app.use('/auth', authRouter);

  // Protected — authenticate middleware applied per router
  app.use('/boards', authenticate, boardRouter);
  app.use('/tasks', authenticate, taskRouter);
  app.use('/audit-logs', authenticate, auditLogRouter);

  // ── 404 catch-all ─────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Route not found', 404, 'NOT_FOUND'));
  });

  // ── Global error handler (must be last) ───────────────────────────────────
  app.use(errorHandler);

  return app;
}
