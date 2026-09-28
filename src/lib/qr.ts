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

/** Absolute URL on the site's own domain (APP_URL). */
export function siteUrl(path: string): string {
  return new URL(path, env().APP_URL).toString();
}

/** The short link printed in a QR code: /q/{code} redirects to the code's current target. */
export function qrShortUrl(code: string): string {
  return siteUrl(`/q/${encodeURIComponent(code)}`);
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
