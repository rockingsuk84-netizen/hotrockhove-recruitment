import "server-only";
import type { StorageProviderName } from "@/db/schema";
import { env } from "@/lib/env";
import { getSetting, revealSecret, type StorageSettings } from "@/lib/settings";
import { createCloudinaryAdapter } from "./cloudinary";
import { createLocalAdapter } from "./local";
import { createS3Adapter } from "./s3";
import { StorageNotConfiguredError, type StorageAdapter } from "./types";

export * from "./types";

export function buildAdapter(provider: StorageProviderName, settings: StorageSettings): StorageAdapter {
  switch (provider) {
    case "cloudinary":
      return createCloudinaryAdapter({
        ...settings.cloudinary,
        apiSecret: revealSecret(settings.cloudinary.apiSecret),
      });
    case "s3":
      return createS3Adapter({ ...settings.s3, secretAccessKey: revealSecret(settings.s3.secretAccessKey) });
    case "local":
      if (!env().ALLOW_LOCAL_STORAGE) throw new StorageNotConfiguredError("local");
      return createLocalAdapter();
  }
}

/** Adapter for the provider currently selected in Admin → Configuration → File Storage. */
export async function getActiveStorage(): Promise<StorageAdapter> {
  const settings = await getSetting("storage");
  return buildAdapter(settings.provider, settings);
}

/**
 * Fetch a stored file's bytes on the server. Providers that hand out signed
 * URLs are fetched here rather than redirecting the browser, so staff never
 * receive expiring storage links (which fail when a browser extension or
 * download manager re-requests them) and downloads keep their original name.
 */
export async function readStoredFile(
  provider: StorageProviderName,
  storageKey: string,
  opts: { filename: string; contentType: string },
): Promise<Buffer> {
  const storage = await getStorageFor(provider);
  const result = await storage.download(storageKey, opts);
  if (result.kind === "body") return result.body;
  const res = await fetch(result.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Storage returned HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Adapter for an existing document. Documents stay readable from the provider
 * they were written to, even after the active provider changes.
 */
export async function getStorageFor(provider: StorageProviderName): Promise<StorageAdapter> {
  return buildAdapter(provider, await getSetting("storage"));
}
