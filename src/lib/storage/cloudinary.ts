import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import type { StorageSettings } from "@/lib/settings";
import { StorageNotConfiguredError, type StorageAdapter } from "./types";

type Config = StorageSettings["cloudinary"] & { apiSecret: string /* decrypted */ };

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Documents are uploaded as `raw` resources with `type: "private"`, so they are
 * not reachable via public delivery URLs. Downloads use signed, expiring URLs.
 */
export function createCloudinaryAdapter(config: Config): StorageAdapter {
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new StorageNotConfiguredError("cloudinary");
  }
  const auth = { cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret };
  const folder = config.folder.replace(/^\/+|\/+$/g, "");

  return {
    provider: "cloudinary",

    async upload({ key, body }) {
      const publicId = folder ? `${folder}/${key}` : key;
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { ...auth, public_id: publicId, resource_type: "raw", type: "private", overwrite: false },
          (err, res) => (err || !res ? reject(err ?? new Error("Empty Cloudinary response")) : resolve(res)),
        );
        stream.end(body);
      });
      return { storageKey: result.public_id };
    },

    async download(storageKey) {
      const url = cloudinary.utils.private_download_url(storageKey, "", {
        ...auth,
        resource_type: "raw",
        type: "private",
        attachment: true,
        expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
      });
      return { kind: "redirect", url };
    },

    async delete(storageKey) {
      await cloudinary.uploader.destroy(storageKey, { ...auth, resource_type: "raw", type: "private", invalidate: true });
    },

    async testConnection() {
      try {
        await cloudinary.api.ping(auth);
        return { ok: true, message: `Connected to Cloudinary cloud "${config.cloudName}".` };
      } catch (err) {
        return { ok: false, message: describeError(err) };
      }
    },
  };
}

function describeError(err: unknown): string {
  const e = err as { error?: { message?: string; http_code?: number }; message?: string };
  const code = e?.error?.http_code;
  if (code === 401) return "Cloudinary rejected the API key or secret.";
  if (code === 404) return "Cloudinary cloud name not found.";
  return "Could not connect to Cloudinary. Check the cloud name, API key and secret.";
}
