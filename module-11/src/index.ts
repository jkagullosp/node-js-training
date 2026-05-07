// src/index.ts
 
// --- Basic type annotations ---
const name: string = 'Ana';
const age: number = 28;
const isActive: boolean = true;
 
console.log(`${name} is ${age} years old. Active: ${isActive}`);
 
// --- Function with typed parameters and return type ---
function greet(person: string, greeting: string = 'Hello'): string {
  return `${greeting}, ${person}!`;
}
 
console.log(greet('World'));
console.log(greet('TypeScript', 'Welcome to'));
 
// --- This would be a compile error (uncomment to try): ---
// console.log(greet(42));  // Error: Argument of type 'number' is not assignable
 
// --- Arrays ---
const scores: number[] = [95, 87, 91, 78];
const names: string[] = ['Ana', 'Bruno', 'Carlos'];
 
// --- Type inference: TS knows this is a number ---
const total = scores.reduce((sum, s) => sum + s, 0);
console.log(`Total: ${total}`);
 
// --- Union types: can be one of several types ---
function formatId(id: string | number): string {
  if (typeof id === 'string') {
    return id.toUpperCase();
  }
  return `#${id}`;
}
 
console.log(formatId('abc'));  // ABC
console.log(formatId(123));   // #123
