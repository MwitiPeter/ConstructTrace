import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    // eslint-disable-next-line no-console
    console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] Could not connect to MongoDB.');
    // eslint-disable-next-line no-console
    console.error(`[db] URI: ${env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
    // eslint-disable-next-line no-console
    console.error(`[db] Reason: ${err.message}`);
    // eslint-disable-next-line no-console
    console.error('[db] Start local MongoDB or set MONGODB_URI in server/.env (see README).');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] Connection error:', err.message);
  });
}
