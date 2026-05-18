import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { TaskIdParam, CreateTaskSchema, UpdateTaskSchema } from '../schemas/taskSchemas';

const router = Router();

// GET /tasks
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.task.findMany({
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
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
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

    const task = await prisma.task.create({ data: body });
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

    const task = await prisma.task.update({ where: { id }, data: body });
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    await prisma.task.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
