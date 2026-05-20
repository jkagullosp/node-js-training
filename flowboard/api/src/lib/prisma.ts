import { PrismaClient } from '@prisma/client';
import { env } from '../config';

// Singleton pattern — prevents connection pool exhaustion during hot-reload in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  /* istanbul ignore next */
  globalForPrisma.prisma ?? new PrismaClient({ log: env.NODE_ENV === 'test' ? [] : ['error'] });

/* istanbul ignore next */
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
