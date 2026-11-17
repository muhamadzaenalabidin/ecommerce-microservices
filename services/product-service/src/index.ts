import { createLogger } from '@ecommerce/logger';
import { config } from './config.ts';
import { createApp } from './app.ts';

const logger = createLogger(config.serviceName);
const app = createApp({ logger });
const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, authServiceUrl: config.authServiceUrl },
    '${config.serviceName} listening',
  );
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => process.exit(0));
  });
}