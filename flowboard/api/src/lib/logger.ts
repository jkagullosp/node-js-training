import pino from 'pino';
import { env } from '../config';

const logger = pino({
  /* istanbul ignore next */
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.token',
      'req.body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: /* istanbul ignore next */
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

export default logger;
