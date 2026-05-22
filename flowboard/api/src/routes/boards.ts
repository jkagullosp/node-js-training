import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { BoardIdParam, CreateBoardSchema } from '../schemas/boardSchemas';
import { requireUser } from '../middleware/authenticate';

const router = Router();

// GET /boards
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boards = await prisma.board.findMany({
      where: { ownerId: requireUser(req).id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: boards });
  } catch (err) {
    next(err);
  }
});

// POST /boards
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = CreateBoardSchema.parse(req.body);
    const board = await prisma.board.create({
      data: { name, ownerId: requireUser(req).id },
    });
    res.status(201).json({ success: true, data: board });
  } catch (err) {
    next(err);
  }
});

// GET /boards/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = BoardIdParam.parse(req.params);
    const board = await prisma.board.findUnique({
      where: { id },
      include: { tasks: true },
    });
    if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
    if (board.ownerId !== requireUser(req).id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    res.json({ success: true, data: board });
  } catch (err) {
    next(err);
  }
});

// DELETE /boards/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = BoardIdParam.parse(req.params);
    const board = await prisma.board.findUnique({ where: { id } });
    if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
    if (board.ownerId !== requireUser(req).id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    await prisma.board.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
