// Destructuring

const product = { name: 'Laptop', price: '1200', brand: 'Dell', inStock: true };

const { name, price } = product;

console.log(`Product: ${name}`);
console.log(`Price: ${price}`);

const colors = ['red', 'green', 'blue'];

const [primary, secondary] = colors;

console.log(`Primary color: ${primary}`);
console.log(`Secondary Color: ${secondary}`);