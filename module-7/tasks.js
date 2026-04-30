// tasks.js
const express = require('express');
const morgan = require('morgan');
 
const app = express();

// Global Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(requestTimer);
 
// In-memory data store
let tasks = [
  { id: 1, title: 'Learn middleware', done: false }
];
let nextId = 2;
 
// Custom error class for HTTP errors
class HttpError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    if (details) {
      this.details = details;
    }
  }
}
 
// Request Timer Middleware
function requestTimer(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const elapsed = Date.now() - start;
        console.log(`${req.method} ${req.path} took ${elapsed} ms`);
    });
    next();
}

// Authentication Middleware
function fakeAuth(req, res, next) {
  const apiKey = req.header('X-API-Key');
  if (!apiKey || apiKey !== 'secret123') {
    return next(new HttpError(401, 'Unauthorized: Invalid or missing API Key'));
  }
  next();
}

// Validation Middleware (Collects all errors)
function validateTask(req, res, next) {
  if (!req.body) {
    return next(new HttpError(400, 'Request body is missing or invalid JSON'));
  }

  const errors = [];
  const { title } = req.body;

  // Rule 1: Title must be provided and cannot be an empty string
  if (title === undefined || title === null || title === '') {
    errors.push('title is required');
  }

  // Rule 2: If provided, title must be a string
  if (title !== undefined && title !== null && typeof title !== 'string') {
    errors.push('title must be a string');
  }

  // Rule 3: Title length restriction
  if (typeof title === 'string' && title.length > 100) {
    errors.push('title must be 100 characters or less');
  }

  // If any errors were collected, trigger the error handler with the details array
  if (errors.length > 0) {
    return next(new HttpError(400, 'Validation failed', errors));
  }

  next();
}
 
// --- ROUTES ---

// GET routes are public
app.get('/tasks', (req, res) => {
  res.json(tasks);
});
 
app.get('/tasks/:id', (req, res, next) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return next(new HttpError(404, 'Task not found'));
  res.json(task);
});
 
// POST and PUT require Auth AND Validation
app.post('/tasks', fakeAuth, validateTask, (req, res) => {
  const task = { id: nextId++, title: req.body.title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});
 
app.put('/tasks/:id', fakeAuth, validateTask, (req, res, next) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  if (!task) return next(new HttpError(404, 'Task not found'));
  
  task.title = req.body.title;
  if (req.body.done !== undefined) task.done = req.body.done;
  
  res.json(task);
});
 
// DELETE requires Auth (but no body validation needed)
app.delete('/tasks/:id', fakeAuth, (req, res, next) => {
  const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return next(new HttpError(404, 'Task not found'));
  
  tasks.splice(idx, 1);
  res.status(204).send();
});
 
// --- ERROR HANDLING ---

// 404 handler for unknown routes
app.use((req, res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
});
 
// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  console.error(`[ERROR] ${status} ${message}`);
  
  const errorPayload = {
    status,
    message
  };

  // Append validation details if they exist
  if (err.details) {
    errorPayload.details = err.details;
  }

  res.status(status).json({
    error: errorPayload
  });
});
 
// --- SERVER START ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Tasks API running at http://localhost:${PORT}`);
});