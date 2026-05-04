// app.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// List all tasks
app.get("/tasks", async (req, res, next) => {
  try {
    const { done, tag } = req.query;
    const where = {};
    if (done !== undefined) where.done = done === "true";
    if (tag) where.tag = tag;

    // You MUST include the 'where' object here
    const tasks = await prisma.task.findMany({
      where, 
      orderBy: { createdAt: "desc" },
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// Get one task
app.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Create a task
app.post("/tasks", async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const task = await prisma.task.create({
      data: { title },
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Update a task
app.put("/tasks/:id", async (req, res, next) => {
  try {
    const task = await prisma.task.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(task);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Task not found" });
    }
    next(err);
  }
});

// Delete a task
app.delete("/tasks/:id", async (req, res, next) => {
  try {
    await prisma.task.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Task not found" });
    }
    next(err);
  }
});

// List all notes - FIXED
app.get("/notes", async (req, res, next) => {
  try {
    // findMany returns an array directly, not an object with a 'notes' property
    const notes = await prisma.note.findMany();
    res.json(notes);
  } catch (error) {
    next(error);
  }
});

// Create a note - FIXED
app.post("/notes", async (req, res, next) => {
  try {
    const { title, content } = req.body; // Use the fields from your model

    if (!title || !content) {
      return res.status(400).json({ error: "title and content are required" });
    }

    const note = await prisma.note.create({
      data: { title, content },
    });

    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
});

app.delete("/notes/:id", async (req, res, next) => {
  try {
    await prisma.note.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.put("/notes/:id", async (req, res, next) => {
  try {
    const note = await prisma.note.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });

    res.json(note); // Changed 'task' to 'note'
  } catch (error) {
    // Standard Prisma error code for "Record not found"
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Note not found" });
    }
    next(error);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Tasks API running at http://localhost:${PORT}`);
});
