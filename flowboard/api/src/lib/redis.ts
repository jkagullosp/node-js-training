import Redis from 'ioredis';

function createRedisClient(): Redis {
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const client = new Redis(redisUrl, {
    // Disable auto-reconnect attempts that would block the event loop on shutdown
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('error', (err: Error) => {
    // Log but do not crash — callers handle Redis unavailability gracefully
    console.error('[redis] connection error:', err.message);
  });

  client.on('connect', () => {
    console.info('[redis] connected');
  });

  return client;
}

// Singleton — one connection shared across the process
export const redis = createRedisClient();
