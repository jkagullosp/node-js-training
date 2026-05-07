function describe(value: string | number | boolean): string {
  if (typeof value === "string") {
    return `Text with ${value.length} characters`;
  } else if (typeof value === "number") {
    const isEven = value % 2 === 0;
    return `Number ${value} (${isEven ? "even" : "odd"})`;
  } else {
    return `Boolean: ${value ? "true" : "false"}`;
  }
}

console.log(describe("Hello TypeScript"));
console.log(describe(42));               
console.log(describe(7));          
console.log(describe(true));
