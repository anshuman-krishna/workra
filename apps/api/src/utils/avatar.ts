import { randomBytes } from 'node:crypto';

export function generateAvatarSeed(): string {
  return randomBytes(8).toString('hex');
}
