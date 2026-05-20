import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';

export default async function globalTeardown(): Promise<void> {
  await prisma.$disconnect();
  await redis.quit();
}
