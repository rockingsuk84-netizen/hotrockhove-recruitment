import "server-only";
import QRCode from "qrcode";
import { env } from "./env";

/** Normalised QR source label, e.g. "poster", "event", "instagram". Empty string = no source. */
export function normaliseSource(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Canonical public job URL. QR codes always point to the app's own domain. */
export function jobPublicUrl(slug: string, source?: string): string {
  const url = new URL(`/jobs/${encodeURIComponent(slug)}`, env().APP_URL);
  const s = normaliseSource(source);
  if (s) url.searchParams.set("source", s);
  return url.toString();
}

const OPTIONS = { errorCorrectionLevel: "M" as const, margin: 2 };

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPTIONS, type: "svg" });
}

export function qrPng(url: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...OPTIONS, type: "png", width: size });
}

export function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { ...OPTIONS, width: 320 });
}
