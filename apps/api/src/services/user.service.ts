import { User } from '../models/user.model.js';
import { notFound } from '../utils/errors.js';
import { toPublicUser } from '../utils/serialize.js';

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw notFound('user not found');
  return toPublicUser(user);
}
