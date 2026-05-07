function validateCreateNote(req, res, next) {
  const { title, content, tag } = req.body;

  if (!title) {
    return res.status(400).json({ error: { status: 400, message: "title is required" } });
  }

  if (!content) {
    return res.status(400).json({ error: { status: 400, message: "content is required" } });
  }

  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 100) {
    return res.status(400).json({ error: { status: 400, message: "title must be a non-empty string of 1–100 characters" } });
  }

  if (typeof content !== "string" || content.trim().length === 0 || content.trim().length > 5000) {
    return res.status(400).json({ error: { status: 400, message: "content must be a non-empty string of 1–5000 characters" } });
  }

  if (tag !== undefined && (typeof tag !== "string" || tag.trim().length > 30)) {
    return res.status(400).json({ error: { status: 400, message: "tag must be a string of max 30 characters" } });
  }

  next();
}

function validateUpdateNote(req, res, next) {
  const { title, content, tag } = req.body;

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 100) {
      return res.status(400).json({ error: { status: 400, message: "title must be a non-empty string of 1–100 characters" } });
    }
  }

  if (content !== undefined) {
    if (typeof content !== "string" || content.trim().length === 0 || content.trim().length > 5000) {
      return res.status(400).json({ error: { status: 400, message: "content must be a non-empty string of 1–5000 characters" } });
    }
  }

  if (tag !== undefined && (typeof tag !== "string" || tag.trim().length > 30)) {
    return res.status(400).json({ error: { status: 400, message: "tag must be a string of max 30 characters" } });
  }

  next();
}

module.exports = { validateCreateNote, validateUpdateNote };
