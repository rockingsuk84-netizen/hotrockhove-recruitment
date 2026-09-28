import "server-only";
import { env } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

/**
 * Server-side Turnstile verification. The client-side widget state is never
 * trusted; missing, expired, reused or invalid tokens are all rejected.
 */
export async function verifyTurnstile(token: string | null, remoteIp: string | null, idempotencyKey?: string): Promise<TurnstileResult> {
  if (!token || token.length > 2048) return { ok: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  if (idempotencyKey) body.set("idempotency_key", idempotencyKey);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };
    const data = (await res.json()) as { success: boolean; "error-codes"?: string[]; action?: string };
    if (!data.success) return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
    return { ok: true };
  } catch {
    return { ok: false, reason: "verify-unavailable" };
  }
}
