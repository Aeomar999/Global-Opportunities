import { app } from './app.js';
import { env } from './config/env.js';
import { connectToDatabase } from './lib/mongodb.js';

import http from 'http';
import { initSocket } from './socket.js';

async function startServer() {
  // SEC-021: Database connection is required in all environments.
  // Failure to connect is fatal - the server will not start without a valid DB.
  // This prevents silent failures where requests fail later with confusing errors.
  await connectToDatabase();
  console.log('✅ Database connected successfully.');

  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`🚀 Kredibble API listening on http://localhost:${env.port}/api`);
  });
}

startServer();
