import { z } from 'zod';

export const BoardIdParam = z.object({
  id: z.string().uuid(),
});

export const CreateBoardSchema = z.object({
  name: z.string().min(1).max(255),
}).strict();

export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;
