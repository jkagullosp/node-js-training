const { z } = require("zod");

const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").trim(),
  content: z.string().min(1, "Content is required").trim(),
  tag: z.string().trim().nullable().optional(),
});

const updateNoteSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").trim().optional(),
  content: z.string().min(1, "Content cannot be empty").trim().optional(),
  tag: z.string().trim().nullable().optional(),
});

const querySchema = z.object({
  tag: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  sort: z
    .string()
    .regex(
      /^(id|title|content|tag|createdAt|updatedAt):(asc|desc)$/,
      "sort must be field:direction (e.g. title:asc)"
    )
    .optional(),
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: result.error.format() });
  }
  req.validatedQuery = result.data;
  next();
};

module.exports = { validate, validateQuery, createNoteSchema, updateNoteSchema, querySchema };
