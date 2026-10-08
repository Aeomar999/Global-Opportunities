import './instrument.js';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectToDatabase } from './lib/mongodb.js';
import logger from './lib/logger.js';
import { completePendingDeletions } from './lib/account-deletion.js';

import http from 'http';
import { initSocket } from './socket.js';

const DELETION_RECOVERY_INTERVAL_MS = 60 * 60 * 1000;

/** SEC-065: finish account deletions that stopped part-way. Never rejects. */
const runDeletionRecovery = async () => {
  try {
    const { processed, failed } = await completePendingDeletions();
    if (failed > 0) {
      logger.error({ processed, failed }, 'Some account deletions are still unfinished');
    } else if (processed > 0) {
      logger.info({ processed }, 'Unfinished account deletions completed');
    }
  } catch (error) {
    logger.error({ err: error.message }, 'Account deletion recovery failed');
  }
};

async function startServer() {
  // SEC-021: Database connection is required in all environments.
  // Failure to connect is fatal - the server will not start without a valid DB.
  // This prevents silent failures where requests fail later with confusing errors.
  await connectToDatabase();
  logger.info('Database connected successfully');

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    logger.info({ port: env.port }, 'Kredibble API listening');

    if (!env.isTest) {
      runDeletionRecovery();
      setInterval(runDeletionRecovery, DELETION_RECOVERY_INTERVAL_MS).unref();
    }
  });
}

startServer();
