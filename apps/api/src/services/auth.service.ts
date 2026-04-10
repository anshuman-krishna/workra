import { User, type UserDoc } from '../models/user.model.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { badRequest, conflict, unauthorized } from '../utils/errors.js';
import { toPublicUser } from '../utils/serialize.js';
import type { SignupInput, LoginInput } from '@workra/shared';

interface AuthResult {
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function issueTokens(user: UserDoc): Promise<AuthResult> {
  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role as 'user' | 'admin',
  });
  const { token: refreshToken, jti, expiresAt } = signRefreshToken(String(user._id));

  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { jti, expiresAt } } },
  );

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    refreshExpiresAt: expiresAt,
  };
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw conflict('an account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
  });

  return issueTokens(user);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user) {
    throw unauthorized('invalid email or password');
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw unauthorized('invalid email or password');
  }

  return issueTokens(user);
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized('invalid refresh token');
  }

  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user) {
    throw unauthorized('invalid refresh token');
  }

  const tokens = (user as unknown as { refreshTokens: { jti: string; expiresAt: Date }[] })
    .refreshTokens;
  const stored = tokens.find((t) => t.jti === payload.jti);

  if (!stored) {
    // reuse of revoked/unknown jti — nuke all sessions (potential theft)
    await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } });
    throw unauthorized('refresh token revoked');
  }

  if (stored.expiresAt.getTime() < Date.now()) {
    await User.updateOne(
      { _id: user._id },
      { $pull: { refreshTokens: { jti: payload.jti } } },
    );
    throw unauthorized('refresh token expired');
  }

  // rotate
  await User.updateOne(
    { _id: user._id },
    { $pull: { refreshTokens: { jti: payload.jti } } },
  );

  return issueTokens(user);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await User.updateOne(
      { _id: payload.sub },
      { $pull: { refreshTokens: { jti: payload.jti } } },
    );
  } catch {
    // nothing to revoke
  }
}

export function assertNonEmpty(value: string | undefined, field: string): string {
  if (!value) throw badRequest(`${field} is required`);
  return value;
}
