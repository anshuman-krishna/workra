export interface PutInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

// minimal surface so callers don't need to know which backend is in use.
// keys are opaque storage paths owned by the file service.
export interface StorageAdapter {
  put(input: PutInput): Promise<void>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, filename: string): Promise<SignedUrl>;
}
