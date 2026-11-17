import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errors.ts";

export function requireRole(...allowed: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new AppError(401, 'Belum terautentikasi');
    if (!allowed.includes(String(req.user.role)))
      throw new AppError(403, 'Akses ditolak: role tidak mencukupi', undefined, 'FORBIDDEN');
    next();
  };
}