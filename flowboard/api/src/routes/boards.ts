import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { BoardIdParam, CreateBoardSchema } from '../schemas/boardSchemas';
import { requireUser } from '../middleware/authenticate';

const router = Router();

/**
 * @openapi
 * /boards:
 *   get:
 *     tags: [Boards]
 *     summary: List all boards owned by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of boards (may be empty)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Board'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /boards:
 *   post:
 *     tags: [Boards]
 *     summary: Create a new board
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: Sprint 12
 *     responses:
 *       201:
 *         description: Board created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Board'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /boards/{id}:
 *   get:
 *     tags: [Boards]
 *     summary: Get a board with its tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Board with embedded tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BoardWithTasks'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Board belongs to a different user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Board not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /boards/{id}:
 *   delete:
 *     tags: [Boards]
 *     summary: Delete a board and all its tasks
 *     description: Cascade-deletes all tasks belonging to this board.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted — no body
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Board belongs to a different user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Board not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
