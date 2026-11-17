import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { config } from '../config.ts';
import { AppError } from './errors.ts';

const client = new JwksClient({
  jwksUri: `${config.authServiceUrl}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 menit
  timeout: 3000,
});

function getSigningKey(kid: string): Promise<string> {
  return client.getSigningKey(kid).then((key) => key.getPublicKey());
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Token tidak ada atau format salah');
  }

  const decodedHeader = jwt.decode(token, { complete: true })?.header;
  if (!decodedHeader?.kid) {
    throw new AppError(401, 'Token tidak punya kid');
  }

  let publicKey: string;
  try {
    publicKey = await getSigningKey(decodedHeader.kid);
  } catch {
    // Gagal ambil key (mis. kid tak dikenal / auth-service tak terjangkau di
    // panggilan PERTAMA sebelum cache terisi).
    throw new AppError(401, 'Tidak bisa memverifikasi token (signing key)');
  }

  try {
    req.user = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: config.jwtIssuer,
    }) as JwtPayload;
  } catch {
    throw new AppError(401, 'Token tidak valid');
  }
  next();
}