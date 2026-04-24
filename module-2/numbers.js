// Array methods

const numbers = [1,2,3,4,5,6,7,8,9,10];

const doubled = numbers.map(num => num * 2);

const even = numbers.filter(num => num % 2 === 0);

const sum = numbers.reduce((acc, curr) => acc + curr, 0);

console.log("Doubled numbers: ", doubled);
console.log("Even numbers: ", even);
console.log("Total Sum: ", sum);