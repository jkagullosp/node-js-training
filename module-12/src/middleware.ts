// src/middleware.ts
import { Request, Response, NextFunction } from 'express';
 
// Custom error class
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
 
// Request timer middleware
export function requestTimer(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${elapsed}ms`);
  });
  next();
}
 
// Error handler (4 params — TypeScript knows this is an error handler)
export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[ERROR] ${status} ${message}`);
  res.status(status).json({ error: { status, message } });
}
