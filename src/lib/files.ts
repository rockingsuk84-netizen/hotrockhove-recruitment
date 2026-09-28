import "server-only";
import type { CvFileType } from "./settings";

export const CV_MIME: Record<CvFileType, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const CV_ACCEPT_ATTR: Record<CvFileType, string> = {
  pdf: ".pdf,application/pdf",
  doc: ".doc,application/msword",
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(buf: Uint8Array, bytes: number[]) {
  return bytes.every((b, i) => buf[i] === b);
}

function includesAscii(buf: Buffer, needle: string) {
  return buf.indexOf(needle, 0, "latin1") !== -1;
}

/** Identify a CV from its content. The filename and browser MIME type are never trusted. */
export function sniffCvType(buf: Buffer): CvFileType | null {
  if (buf.length < 8) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (startsWith(buf, OLE_MAGIC)) return "doc";
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // A .docx is a ZIP containing word/document.xml. Reject macro-enabled documents.
    if (!includesAscii(buf, "word/document.xml") || !includesAscii(buf, "[Content_Types].xml")) return null;
    if (includesAscii(buf, "vbaProject.bin")) return null;
    return "docx";
  }
  return null;
}

export type FileCheck =
  | { ok: true; type: CvFileType; mimeType: string; extension: CvFileType }
  | { ok: false; error: string };

export function validateCv(
  file: { name: string; size: number },
  buf: Buffer,
  rules: { maxBytes: number; allowed: CvFileType[] },
): FileCheck {
  const allowedList = rules.allowed.map((t) => t.toUpperCase()).join(", ");
  if (file.size === 0 || buf.length === 0) return { ok: false, error: "The uploaded file is empty." };
  if (file.size > rules.maxBytes || buf.length > rules.maxBytes) {
    return { ok: false, error: `Your CV must be ${formatBytes(rules.maxBytes)} or smaller.` };
  }
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];
  const detected = sniffCvType(buf);
  if (!detected || !rules.allowed.includes(detected) || ext !== detected) {
    return { ok: false, error: `Please upload your CV as one of: ${allowedList}.` };
  }
  return { ok: true, type: detected, mimeType: CV_MIME[detected], extension: detected };
}

/** Keep a display-safe version of the original filename for admins; never used for storage keys. */
export function safeDisplayFilename(name: string, ext: string): string {
  const base = name
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim()
    .slice(0, 80);
  return `${base || "cv"}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) ? 1 : 0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** RFC 6266 attachment header with an ASCII fallback. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
