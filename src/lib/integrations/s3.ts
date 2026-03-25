/**
 * AWS S3 Client — file storage for production.
 *
 * Provides upload, signed download URLs, and delete operations.
 * All keys follow multi-tenant convention: {org_id}/{entity}/{entity_id}/{filename}
 *
 * Environment variables:
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── CONFIG ──────────────────────────────────

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';

/** Whether S3 is fully configured (all required vars present) */
export const isS3Configured = !!(AWS_ACCESS_KEY && AWS_SECRET_KEY && BUCKET_NAME);

// Lazy-init: only create client when actually used
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    if (!isS3Configured) {
      throw new Error('[S3] Missing required env vars. Need: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME');
    }
    _client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
      },
    });
  }
  return _client;
}

export { BUCKET_NAME as S3_BUCKET };

// ─── UPLOAD ──────────────────────────────────

export async function uploadToS3(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ url: string; key: string }> {
  const client = getClient();

  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    Metadata: params.metadata,
  }));

  return {
    key: params.key,
    url: `s3://${BUCKET_NAME}/${params.key}`,
  };
}

// ─── SIGNED DOWNLOAD URL ─────────────────────

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// ─── DELETE ──────────────────────────────────

export async function deleteFromS3(key: string): Promise<void> {
  const client = getClient();

  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));
}

// ─── HEALTH CHECK ────────────────────────────

export async function checkS3Health(): Promise<{ status: 'ok' | 'error'; region: string; bucket: string; message?: string }> {
  try {
    const client = getClient();
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return {
      status: 'ok',
      region: AWS_REGION,
      bucket: `${BUCKET_NAME.substring(0, 3)}***${BUCKET_NAME.substring(BUCKET_NAME.length - 3)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown S3 error';
    return {
      status: 'error',
      region: AWS_REGION,
      bucket: '***',
      message,
    };
  }
}

// ─── PRESIGNED URL UTILITIES ─────────────────

/**
 * Extract a clean S3 key from any storage reference format:
 * - "s3://empleo-nivelics/uuid/documentos/uuid/file.pdf" → "uuid/documentos/uuid/file.pdf"
 * - "uuid/documentos/uuid/file.pdf" → "uuid/documentos/uuid/file.pdf"
 * - "https://s3.amazonaws.com/bucket/..." → extracts the path
 */
export function extractS3Key(rawRef: string): string {
  if (rawRef.startsWith('s3://')) {
    return rawRef.replace(`s3://${BUCKET_NAME}/`, '').replace(/^s3:\/\/[^/]+\//, '');
  }
  if (rawRef.startsWith('https://')) {
    const url = new URL(rawRef);
    return url.pathname.replace(/^\//, '');
  }
  return rawRef;
}

/**
 * Generate a presigned URL for direct upload from the browser.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 900
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Check if an object exists in S3 without downloading it.
 */
export async function objectExists(keyOrRef: string): Promise<boolean> {
  try {
    const client = getClient();
    const key = extractS3Key(keyOrRef);
    await client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a stored URL reference to an accessible URL.
 * - s3:// references → presigned download URL
 * - local paths or http URLs → returned as-is
 */
export async function resolveUrl(urlOrRef: string, expiresInSeconds: number = 3600): Promise<string> {
  if (!urlOrRef) return urlOrRef;
  if (urlOrRef.startsWith('s3://')) {
    const key = extractS3Key(urlOrRef);
    return getSignedDownloadUrl(key, expiresInSeconds);
  }
  return urlOrRef;
}

// ─── KEY BUILDER ─────────────────────────────

/**
 * Build a multi-tenant S3 key following convention:
 *   {orgId}/{entity}/{entityId}/{filename}
 */
export function buildS3Key(
  orgId: string,
  entity: string,
  entityId: string,
  filename: string
): string {
  // Sanitize filename: remove path separators, keep extension
  const safe = filename.replace(/[/\\]/g, '_').replace(/\s+/g, '_');
  return `${orgId}/${entity}/${entityId}/${safe}`;
}
