import type { Request } from 'express';
import type { User, CreateUserBody } from './users';

// 1. A Promise that will resolve to a User object (async operation that eventually gives you a User)
type _1 = Promise<User>;

// 2. An array where every element must be a string
type _2 = Array<string>;

// 3. A key-value store where keys are strings and values are numbers
type _3 = Map<string, number>;

// 4. An Express Request where:
//    - route params have shape { id: string }  (e.g. /users/:id)
//    - response body is untyped {}
//    - request body has shape CreateUserBody
type _4 = Request<{ id: string }, {}, CreateUserBody>;

// 5. A function that accepts an array of any type T and returns either the first element of that type or undefined
type _5 = <T>(items: T[]) => T | undefined;

// Generic function — T is inferred from whatever array you pass in
function firstItem<T>(items: T[]): T | undefined {
  return items[0];
}

const _firstNumber = firstItem([10, 20, 30]);   // T inferred as number → number | undefined
const _firstString = firstItem(['a', 'b', 'c']); // T inferred as string → string | undefined
