import 'dotenv/config';
import { env } from './config';
import { createApp } from './app';
import logger from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

const PORT = env.PORT;

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`[server] FlowBoard API listening on port ${PORT}`);
});

// Graceful shutdown — finish in-flight requests before exiting
function shutdown(signal: string): void {
  logger.info(`[server] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    redis.quit();
    logger.info('[server] HTTP server closed — connections drained');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
