import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PutInput, SignedUrl, StorageAdapter } from './types.js';

interface S3StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  signedUrlTtl: number;
}

// works against aws s3, cloudflare r2, and minio. r2 needs a custom endpoint and forcePathStyle.
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signedUrlTtl: number;

  constructor(opts: S3StorageOptions) {
    this.bucket = opts.bucket;
    this.signedUrlTtl = opts.signedUrlTtl;
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: Boolean(opts.endpoint),
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
    });
  }

  async put(input: PutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, filename: string): Promise<SignedUrl> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      // suggest the original filename to the browser when the link is opened directly
      ResponseContentDisposition: `attachment; filename="${sanitizeFilename(filename)}"`,
    });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: this.signedUrlTtl });
    return {
      url,
      expiresAt: new Date(Date.now() + this.signedUrlTtl * 1000),
    };
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/["\\\r\n]/g, '_');
}
