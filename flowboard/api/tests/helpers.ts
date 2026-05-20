import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';

/**
 * Wipes all application data in FK-safe order and flushes Redis.
 * Call in beforeEach (or beforeAll) to guarantee a clean slate.
 */
export async function cleanDb(): Promise<void> {
  // Flush Redis first — clears refresh tokens, rate-limit counters, etc.
  await redis.flushdb();
  // Audit logs reference users — delete first
  await prisma.auditLog.deleteMany();
  // Tasks reference boards — delete before boards
  await prisma.task.deleteMany();
  // Boards reference users — delete before users
  await prisma.board.deleteMany();
  // Users last
  await prisma.user.deleteMany();
}
