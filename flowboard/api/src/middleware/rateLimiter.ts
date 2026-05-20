import { type Request, type Response, type NextFunction } from 'express';
import { redis } from '../lib/redis';
import { AppError } from '../errors/AppError';
import logger from '../lib/logger';

const WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS = 100;

export async function rateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip ?? 'unknown';
  const key = `rate:${ip}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    if (count > MAX_REQUESTS) {
      next(new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
      return;
    }
    next();
  } catch (err) {
    // Redis unavailable — fail open so auth traffic is not blocked
    logger.warn({ err }, 'Rate limiter Redis error — failing open');
    next();
  }
}
