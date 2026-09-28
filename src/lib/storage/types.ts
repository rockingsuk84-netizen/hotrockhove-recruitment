import type { StorageProviderName } from "@/db/schema";

export type UploadInput = {
  /** Server-generated key; never derived from user-supplied filenames. */
  key: string;
  body: Buffer;
  contentType: string;
};

export type DownloadResult =
  | { kind: "redirect"; url: string }
  | { kind: "body"; body: Buffer; contentType: string };

export type ConnectionTestResult = { ok: boolean; message: string };

/**
 * Business logic talks to this interface only. Private applicant documents are
 * always accessed through an authorised app route which asks the adapter for a
 * short-lived URL or the bytes — storage URLs are never used as access control.
 */
export interface StorageAdapter {
  readonly provider: StorageProviderName;
  upload(input: UploadInput): Promise<{ storageKey: string }>;
  download(storageKey: string, opts: { filename: string; contentType: string }): Promise<DownloadResult>;
  delete(storageKey: string): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
}

export class StorageNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Storage provider "${provider}" is not fully configured`);
  }
}
