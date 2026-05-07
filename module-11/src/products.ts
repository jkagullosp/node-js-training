interface Products {
  id: number;
  name: string;
  price: number;
  category: "electronics" | "clothing" | "food";
  inStock: boolean;
  description?: string;
}

const inventory: Products[] = [
  {
    id: 1,
    name: "Laptop",
    price: 350,
    category: "electronics",
    inStock: true,
    description: "Brand new Macbook M5 Pro",
  },
  {
    id: 2,
    name: "T-Shirt",
    price: 25,
    category: "clothing",
    inStock: true,
    description: "Size L modern design",
  },
  {
    id: 3,
    name: "Apple",
    price: 5,
    category: "food",
    inStock: false,
    description: "Imported from japan",
  },
  {
    id: 4,
    name: "Smartphone",
    price: 75,
    category: "electronics",
    inStock: true,
    description: "Brand new iPhone 17 Pro Max",
  },
  {
    id: 5,
    name: "Cereal",
    price: 3,
    category: "food",
    inStock: true,
    description: "Best for breakfast",
  },
];

function getByCategory(products: Products[], cat: string): Products[] {
  return products.filter((product) => product.category === cat);
}

function getAvailableProducts(products: Products[]): Products[] {
  return products.filter((product) => product.inStock === true);
}

function getTotalValue(products: Products[]): number {
  return products
    .filter((product) => product.inStock)
    .reduce((sum, product) => sum + product.price, 0);
}
