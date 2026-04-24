// math-utils.js

const square = (n) => n * n;

const cube = (n) => n * n * n;

const average = (numbers) => {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, curr) => acc + curr, 0);
    return sum / numbers.length;
};

const max = (numbers) => {
    if (numbers.length === 0) return null;
    return Math.max(...numbers); // Using the spread operator (...)
};

// Exporting the functions as an object
module.exports = {
    square,
    cube,
    average,
    max
};