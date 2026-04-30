const express = require('express');
const app = express();

app.use(express.json());

// In-memory data store for projects and their nested tasks
let projects = [
  { 
    id: 1, 
    name: 'Website Redesign', 
    tasks: [
      { id: 1, title: 'Mockups', done: true },
      { id: 2, title: 'Build homepage', done: false }
    ]
  },
  { 
    id: 2, 
    name: 'API Migration', 
    tasks: [] 
  }
];

// Global task ID tracker based on existing data
let nextTaskId = 3;

// List all projects
app.get('/projects', (req, res) => {
  res.json(projects);
});

// List tasks for a specific project
app.get('/projects/:id/tasks', (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = projects.find(p => p.id === projectId);
  
  // Return 404 if the parent project doesn't exist
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project.tasks);
});

// Add a new task to a specific project
app.post('/projects/:id/tasks', (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = projects.find(p => p.id === projectId);
  
  // Validate parent project exists
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const { title } = req.body;
  
  // Validate task payload
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const newTask = { 
    id: nextTaskId++, 
    title, 
    done: false 
  };
  
  project.tasks.push(newTask);
  res.status(201).json(newTask);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Nested API running at http://localhost:${PORT}`);
});