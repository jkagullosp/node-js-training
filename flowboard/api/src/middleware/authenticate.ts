import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';

interface AccessTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>)['sub'] === 'string' &&
    typeof (payload as Record<string, unknown>)['email'] === 'string'
  );
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    next(new AppError('JWT_SECRET is not configured', 500, 'INTERNAL_ERROR'));
    return;
  }

  try {
    const payload = jwt.verify(token, secret);

    if (!isAccessTokenPayload(payload)) {
      next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      return;
    }

    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
  }
}
