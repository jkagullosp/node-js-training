import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { TaskIdParam, CreateTaskSchema, UpdateTaskSchema } from '../schemas/taskSchemas';
import { publishTaskEvent } from '../lib/events';
import logger from '../lib/logger';

const router = Router();

// GET /tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { board: { ownerId: req.user!.id } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    const task = await prisma.task.findUnique({
      where: { id },
      include: { board: { select: { ownerId: true } } },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.board.ownerId !== req.user!.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

// POST /tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateTaskSchema.parse(req.body);

    const board = await prisma.board.findUnique({ where: { id: body.boardId } });
    if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
    if (board.ownerId !== req.user!.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    const task = await prisma.task.create({ data: body });
    try {
      await publishTaskEvent({
        type: 'task.created',
        taskId: task.id,
        userId: req.user!.id,
        data: task as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
    } catch (eventErr) {
      logger.error({ err: eventErr, taskId: task.id }, '[tasks] failed to publish task.created event');
    }
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

// PATCH /tasks/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    const body = UpdateTaskSchema.parse(req.body);

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { board: { select: { ownerId: true } } },
    });
    if (!existing) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (existing.board.ownerId !== req.user!.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    const task = await prisma.task.update({ where: { id }, data: body });
    try {
      await publishTaskEvent({
        type: 'task.updated',
        taskId: task.id,
        userId: req.user!.id,
        data: body as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
    } catch (eventErr) {
      logger.error({ err: eventErr, taskId: task.id }, '[tasks] failed to publish task.updated event');
    }
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TaskIdParam.parse(req.params);

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { board: { select: { ownerId: true } } },
    });
    if (!existing) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (existing.board.ownerId !== req.user!.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    await prisma.task.delete({ where: { id } });
    try {
      await publishTaskEvent({
        type: 'task.deleted',
        taskId: id,
        userId: req.user!.id,
        data: {},
        timestamp: new Date().toISOString(),
      });
    } catch (eventErr) {
      logger.error({ err: eventErr, taskId: id }, '[tasks] failed to publish task.deleted event');
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
