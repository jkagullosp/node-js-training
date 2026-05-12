// src/routes/notes.ts
import { Router, Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { prisma } from '../db';
import { createNoteSchema, updateNoteSchema, noteQuerySchema, idParamSchema } from '../schemas';
import { validate } from '../validate';
import { asyncHandler } from '../async-handler';

const router = Router();

// List all notes
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const parsed = noteQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { status: 400, message: parsed.error.issues } });
    return;
  }
  const { tagId, search } = parsed.data;

  const notes = await prisma.note.findMany({
    where: {
      ...(tagId ? { tagId } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } }
        ]
      } : {})
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notes);
}));

// Get one note
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { status: 400, message: 'id must be a positive integer' } });
    return;
  }
  const note = await prisma.note.findUnique({ where: { id: parsed.data.id } });
  if (!note) {
    res.status(404).json({ error: { status: 404, message: 'Note not found' } });
    return;
  }
  res.json(note);
}));

// Create a note
router.post('/', validate(createNoteSchema), asyncHandler(async (req: Request, res: Response) => {
  const note = await prisma.note.create({ data: req.body });
  res.status(201).json(note);
}));

// Update a note
router.put('/:id', validate(updateNoteSchema), asyncHandler(async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { status: 400, message: 'id must be a positive integer' } });
    return;
  }
  try {
    const note = await prisma.note.update({ where: { id: parsed.data.id }, data: req.body });
    res.json(note);
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: { status: 404, message: 'Note not found' } });
      return;
    }
    throw err;
  }
}));

// Delete a note
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: { status: 400, message: 'id must be a positive integer' } });
    return;
  }
  try {
    await prisma.note.delete({ where: { id: parsed.data.id } });
    res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: { status: 404, message: 'Note not found' } });
      return;
    }
    throw err;
  }
}));

export default router;
