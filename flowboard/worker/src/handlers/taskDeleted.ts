import { PrismaClient } from '@prisma/client';
import type { TaskEvent } from '../index';

export async function handleTaskDeleted(
  prisma: PrismaClient,
  event: TaskEvent,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: event.userId,
      action: 'TASK_DELETED',
      entity: 'Task',
      entityId: event.taskId,
    },
  });
}
