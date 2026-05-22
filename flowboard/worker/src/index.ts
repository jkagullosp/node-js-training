import 'dotenv/config';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { handleTaskCreated } from './handlers/taskCreated';
import { handleTaskUpdated } from './handlers/taskUpdated';
import { handleTaskDeleted } from './handlers/taskDeleted';

export type TaskEvent = {
  type: 'task.created' | 'task.updated' | 'task.deleted';
  taskId: string;
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
};

const STREAM_KEY = 'tasks:events';
const DLQ_KEY = 'tasks:events:dlq';
const GROUP_NAME = 'audit-group';
const CONSUMER_NAME = 'worker-1';
const BLOCK_MS = 2000;
const MAX_RETRIES = 3;

const logger = pino({
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  redact: ['event.data.password', 'event.data.token', 'event.data.authorization'],
});

function createRedisClient(): Redis {
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('error', (err: Error) => {
    logger.error({ err: err.message }, '[redis] connection error');
  });

  client.on('connect', () => {
    logger.info('[redis] connected');
  });

  return client;
}

function parseTaskEvent(fields: string[]): TaskEvent {
  // XREADGROUP returns fields as a flat alternating [key, value, key, value...] array
  const fieldMap: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const val = fields[i + 1];
    if (key !== undefined && val !== undefined) {
      fieldMap[key] = val;
    }
  }

  const raw = fieldMap['payload'];
  if (!raw) {
    throw new Error('Missing "payload" field in stream message');
  }

  const parsed: unknown = JSON.parse(raw);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    !('taskId' in parsed) ||
    !('userId' in parsed) ||
    !('data' in parsed) ||
    !('timestamp' in parsed)
  ) {
    throw new Error('Invalid event payload shape');
  }

  const evt = parsed as Record<string, unknown>;

  if (
    evt['type'] !== 'task.created' &&
    evt['type'] !== 'task.updated' &&
    evt['type'] !== 'task.deleted'
  ) {
    throw new Error(`Unknown event type: ${String(evt['type'])}`);
  }

  return {
    type: evt['type'],
    taskId: String(evt['taskId']),
    userId: String(evt['userId']),
    data: typeof evt['data'] === 'object' && evt['data'] !== null
      ? (evt['data'] as Record<string, unknown>)
      : {},
    timestamp: String(evt['timestamp']),
  };
}

async function routeEvent(prisma: PrismaClient, event: TaskEvent): Promise<void> {
  switch (event.type) {
    case 'task.created':
      await handleTaskCreated(prisma, event);
      break;
    case 'task.updated':
      await handleTaskUpdated(prisma, event);
      break;
    case 'task.deleted':
      await handleTaskDeleted(prisma, event);
      break;
  }
}

async function moveToDlq(
  redis: Redis,
  messageId: string,
  fields: string[],
  reason: string,
): Promise<void> {
  const fieldMap: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const val = fields[i + 1];
    if (key !== undefined && val !== undefined) {
      fieldMap[key] = val;
    }
  }

  await redis.xadd(
    DLQ_KEY,
    '*',
    'originalId', messageId,
    'reason', reason,
    'payload', fieldMap['payload'] ?? '',
    'failedAt', new Date().toISOString(),
  );
}

async function initConsumerGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP_NAME, '0', 'MKSTREAM');
    logger.info({ group: GROUP_NAME, stream: STREAM_KEY }, 'Consumer group created');
  } catch (err: unknown) {
    // BUSYGROUP means the group already exists — safe to ignore
    if (err instanceof Error && err.message.includes('BUSYGROUP')) {
      logger.info({ group: GROUP_NAME }, 'Consumer group already exists, continuing');
      return;
    }
    throw err;
  }
}

// Track per-message failure counts in memory (worker is single-process)
const failureCounts = new Map<string, number>();

async function processMessage(
  redis: Redis,
  prisma: PrismaClient,
  messageId: string,
  fields: string[],
): Promise<void> {
  let event: TaskEvent;

  try {
    event = parseTaskEvent(fields);
  } catch (parseErr: unknown) {
    const reason = parseErr instanceof Error ? parseErr.message : 'parse error';
    logger.error({ messageId, reason }, 'Unparseable message — moving to DLQ immediately');
    await moveToDlq(redis, messageId, fields, reason);
    // ACK so it leaves the PEL — it's already in the DLQ
    await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
    failureCounts.delete(messageId);
    return;
  }

  try {
    await routeEvent(prisma, event);
    await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
    failureCounts.delete(messageId);
    logger.info({ messageId, type: event.type, taskId: event.taskId }, 'Event processed');
  } catch (handlerErr: unknown) {
    const count = (failureCounts.get(messageId) ?? 0) + 1;
    failureCounts.set(messageId, count);

    const reason = handlerErr instanceof Error ? handlerErr.message : 'handler error';
    logger.warn({ messageId, type: event.type, attempt: count, reason }, 'Handler failed');

    if (count >= MAX_RETRIES) {
      logger.error({ messageId, type: event.type }, `Max retries (${MAX_RETRIES}) reached — moving to DLQ`);
      await moveToDlq(redis, messageId, fields, reason);
      await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
      failureCounts.delete(messageId);
    } else {
      // Exponential backoff before the next PEL drain: 100ms, 200ms, capped at 30s
      const delayMs = Math.min(100 * Math.pow(2, count - 1), 30_000);
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    // If under max retries: do not ACK — message stays in PEL for retry on next XREADGROUP
  }
}

async function runConsumerLoop(redis: Redis, prisma: PrismaClient): Promise<void> {
  logger.info({ stream: STREAM_KEY, group: GROUP_NAME, consumer: CONSUMER_NAME }, 'Worker started');

  let running = true;

  function shutdown(): void {
    logger.info('Shutdown signal received — stopping consumer loop');
    running = false;
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (running) {
    let results: [string, [string, string[]][]][] | null = null;

    try {
      // First drain any pending (unACKed) messages from the PEL before reading new ones
      const pendingResults = await redis.xreadgroup(
        'GROUP', GROUP_NAME, CONSUMER_NAME,
        'COUNT', '10',
        'STREAMS', STREAM_KEY, '0',
      ) as [string, [string, string[]][]][] | null;

      if (pendingResults && pendingResults.length > 0 && pendingResults[0]?.[1].length > 0) {
        results = pendingResults;
      } else {
        // No pending messages — block for new ones
        results = await redis.xreadgroup(
          'GROUP', GROUP_NAME, CONSUMER_NAME,
          'COUNT', '10',
          'BLOCK', String(BLOCK_MS),
          'STREAMS', STREAM_KEY, '>',
        ) as [string, [string, string[]][]][] | null;
      }
    } catch (readErr: unknown) {
      if (!running) break;
      logger.error({ err: readErr instanceof Error ? readErr.message : readErr }, 'XREADGROUP failed — retrying in 1s');
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    if (!results || results.length === 0) {
      // BLOCK timeout with no messages — loop again
      continue;
    }

    const streamMessages = results[0]?.[1] ?? [];

    for (const [messageId, fields] of streamMessages) {
      await processMessage(redis, prisma, messageId, fields);
    }
  }

  logger.info('Consumer loop stopped — disconnecting');
  await prisma.$disconnect();
  redis.disconnect();
}

async function main(): Promise<void> {
  const redisClient = createRedisClient();

  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const prisma = new PrismaClient();

  await initConsumerGroup(redisClient);
  await runConsumerLoop(redisClient, prisma);
}

main().catch((err: unknown) => {
  logger.error({ err: err instanceof Error ? err.message : err }, 'Fatal worker error');
  process.exit(1);
});
