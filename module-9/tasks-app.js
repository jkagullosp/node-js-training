// tasks-app.js
const express = require('express');
 
function createApp() {
  const app = express();
  app.use(express.json());
 
  let tasks = [];
  let nextId = 1;
 
  app.get('/tasks', (req, res) => {
    res.json(tasks);
  });
 
  app.get('/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  });
 
  app.post('/tasks', (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const task = { id: nextId++, title, done: false };
    tasks.push(task);
    res.status(201).json(task);
  });
 
  app.delete('/tasks/:id', (req, res) => {
    const idx = tasks.findIndex(t => t.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    tasks.splice(idx, 1);
    res.status(204).send();
  });

  app.put('/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (!task) return res.status(404).json({ error: 'Not found' });

    if (req.body.title !== undefined) task.title = req.body.title;
    if (req.body.done !== undefined) task.done = req.body.done;

    res.json(task);
  });
 
  return app;
}
 
module.exports = createApp
