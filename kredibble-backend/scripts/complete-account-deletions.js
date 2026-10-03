// SEC-065: finish account deletions that stopped part-way. A tombstone stays
// `pending`, or has `mediaDeleted: false`, when a step failed. Every step is
// idempotent, so running the purge again completes it.
//
// Usage: npm run accounts:complete-deletions
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/mongodb.js';
import { User, UserTombstone } from '../src/models/User.js';
import { purgeUserData } from '../src/lib/account-deletion.js';
import logger from '../src/lib/logger.js';

// Leave deletions that may still be running alone.
const MIN_AGE_MS = 10 * 60 * 1000;

const run = async () => {
  await connectToDatabase();
  const tombstones = await UserTombstone.find({
    $or: [{ status: 'pending' }, { mediaDeleted: false }],
    deletedAt: { $lt: new Date(Date.now() - MIN_AGE_MS) },
  });

  for (const tombstone of tombstones) {
    const user = await User.findById(tombstone.userId);
    if (!user) continue;
    const { mediaDeleted } = await purgeUserData(user);
    tombstone.set({ status: 'completed', completedAt: new Date(), mediaDeleted });
    await tombstone.save();
    logger.info({ userId: String(user._id), mediaDeleted }, 'Account deletion completed');
  }
  return tombstones.length;
};

run()
  .then((count) => {
    logger.info({ count }, 'Unfinished account deletions processed');
    return mongoose.disconnect();
  })
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error.message }, 'Completing account deletions failed');
    process.exit(1);
  });
