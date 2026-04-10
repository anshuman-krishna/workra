import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('mongo connected');
  } catch (err) {
    logger.fatal({ err }, 'mongo connection failed');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('mongo disconnected');
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
