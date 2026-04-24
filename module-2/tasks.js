// tasks.js
let tasks = [];
 
function addTask(title) {
  const task = { id: tasks.length + 1, title, done: false };
  tasks.push(task);
  return task;
}
 
function completeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) task.done = true;
  return task;
}
 
function getPendingTasks() {
  return tasks.filter(t => !t.done);
}
 
function getAllTasks() {
  return tasks;
}
 
module.exports = {
  addTask,
  completeTask,
  getPendingTasks,
  getAllTasks
};
