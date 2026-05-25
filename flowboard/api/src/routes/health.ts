import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../errors/AppError';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness check
 *     description: Returns immediately with process uptime. No external dependencies checked.
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, uptime]
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   example: 123.45
 */
// GET /health — lightweight liveness check (no external dependencies)
router.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * @openapi
 * /ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness check
 *     description: Verifies DB and Redis connectivity. Returns 503 if either is unreachable.
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, db, redis]
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 db:
 *                   type: string
 *                   example: ok
 *                 redis:
 *                   type: string
 *                   example: ok
 *       503:
 *         description: Service not ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
