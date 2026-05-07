const express = require("express");
const prisma = require("../db");
const { validateCreateNote, validateUpdateNote } = require("../middleware/validate");

const router = express.Router();

// POST /notes - Create a note
router.post("/", validateCreateNote, async (req, res) => {
  try {
    const { title, content, tag } = req.body;

    const note = await prisma.note.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        tag: tag ? tag.trim() : null,
      },
    });

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: { status: 500, message: "Failed to create note" } });
  }
});

// GET /notes - Get all notes
router.get("/", async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ error: { status: 500, message: "Failed to fetch notes" } });
  }
});

// GET /notes/:id - Get a single note
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

// PUT /notes/:id - Update a note
router.put("/:id", validateUpdateNote, async (req, res) => {
  try {
    const { title, content, tag } = req.body;

    const note = await prisma.note.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(tag !== undefined && { tag: tag ? tag.trim() : null }),
      },
    });

    return res.status(200).json(note);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: { status: 404, message: "Note not found" } });
    }
    res.status(500).json({ error: { status: 500, message: "Failed to update note" } });
  }
});

// DELETE /notes/:id - Delete a note
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
