// SEC-065: finish account deletions that stopped part-way. The server also runs
// this hourly; the script is for running it by hand. See completePendingDeletions.
//
// Usage: npm run accounts:complete-deletions
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/mongodb.js';
import { completePendingDeletions } from '../src/lib/account-deletion.js';
import logger from '../src/lib/logger.js';

const run = async () => {
  await connectToDatabase();
  return completePendingDeletions();
};

run()
  .then(async ({ processed, failed }) => {
    logger.info({ processed, failed }, 'Unfinished account deletions processed');
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    logger.error({ err: error.message }, 'Completing account deletions failed');
    process.exit(1);
  });
