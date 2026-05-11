import { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const validateCreateTask = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { title } = req.body;

  if (typeof title !== "string") {
    return next(new HttpError(400, "Title is required and must be a string"));
  }

  if (title.length < 1 || title.length > 100) {
    return next(
      new HttpError(400, "Title must be between 1 and 100 characters"),
    );
  }

  next();
};

type RuleFunction = (value: any) => string | null;

type ValidationSchema = {
  [key: string]: RuleFunction;
};

export const validateBody = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const [field, validateRule] of Object.entries(schema)) {
      const errorMessage = validateRule(req.body[field]);

      if (errorMessage) {
        return next(new HttpError(400, `Field '${field}': ${errorMessage}`));
      }
    }
    next();
  };
};
