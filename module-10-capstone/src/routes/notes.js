const express = require("express");
const morgan = require("morgan");
const prisma = require("../db");
const { validate, createNoteSchema, updateNoteSchema } = require("../middleware/validate");

const router = express.Router();
router.use(morgan("dev"));

// POST /notes
router.post("/", validate(createNoteSchema), async (req, res) => {
  try {
    const { title, content, tag } = req.body;
    const note = await prisma.note.create({
      data: { title, content, tag: tag ?? null },
    });
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: { status: 500, message: "Failed to create note" } });
  }
});

// GET /notes
router.get("/", async (req, res) => {
  try {
    const { tag } = req.query;
    const where = {};
    if (tag) where.tag = tag;

    const notes = await prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ error: { status: 500, message: "Failed to fetch notes" } });
  }
});

// GET /notes/:id
router.get("/:id", async (req, res) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!note) {
      return res.status(404).json({ error: { status: 404, message: "Note not found" } });
    }
    return res.status(200).json(note);
  } catch (error) {
    res.status(500).json({ error: { status: 500, message: "Failed to fetch note" } });
  }
});

// PUT /notes/:id
router.put("/:id", validate(updateNoteSchema), async (req, res) => {
  try {
    const note = await prisma.note.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    return res.status(200).json(note);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: { status: 404, message: "Note not found" } });
    }
    res.status(500).json({ error: { status: 500, message: "Failed to update note" } });
  }
});

// DELETE /notes/:id
router.delete("/:id", async (req, res) => {
  try {
    await prisma.note.delete({
      where: { id: parseInt(req.params.id) },
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: { status: 404, message: "Note not found" } });
    }
    return res.status(500).json({ error: { status: 500, message: "Failed to delete note" } });
  }
});

module.exports = router;
