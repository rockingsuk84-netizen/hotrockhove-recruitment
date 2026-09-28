import "server-only";
import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter } from "./types";

const ROOT = path.resolve(process.cwd(), ".data", "uploads");

/** Local-disk adapter for development only (guarded by ALLOW_LOCAL_STORAGE). */
export function createLocalAdapter(): StorageAdapter {
  function resolve(key: string) {
    const full = path.resolve(ROOT, key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  return {
    provider: "local",
    async upload({ key, body }) {
      const full = resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body, { flag: "wx" });
      return { storageKey: key };
    },
    async download(storageKey, { contentType }) {
      return { kind: "body", body: await readFile(resolve(storageKey)), contentType };
    },
    async delete(storageKey) {
      await rm(resolve(storageKey), { force: true });
    },
    async testConnection() {
      await mkdir(ROOT, { recursive: true });
      await access(ROOT);
      return { ok: true, message: "Local development storage is writable (not for production)." };
    },
  };
}
