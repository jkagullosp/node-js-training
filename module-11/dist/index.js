"use strict";
// src/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
// --- Basic type annotations ---
const name = 'Ana';
const age = 28;
const isActive = true;
console.log(`${name} is ${age} years old. Active: ${isActive}`);
// --- Function with typed parameters and return type ---
function greet(person, greeting = 'Hello') {
    return `${greeting}, ${person}!`;
}
console.log(greet('World'));
console.log(greet('TypeScript', 'Welcome to'));
// --- This would be a compile error (uncomment to try): ---
// console.log(greet(42));  // Error: Argument of type 'number' is not assignable
// --- Arrays ---
const scores = [95, 87, 91, 78];
const names = ['Ana', 'Bruno', 'Carlos'];
// --- Type inference: TS knows this is a number ---
const total = scores.reduce((sum, s) => sum + s, 0);
console.log(`Total: ${total}`);
// --- Union types: can be one of several types ---
function formatId(id) {
    if (typeof id === 'string') {
        return id.toUpperCase();
    }
    return `#${id}`;
}
console.log(formatId('abc')); // ABC
console.log(formatId(123)); // #123
//# sourceMappingURL=index.js.map