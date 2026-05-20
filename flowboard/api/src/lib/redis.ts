import Redis from 'ioredis';
import { env } from '../config';
import logger from './logger';

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    // Disable auto-reconnect attempts that would block the event loop on shutdown
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('error', (err: Error) => {
    // Log but do not crash — callers handle Redis unavailability gracefully
    logger.error({ err }, '[redis] connection error');
  });

  client.on('connect', () => {
    logger.info('[redis] connected');
  });

  return client;
}

// Singleton — one connection shared across the process
export const redis = createRedisClient();
