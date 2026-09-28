import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentDisposition } from "@/lib/files";
import type { StorageSettings } from "@/lib/settings";
import { StorageNotConfiguredError, type StorageAdapter } from "./types";

type Config = StorageSettings["s3"] & { secretAccessKey: string /* decrypted */ };

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Objects are written privately with server-side encryption and downloaded via
 * short-lived presigned URLs. `cdnUrl` is kept for future public assets (logos,
 * profile photos); private applicant documents never go through the CDN.
 */
export function createS3Adapter(config: Config): StorageAdapter {
  if (!config.bucket || !config.region || !config.accessKeyId || !config.secretAccessKey) {
    throw new StorageNotConfiguredError("s3");
  }
  const client = new S3Client({
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const prefix = config.prefix.replace(/^\/+|\/+$/g, "");

  return {
    provider: "s3",

    async upload({ key, body, contentType }) {
      const storageKey = prefix ? `${prefix}/${key}` : key;
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: storageKey,
          Body: body,
          ContentType: contentType,
          ServerSideEncryption: "AES256",
          IfNoneMatch: "*",
        }),
      );
      return { storageKey };
    },

    async download(storageKey, { filename, contentType }) {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: storageKey,
          ResponseContentType: contentType,
          ResponseContentDisposition: contentDisposition(filename),
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      );
      return { kind: "redirect", url };
    },

    async delete(storageKey) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    },

    async testConnection() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
        return { ok: true, message: `Connected to S3 bucket "${config.bucket}" (${config.region}).` };
      } catch (err) {
        const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 403) return { ok: false, message: "Access denied. Check the access key permissions for this bucket." };
        if (status === 404) return { ok: false, message: "Bucket not found in this region." };
        return { ok: false, message: "Could not connect to S3. Check the bucket, region and credentials." };
      }
    },
  };
}
