import { randomUUID } from 'node:crypto';
import { AppError } from './middleware/errors.ts';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export type ProductInput = Omit<Product, 'id'>;

/** Product store IN-MEMORY (simplifikasi training — lihat PRODUCTION-CHECKLIST). */
const products = new Map<string, Product>();

function seed(): void {
  if (products.size > 0) return;
  const initial: ProductInput[] = [
    { name: 'Kaos Inixindo', price: 120000, stock: 50 },
    { name: 'Mug Microservice', price: 65000, stock: 100 },
    { name: 'Sticker Pack DevOps', price: 25000, stock: 200 },
  ];
  for (const p of initial) {
    const id = randomUUID();
    products.set(id, { id, ...p });
  }
}
seed();

export function listProducts(): Product[] {
  return [...products.values()];
}

export function getProduct(id: string): Product {
  const product = products.get(id);
  if (!product) throw new AppError(404, 'Produk tidak ditemukan', undefined, 'NOT_FOUND');
  return product;
}

export function createProduct(data: ProductInput): Product {
  const id = randomUUID();
  const product: Product = { id, ...data };
  products.set(id, product);
  return product;
}

export function updateProduct(id: string, data: Partial<ProductInput>): Product {
  const product = getProduct(id);
  const updated: Product = { ...product, ...data };
  products.set(id, updated);
  return updated;
}

export function deleteProduct(id: string): void {
  getProduct(id); // lempar 404 kalau tak ada
  products.delete(id);
}

/** Hanya untuk test. */
export function _reset(): void {
  products.clear();
  seed();
}