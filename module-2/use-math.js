// use-math.js
const math = require('./math-utils.js');

const myNumber = 5;
const myNumbersArray = [10, 20, 30, 40, 50];

console.log(`Square of ${myNumber}:`, math.square(myNumber));
console.log(`Cube of ${myNumber}:`, math.cube(myNumber));
console.log(`Average of [${myNumbersArray}]:`, math.average(myNumbersArray));
console.log(`Max of [${myNumbersArray}]:`, math.max(myNumbersArray));