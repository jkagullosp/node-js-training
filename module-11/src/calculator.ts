// calculator.ts

type Operation = "add" | "subtract" | "multiply" | "divide";

function add(a: number, b: number): number {
  return a + b;
}

function subtract(a: number, b: number): number {
  return a - b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function divide(a: number, b: number): number | string {
  if (b === 0) {
    return " Error: Division by zero is not allowed.";
  }

  return a / b;
}

function calculate(op: Operation, a: number, b: number): number | string {
  switch (op) {
    case "add":
      return add(a, b);
    case "subtract":
      return subtract(a, b);
    case "multiply":
      return multiply(a, b);
    case "divide":
      return divide(a, b);
    default:
      return "Invalid operation";
  }
}

console.log(`Add => ${calculate('add', 10, 5)}`);
console.log(`Subtract => ${calculate('subtract', 10, 5)}`);
console.log(`Multiply => ${calculate('multiply', 10, 5)}`);
console.log(`Divide => ${calculate('divide', 10, 5)}`);
console.log(`Divide by Zero => ${calculate('divide', 10, 0)}`);
