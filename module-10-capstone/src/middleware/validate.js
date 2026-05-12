const { z } = require("zod");

const createNoteSchema = z.object({
  title: z.string().min(1, "title is required").max(100, "title must be 100 characters or less").trim(),
  content: z.string().min(1, "content is required").max(5000, "content must be 5000 characters or less").trim(),
  tag: z.string().trim().nullable().optional(),
});

const updateNoteSchema = z.object({
  title: z.string().min(1, "title cannot be empty").max(100, "title must be 100 characters or less").trim().optional(),
  content: z.string().min(1, "content cannot be empty").max(5000, "content must be 5000 characters or less").trim().optional(),
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
    const issue = result.error.issues?.[0] ?? result.error.errors?.[0];
    // Zod v4 reports missing fields as invalid_type; derive a friendlier message from the path
    let message = issue.message;
    if (issue.code === "invalid_type" && issue.message.includes("undefined") && issue.path.length > 0) {
      message = `${issue.path[0]} is required`;
    }
    return res.status(400).json({ error: { status: 400, message } });
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
