// math.test.js
const { add, divide, isEven } = require('./math');
 
describe('add', () => {
  test('adds two positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
 
  test('adds a positive and a negative number', () => {
    expect(add(5, -3)).toBe(2);
  });
 
  test('adds zero', () => {
    expect(add(5, 0)).toBe(5);
  });
});
 
describe('divide', () => {
  test('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });
 
  test('throws when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });
});
 
describe('isEven', () => {
  test('returns true for even numbers', () => {
    expect(isEven(4)).toBe(true);
  });
 
  test('returns false for odd numbers', () => {
    expect(isEven(5)).toBe(false);
  });
});
