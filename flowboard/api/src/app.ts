import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { AppError, errorHandler } from './errors/AppError';
import { authenticate } from './middleware/authenticate';
import logger from './lib/logger';
import { env } from './config';
import { swaggerSpec } from './lib/swagger';
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
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (process.env['NODE_ENV'] !== 'production') return callback(null, true);
        const origins = process.env['ALLOWED_ORIGINS']
          ? process.env['ALLOWED_ORIGINS'].split(',').map((o) => o.trim())
          : [];
        if (origins.includes(origin)) return callback(null, true);
        callback(new AppError(`CORS: origin ${origin} is not allowed`, 403, 'CORS_NOT_ALLOWED'));
      },
      credentials: true,
    })
  );

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));

  // ── Structured HTTP logging ───────────────────────────────────────────────
  app.use(pinoHttp({ logger }));

  // ── API Docs ──────────────────────────────────────────────────────────────
  app.use(
    '/api-docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          // Allow Swagger UI's "Try it out" fetch calls to reach the API
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'FlowBoard API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );

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
