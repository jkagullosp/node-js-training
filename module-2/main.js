// main.js
const { addTask, completeTask, getPendingTasks, getAllTasks } = require('./tasks');
 
addTask('Learn JavaScript');
addTask('Learn Node.js');
addTask('Build the capstone');
 
completeTask(1);
 
console.log('All tasks:');
console.log(getAllTasks());
 
console.log('\nPending tasks:');
console.log(getPendingTasks());
