// src/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import type { $ZodIssue } from 'zod/v4/core';
 
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: {
            status: 400,
            message: 'Validation failed',
            details: err.issues.map((e: $ZodIssue) => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(err);
    }
  };
}
