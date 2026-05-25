import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { env } from '../config';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { AppError } from '../errors/AppError';
import { rateLimiter } from '../middleware/rateLimiter';
import { checkLoginFailures, recordLoginFailure, resetLoginFailures } from '../middleware/loginBruteForce';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  LogoutSchema,
} from '../schemas/authSchemas';

const router = Router();

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 604800;

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

function isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>)['sub'] === 'string' &&
    typeof (payload as Record<string, unknown>)['jti'] === 'string'
  );
}

function issueAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

async function issueRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

  await redis.set(
    `refresh:${userId}:${jti}`,
    '1',
    'EX',
    REFRESH_TOKEN_TTL_SECONDS
  );

  return token;
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: supersecret
 *     responses:
 *       201:
 *         description: User created — returns token pair
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
 *                   $ref: '#/components/schemas/TokenPair'
 *       409:
 *         description: Email already in use
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
// POST /auth/register
router.post('/register', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = RegisterSchema.parse(req.body);

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user: { id: string; email: string };
    try {
      user = await prisma.user.create({
        data: { email, password: hashed },
        select: { id: true, email: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppError('Email already in use', 409, 'CONFLICT');
      }
      /* istanbul ignore next */
      throw err;
    }

    const accessToken = issueAccessToken(user.id, user.email);
    const refreshToken = await issueRefreshToken(user.id);

    res.status(201).json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and obtain tokens
 *     description: >
 *       Rate limited to 100 requests per 15-minute window per IP.
 *       Returns 429 when the limit is exceeded.
 *       Returns 401 after repeated failed attempts (brute-force protection).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: supersecret
 *     responses:
 *       200:
 *         description: Login successful — returns token pair
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
 *                   $ref: '#/components/schemas/TokenPair'
 *       401:
 *         description: Invalid credentials or brute-force lockout
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
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /auth/login
router.post('/login', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const ip = req.ip ?? 'unknown';

    await checkLoginFailures(ip);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });

    // Constant-time-safe: always run bcrypt compare to prevent timing attacks
    const passwordHash = user?.password ?? '$2b$12$WnPPNcpj4oXqYFnD/fqMPuCBxGrEtJzGROCjWXWb4MVFaJnpO4zRK';
    const match = await bcrypt.compare(password, passwordHash);

    if (!user || !match) {
      await recordLoginFailure(ip);
      throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');
    }

    await resetLoginFailures(ip);

    const accessToken = issueAccessToken(user.id, user.email);
    const refreshToken = await issueRefreshToken(user.id);

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the refresh token and get a new access token
 *     description: >
 *       Implements token rotation — the submitted refresh token is invalidated
 *       and a new token pair is issued. The old refresh token cannot be reused.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGci...
 *     responses:
 *       200:
 *         description: Token refreshed — returns new token pair
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
 *                   $ref: '#/components/schemas/TokenPair'
 *       401:
 *         description: Refresh token invalid, expired, or already rotated
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
// POST /auth/refresh
router.post('/refresh', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: incomingToken } = RefreshTokenSchema.parse(req.body);

    let payload: RefreshTokenPayload;
    try {
      const decoded = jwt.verify(incomingToken, env.JWT_REFRESH_SECRET);
      if (!isRefreshTokenPayload(decoded)) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }
      payload = decoded;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const redisKey = `refresh:${payload.sub}:${payload.jti}`;
    const exists = await redis.get(redisKey);

    if (!exists) {
      // Token not in store — replay attack or already rotated
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Re-fetch email before invalidating old token — if user is deleted we abort cleanly
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { email: true },
    });

    if (!user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Invalidate old token only after confirming user still exists
    await redis.del(redisKey);

    const accessToken = issueAccessToken(payload.sub, user.email);
    const refreshToken = await issueRefreshToken(payload.sub);

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Invalidate a refresh token
 *     description: >
 *       Idempotent. If the refresh token is already expired or invalid, the
 *       endpoint still returns 204 — it never errors on token state.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGci...
 *     responses:
 *       204:
 *         description: Logged out — no body
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /auth/logout
router.post('/logout', rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = LogoutSchema.parse(req.body);

    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
      if (isRefreshTokenPayload(decoded)) {
        await redis.del(`refresh:${decoded.sub}:${decoded.jti}`);
      }
    } catch {
      // Logout is idempotent — if the token is already invalid or expired, that's fine
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
