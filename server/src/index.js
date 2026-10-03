import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { getProvider } from './services/ai/index.js';
import { buildApp } from './app.js';

const start = async () => {
  await connectDB();
  getProvider(); // log the active AI provider once
  buildApp().listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] ConstructTrace API listening on http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(`[server] Allowed CORS origin: ${env.clientOrigin}`);
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
