import { PrismaClient, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Fixed UUIDs so upserts are idempotent across re-runs
const SEED_USER_EMAIL = 'dev@flowboard.test';
const SEED_BOARD_1_ID = '00000000-0000-0000-0000-000000000001';
const SEED_BOARD_2_ID = '00000000-0000-0000-0000-000000000002';
const SEED_TASK_1_ID = '00000000-0000-0000-0000-000000000010';
const SEED_TASK_2_ID = '00000000-0000-0000-0000-000000000011';
const SEED_TASK_3_ID = '00000000-0000-0000-0000-000000000012';
const SEED_TASK_4_ID = '00000000-0000-0000-0000-000000000013';

async function main(): Promise<void> {
  console.log('Seeding database...\n');

  // ── User ──────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Password1!', 12);

  const user = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: {},
    create: {
      email: SEED_USER_EMAIL,
      password: hashedPassword,
    },
  });
  console.log(`[User]  id=${user.id}  email=${user.email}`);

  // ── Boards ────────────────────────────────────────────────────────────────
  const board1 = await prisma.board.upsert({
    where: { id: SEED_BOARD_1_ID },
    update: {},
    create: {
      id: SEED_BOARD_1_ID,
      name: 'Backend Sprint',
      ownerId: user.id,
    },
  });
  console.log(`[Board] id=${board1.id}  name="${board1.name}"`);

  const board2 = await prisma.board.upsert({
    where: { id: SEED_BOARD_2_ID },
    update: {},
    create: {
      id: SEED_BOARD_2_ID,
      name: 'Infrastructure',
      ownerId: user.id,
    },
  });
  console.log(`[Board] id=${board2.id}  name="${board2.name}"`);

  // ── Tasks (covers all TaskStatus and Priority enum values) ────────────────
  const tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    boardId: string;
  }> = [
    {
      id: SEED_TASK_1_ID,
      title: 'Design auth flow',
      description: 'JWT access + refresh token rotation with Redis store.',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      boardId: board1.id,
    },
    {
      id: SEED_TASK_2_ID,
      title: 'Implement task CRUD endpoints',
      description: 'POST /tasks, GET /tasks/:id, PATCH /tasks/:id, DELETE /tasks/:id.',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      boardId: board1.id,
    },
    {
      id: SEED_TASK_3_ID,
      title: 'Add Redis rate limiting',
      description: null,
      status: TaskStatus.REVIEW,
      priority: Priority.MEDIUM,
      boardId: board1.id,
    },
    {
      id: SEED_TASK_4_ID,
      title: 'Set up Nginx reverse proxy',
      description: 'Configure upstream for API container, add SSL termination.',
      status: TaskStatus.TODO,
      priority: Priority.LOW,
      boardId: board2.id,
    },
  ];

  for (const task of tasks) {
    const created = await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: task,
    });
    console.log(
      `[Task]  id=${created.id}  status=${created.status}  priority=${created.priority}  title="${created.title}"`,
    );
  }

  console.log('\nSeed complete.');
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
