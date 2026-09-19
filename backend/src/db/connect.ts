import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDatabase(uri: string = env.mongoUri): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log(`[db] connected to ${uri.replace(/\/\/.*@/, '//***@')}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
