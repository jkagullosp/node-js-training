import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../errors/AppError';

const router = Router();

// GET /health — lightweight liveness check (no external dependencies)
router.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// GET /ready — readiness check (verifies DB and Redis connectivity)
router.get('/ready', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ready', db: 'ok', redis: 'ok' });
  } catch (_err) {
    next(new AppError('Service not ready', 503, 'NOT_READY'));
  }
});

export default router;
