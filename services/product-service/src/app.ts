import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createLogger, createHttpLogger, type Logger } from '@ecommerce/logger';
import { config } from './config.ts';
import { buildRouter } from './routes.ts';
import { errorHandler, notFoundHandler } from './middleware/errors.ts';

export function createApp({
  logger = createLogger(config.serviceName),
}: { logger?: Logger } = {}): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(createHttpLogger(logger));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use('/', buildRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}