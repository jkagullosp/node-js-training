import { redis } from './redis';

interface TaskEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted';
  taskId: string;
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function publishTaskEvent(event: TaskEvent): Promise<void> {
  await redis.xadd('tasks:events', '*', 'payload', JSON.stringify(event));
}
