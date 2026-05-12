// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import notesRouter from './routes/notes';
import tagsRouter from './routes/tags';
 
const app = express();
app.use(express.json());
 
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});
 
app.use('/notes', notesRouter);
app.use('/tags', tagsRouter);
 
// Error handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err instanceof Error ? err.stack : err);
  res.status(500).json({ error: { status: 500, message: 'Internal server error' } });
});
 
export default app;
