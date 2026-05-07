// src/types-demo.ts
 
// --- Interface: defines the shape of an object ---
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';  // literal union type
  bio?: string;               // optional (can be undefined)
}
 
// --- Using the interface ---
const user1: User = {
  id: 1,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'admin'
  // bio is optional, so we can omit it
};
 
// --- This would fail: missing required 'email' field ---
// const bad: User = { id: 2, name: 'Bob', role: 'member' };
 
// --- Function that takes an interface as parameter ---
function displayUser(user: User): void {
  console.log(`[${user.role.toUpperCase()}] ${user.name} (${user.email})`);
  if (user.bio) {
    console.log(`  Bio: ${user.bio}`);
  }
}
 
displayUser(user1);
 
// --- Type alias: another way to define types ---
type Status = 'todo' | 'in_progress' | 'done';
 
interface Task {
  id: number;
  title: string;
  status: Status;
  assignedTo?: User;
}
 
const task: Task = {
  id: 1,
  title: 'Learn TypeScript',
  status: 'in_progress',
  assignedTo: user1
};
 
console.log(`Task: ${task.title} — ${task.status}`);
 
// --- Array of typed objects ---
const tasks: Task[] = [
  { id: 1, title: 'Read docs', status: 'done' },
  { id: 2, title: 'Write code', status: 'in_progress' },
  { id: 3, title: 'Write tests', status: 'todo' }
];
 
const pending = tasks.filter(t => t.status !== 'done');
console.log(`Pending tasks: ${pending.length}`);
