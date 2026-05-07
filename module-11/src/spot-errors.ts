// Error 1: Primitive type mismatch

// const count: number = '42;

/* 
Error:
- Type 'string' is not assignable to type 'number'.
Explanation:
- Typescript assumes that the variable count is assigned as number,
but we wrapped the number in quotes producing error.
*/

// Correct version:
const count: number = 42;

// ---------------------------------------------------------------

//Error 2: Missing required fiels in an object

interface User {
    id: number;
    name: string;
}

// const currentUser: User = { name: 'Kyle'};

/*
Error: 
- Property 'id' is missing in type '{ name: string; }' but 
required in type 'User'.
Explanation: 
- The object's shape is incomplete, missing the 'id' throwing errors.
*/

// Correct version
const currentUser: User = { id: 1, name: 'Kyle'};

// ---------------------------------------------------------------

// Error 3: Invalid Function Argument

function calculateDiscount(price: number) {
    return price * 0.9;
}

// calculateDiscount("$100");

/*
Error:
- Argument of type 'string' is not assignable to parameter of type 'number'.
Explanation:
- Function only accepts number and not strings, the parameter inside the
function is set as string causing errors.
*/

// Correct version
calculateDiscount(100);

// ---------------------------------------------------------------

// Error 4: Accessing non-existent properties
const zipCode: number = 90210;
// const ziplength = zipCode.length;

/*
Error:
- Property 'length' does not exist on type 'number'.
Explanation:
- Mathematical numbers doesn't have 'length' property built-in causing errors.
*/

// Correct version
const zipLength = zipCode.toString().length;

// ---------------------------------------------------------------

// Error 5: Array type mismatch
// const scores: number[] = [90, 85, "100", 95];

/*
Error:
- Type 'string' is not assignable to type 'number'.
Explanation:
- We defined the scores array as number only which doesn't accept strings
in this case, we have a string at the 2nd index. Causing errors.
*/

// Correct version
const scores: number[] = [90, 85, 100, 95];