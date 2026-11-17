import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from './middleware/validate.ts';
import { requireAuth } from './middleware/require-auth.ts';
import { requireRole } from './middleware/require-role.ts';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductInput,
} from './products.ts';

const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi').max(200, 'Nama terlalu panjang'),
  price: z.number().positive('Harga harus lebih dari 0').max(1_000_000_000, 'Harga tidak wajar'),
  stock: z
    .number()
    .int()
    .nonnegative('Stok tidak boleh negatif')
    .max(1_000_000, 'Stok tidak wajar')
    .default(0),
});
const productUpdateSchema = productSchema.partial();

export function buildRouter(): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) =>
    res.json({ status: 'ok', service: 'product-service' }),
  );

  // Publik: baca katalog.
  router.get('/products', (_req: Request, res: Response) =>
    res.json({ products: listProducts() }),
  );
  router.get('/products/:id', (req: Request, res: Response) =>
    res.json({ product: getProduct(String(req.params.id)) }),
  );

  // Admin-only: kelola katalog (RBAC + validasi).
  router.post(
    '/products',
    requireAuth,
    requireRole('admin'),
    validate(productSchema),
    (req: Request, res: Response) => {
      res.status(201).json({ product: createProduct(req.validated as ProductInput) });
    },
  );

  router.put(
    '/products/:id',
    requireAuth,
    requireRole('admin'),
    validate(productUpdateSchema),
    (req: Request, res: Response) => {
      res.json({ product: updateProduct(String(req.params.id), req.validated as Partial<ProductInput>) });
    },
  );

  router.delete(
    '/products/:id',
    requireAuth,
    requireRole('admin'),
    (req: Request, res: Response) => {
      deleteProduct(String(req.params.id));
      res.status(204).end();
    },
  );

  return router;
}