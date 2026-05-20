import { type Request, type Response, type NextFunction, type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { env } from '../config';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Zod validation failure → 422
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: err.errors,
    });
    return;
  }

  // Prisma record-not-found → 404
  /* istanbul ignore if */
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2025'
  ) {
    res.status(404).json({
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Known operational error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  // Unknown / unexpected error — hide internals in production
  const isProduction = env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    message: isProduction
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Unknown error',
    code: 'INTERNAL_ERROR',
  });
};
