import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../errors/AppError';
import { TaskIdParam, CreateTaskSchema, UpdateTaskSchema } from '../schemas/taskSchemas';
import { publishTaskEvent } from '../lib/events';
import logger from '../lib/logger';
import { requireUser } from '../middleware/authenticate';

const router = Router();

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List all tasks owned by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of tasks (may be empty)
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
 *                     $ref: '#/components/schemas/Task'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { board: { ownerId: requireUser(req).id } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a single task by ID
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
 *         description: The task
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
 *                   $ref: '#/components/schemas/Task'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Task belongs to a board owned by a different user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /tasks/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TaskIdParam.parse(req.params);
    const task = await prisma.task.findUnique({
      where: { id },
      include: { board: { select: { ownerId: true } } },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.board.ownerId !== requireUser(req).id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    res.json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task on a board
 *     description: >
 *       The board identified by boardId must exist and be owned by the
 *       authenticated user. Returns 404 if the board does not exist, 403 if
 *       the board is owned by a different user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, boardId]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: Fix login redirect bug
 *               description:
 *                 type: string
 *                 example: After logout the user is redirected to /dashboard instead of /login
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *                 example: HIGH
 *               boardId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Task created
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
 *                   $ref: '#/components/schemas/Task'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Board is owned by a different user
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
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /tasks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateTaskSchema.parse(req.body);

    const board = await prisma.board.findUnique({ where: { id: body.boardId } });
    if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
    if (board.ownerId !== requireUser(req).id) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    const task = await prisma.task.create({ data: body });
    try {
      await publishTaskEvent({
        type: 'task.created',
        taskId: task.id,
        userId: requireUser(req).id,
        data: {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          boardId: task.boardId,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        },
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

/**
 * @openapi
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Partially update a task
 *     description: All fields are optional. Only the fields provided are updated.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: Updated title
 *               description:
 *                 type: string
 *                 example: Updated description
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, REVIEW, DONE]
 *                 example: IN_PROGRESS
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 example: HIGH
 *     responses:
 *       200:
 *         description: Task updated
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
 *                   $ref: '#/components/schemas/Task'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Task belongs to a board owned by a different user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Task not found
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
    if (existing.board.ownerId !== requireUser(req).id) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    const task = await prisma.task.update({ where: { id }, data: body });
    try {
      await publishTaskEvent({
        type: 'task.updated',
        taskId: task.id,
        userId: requireUser(req).id,
        data: { ...body },
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

/**
 * @openapi
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
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
 *         description: Task belongs to a board owned by a different user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// DELETE /tasks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TaskIdParam.parse(req.params);

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { board: { select: { ownerId: true } } },
    });
    if (!existing) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (existing.board.ownerId !== requireUser(req).id) throw new AppError('Forbidden', 403, 'FORBIDDEN');

    await prisma.task.delete({ where: { id } });
    try {
      await publishTaskEvent({
        type: 'task.deleted',
        taskId: id,
        userId: requireUser(req).id,
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
