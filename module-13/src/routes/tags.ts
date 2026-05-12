// src/routes/tags.ts
import { Router, Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { prisma } from '../db';
import { createTagSchema, idParamSchema } from '../schemas';
import { validate } from '../validate';
import { asyncHandler } from '../async-handler';

const router = Router();

// List all tags
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
  res.json(tags);
}));

// Create a tag
router.post('/', validate(createTagSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const tag = await prisma.tag.create({ data: req.body });
    res.status(201).json(tag);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: { status: 409, message: 'Tag name already exists' } });
      return;
    }
    throw err;
  }
}));

// Get one tag
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { status: 400, message: 'id must be a positive integer' } });
    return;
  }
  const tag = await prisma.tag.findUnique({ where: { id: parsed.data.id } });
  if (!tag) {
    res.status(404).json({ error: { status: 404, message: 'Tag not found' } });
    return;
  }
  res.json(tag);
}));

// Delete a tag
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { status: 400, message: 'id must be a positive integer' } });
    return;
  }
  try {
    await prisma.tag.delete({ where: { id: parsed.data.id } });
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: { status: 404, message: 'Tag not found' } });
      return;
    }
    throw err;
  }
}));

export default router;
