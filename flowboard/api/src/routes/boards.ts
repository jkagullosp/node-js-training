import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { BoardIdParam, CreateBoardSchema } from '../schemas/boardSchemas';

const router = Router();

// GET /boards
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const boards = await prisma.board.findMany({
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
      data: { name, ownerId: req.user!.id },
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
    res.json({ success: true, data: board });
  } catch (err) {
    next(err);
  }
});

// DELETE /boards/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = BoardIdParam.parse(req.params);
    await prisma.board.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
