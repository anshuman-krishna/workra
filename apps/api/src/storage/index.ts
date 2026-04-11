import { env } from '../config/env.js';
import type { StorageAdapter } from './types.js';
import { LocalStorageAdapter } from './local.adapter.js';
import { S3StorageAdapter } from './s3.adapter.js';

// single shared adapter instance, picked at boot.
// switching drivers means restarting the api.
function makeAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === 's3') {
    return new S3StorageAdapter({
      bucket: env.STORAGE_BUCKET as string,
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      accessKeyId: env.STORAGE_ACCESS_KEY as string,
      secretAccessKey: env.STORAGE_SECRET_KEY as string,
      signedUrlTtl: env.STORAGE_SIGNED_URL_TTL,
    });
  }
  return new LocalStorageAdapter({
    rootDir: env.STORAGE_LOCAL_DIR,
    publicBaseUrl: env.STORAGE_PUBLIC_URL ?? null,
    signedUrlTtl: env.STORAGE_SIGNED_URL_TTL,
  });
}

export const storage: StorageAdapter = makeAdapter();
export type { StorageAdapter, PutInput, SignedUrl } from './types.js';
