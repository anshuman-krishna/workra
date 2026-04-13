import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { PutInput, SignedUrl, StorageAdapter } from './types.js';

interface LocalStorageOptions {
  rootDir: string;
  publicBaseUrl: string | null;
  signedUrlTtl: number;
}

// dev-friendly disk store. signed urls are HMAC-stamped paths under /files/local/:key
// validated by the file controller before streaming the bytes back.
export class LocalStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;
  private readonly signedUrlTtl: number;

  constructor(opts: LocalStorageOptions) {
    this.rootDir = path.resolve(opts.rootDir);
    // when no explicit public url is set, mount under the api origin so dev just works.
    // the file controller serves /files/local/* directly.
    this.publicBaseUrl = opts.publicBaseUrl ?? `${env.WEB_ORIGIN.replace(/:\d+$/, '')}:${env.PORT}`;
    this.signedUrlTtl = opts.signedUrlTtl;
  }

  private absolutePath(key: string): string {
    // guard against traversal: key is always service-generated, but never trust it.
    const safe = path.posix.normalize(key).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(this.rootDir, safe);
    if (!full.startsWith(this.rootDir)) {
      throw new Error('invalid storage key');
    }
    return full;
  }

  async put(input: PutInput): Promise<void> {
    const full = this.absolutePath(input.key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, input.body);
  }

  async delete(key: string): Promise<void> {
    const full = this.absolutePath(key);
    await fs.rm(full, { force: true });
  }

  async getSignedUrl(key: string, filename: string): Promise<SignedUrl> {
    const expires = Math.floor(Date.now() / 1000) + this.signedUrlTtl;
    const sig = signLocalKey(key, expires);
    const params = new URLSearchParams({ exp: String(expires), sig, name: filename });
    return {
      url: `${this.publicBaseUrl}/api/v1/files/local/${encodeURIComponent(key)}?${params.toString()}`,
      expiresAt: new Date(expires * 1000),
    };
  }
}

// shared with the controller that serves the bytes
export function signLocalKey(key: string, expires: number): string {
  const secret = env.ACCESS_TOKEN_SECRET;
  return crypto.createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex');
}

export function verifyLocalKey(key: string, expires: number, sig: string): boolean {
  if (Number.isNaN(expires) || expires * 1000 < Date.now()) return false;
  const expected = signLocalKey(key, expires);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function resolveLocalPath(key: string): string {
  const root = path.resolve(env.STORAGE_LOCAL_DIR);
  const safe = path.posix.normalize(key).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(root, safe);
  if (!full.startsWith(root)) throw new Error('invalid storage key');
  return full;
}
