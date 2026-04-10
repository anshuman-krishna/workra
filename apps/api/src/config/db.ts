import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('mongo connected');
  } catch (err) {
    console.error('mongo connection failed', err);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('mongo disconnected');
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
