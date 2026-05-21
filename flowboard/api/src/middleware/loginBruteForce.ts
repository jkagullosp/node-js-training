import { redis } from '../lib/redis';
import { AppError } from '../errors/AppError';
import logger from '../lib/logger';

const WINDOW_SECONDS = 60;
const MAX_FAILURES = 10;

const failKey = (ip: string): string => `login:fail:${ip}`;

export async function checkLoginFailures(ip: string): Promise<void> {
  try {
    const raw = await redis.get(failKey(ip));
    const count = raw !== null ? parseInt(raw, 10) : 0;
    if (count >= MAX_FAILURES) throw new AppError('Too many login attempts', 429, 'RATE_LIMIT_EXCEEDED');
  } catch (err) {
    if (err instanceof AppError) throw err; // re-throw intentional 429
    logger.warn({ err }, 'Login brute-force check Redis error — failing open');
    return;
  }
}

export async function recordLoginFailure(ip: string): Promise<void> {
  try {
    // Atomic initialisation: create key with TTL only if absent, then increment.
    // Avoids the INCR-then-conditional-EXPIRE race on the first failure.
    await redis.set(failKey(ip), '0', 'EX', WINDOW_SECONDS, 'NX');
    await redis.incr(failKey(ip));
  } catch (err) {
    logger.warn({ err }, 'Login brute-force record Redis error — failing silently');
  }
}

export async function resetLoginFailures(ip: string): Promise<void> {
  try {
    await redis.del(failKey(ip));
  } catch (err) {
    logger.warn({ err }, 'Login brute-force reset Redis error — failing silently');
  }
}
