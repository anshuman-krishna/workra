import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { logger } from './utils/logger.js';
import { initRealtime, shutdownRealtime } from './realtime/io.js';
import { initErrorTracking } from './utils/error-tracking.js';

async function bootstrap() {
  initErrorTracking();
  await connectDatabase();
  const app = createApp();

  // wrap express in an http.Server so socket.io can share the same port.
  const server = createServer(app);
  initRealtime(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `api listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    await shutdownRealtime();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap failed');
  process.exit(1);
});
