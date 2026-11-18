import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { generateKeyPairSync, createPublicKey, createHash, type JsonWebKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';
import type { AddressInfo } from 'node:net';

// --- Siapkan keypair + JWK + kid (meniru auth-service) ---
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const jwkBase = createPublicKey(publicKey).export({ format: 'jwk' }) as JsonWebKey;
const kid = createHash('sha256')
  .update(JSON.stringify({ e: jwkBase.e, kty: jwkBase.kty, n: jwkBase.n }))
  .digest('base64url');
const jwk = { ...jwkBase, kid, use: 'sig', alg: 'RS256' };

const sign = (role: string): string =>
  jwt.sign({ role }, privateKey, {
    algorithm: 'RS256',
    keyid: kid,
    subject: `user-${role}`,
    issuer: 'auth-service',
    expiresIn: '1h',
  });
const adminToken = sign('admin');
const userToken = sign('user');

// --- Fake JWKS server yang menghitung berapa kali di-fetch ---
let jwksHits = 0;
let fakeServer: Server;
let app: Express;

beforeAll(async () => {
  process.env.LOG_LEVEL = 'silent';
  fakeServer = createServer((req, res) => {
    if (req.url?.startsWith('/.well-known/jwks.json')) {
      jwksHits += 1;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk] }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => fakeServer.listen(0, resolve));
  const { port } = fakeServer.address() as AddressInfo;
  process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${port}`;

  // Import SETELAH env di-set (jwks client dibuat saat import).
  app = (await import('../src/app.ts')).createApp();
});

afterAll(async () => {
  if (fakeServer?.listening) await new Promise<void>((r) => fakeServer.close(() => r()));
});

describe('product-service distributed auth & RBAC', () => {
  it('GET /products publik → 200', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('POST tanpa token → 401', async () => {
    const res = await request(app).post('/products').send({ name: 'X', price: 1000 });
    expect(res.status).toBe(401);
  });

  it('POST dengan token non-admin → 403 (RBAC)', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'X', price: 1000 });
    expect(res.status).toBe(403);
  });

  it('POST admin dengan body invalid → 400 (bukan 500)', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', price: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST admin valid → 201 (panggilan PERTAMA memicu fetch JWKS)', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Topi Inixindo', price: 90000, stock: 10 });
    expect(res.status).toBe(201);
    expect(jwksHits).toBeGreaterThanOrEqual(1);
  });

  it('setelah auth-service MATI, verifikasi token berikutnya TETAP berhasil (cache jwks-rsa)', async () => {
    await new Promise<void>((r) => fakeServer.close(() => r()));
    const hitsBefore = jwksHits;

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tumbler', price: 75000, stock: 5 });

    expect(res.status).toBe(201); // sukses walau auth-service mati
    expect(jwksHits).toBe(hitsBefore); // TIDAK ada fetch baru → murni dari cache
  });
});