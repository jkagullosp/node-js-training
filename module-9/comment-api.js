// comment-api.js
const express = require('express');

function createCommentApp() {
  const app = express();
  app.use(express.json());

  let comments = [];
  let nextId = 1;

  app.get('/comments', (req, res) => {
    res.json(comments);
  });

  app.get('/comments/:id', (req, res) => {
    const comment = comments.find(c => c.id === parseInt(req.params.id));
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.json(comment);
  });

  app.post('/comments', (req, res) => {
    const { text, author } = req.body;
    if (!text || !author) return res.status(400).json({ error: 'text and author are required' });
    const comment = { id: nextId++, text, author };
    comments.push(comment);
    res.status(201).json(comment);
  });

  return app;
}

module.exports = createCommentApp;
