import { type Request, type Response, type NextFunction, type ErrorRequestHandler } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // Restore prototype chain — required when extending built-ins in TypeScript
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
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        status: err.statusCode,
        message: err.message,
      },
    });
    return;
  }

  // Unhandled / non-operational errors
  const message = isProduction ? 'Internal server error' : (err instanceof Error ? err.message : 'Unknown error');

  res.status(500).json({
    error: {
      status: 500,
      message,
      ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
};
