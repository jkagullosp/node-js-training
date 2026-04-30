const express = require('express');
const app = express();

app.use(express.json());

// In-memory data store for users
let users = [];
let nextUserId = 1;

// List all users
app.get('/users', (req, res) => {
  res.json(users);
});

// Get one user by id
app.get('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// Create a new user
app.post('/users', (req, res) => {
  const { name, email } = req.body;
  
  // Validation: both name and email are required
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  const user = {
    id: nextUserId++,
    name,
    email,
    createdAt: new Date().toISOString()
  };
  
  users.push(user);
  res.status(201).json(user);
});

// Update a user
app.put('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find(u => u.id === id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { name, email } = req.body;
  
  // Only update fields that are provided in the request body
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  
  res.json(user);
});

// Delete a user
app.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users.splice(index, 1);
  res.status(204).send();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Users API running at http://localhost:${PORT}`);
});