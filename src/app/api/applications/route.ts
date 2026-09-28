import { after, NextResponse } from "next/server";
import { audit, clientIp } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendApplicationEmails, submitApplication } from "@/services/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Headroom for text fields and multipart framing on top of the CV limit. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

// Generic message: never reveal which anti-abuse check failed.
const BLOCKED = "We couldn't verify your submission. Please refresh the page and try again.";

function json(status: number, body: Record<string, unknown>, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Only POST is exported, so other methods receive 405 from the framework. */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return json(415, { ok: false, error: "Unsupported request." });
  }

  const uploads = await getSetting("uploads");
  const maxBody = uploads.maxCvBytes + FORM_OVERHEAD_BYTES;
  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declared) || declared > maxBody) {
    await audit("security.oversized_request", { metadata: { declared: Number.isFinite(declared) ? declared : null } });
    return json(413, { ok: false, error: "Your submission is too large. Please upload a smaller CV." });
  }

  const ip = await clientIp();
  const ipLimit = await rateLimit(RATE_LIMITS.applicationPerIp, ip ?? "unknown");
  if (!ipLimit.allowed) {
    await audit("security.rate_limited", { metadata: { rule: RATE_LIMITS.applicationPerIp.name } });
    return json(429, { ok: false, error: "Too many submissions. Please try again later." }, { "Retry-After": String(ipLimit.retryAfterSeconds) });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: "Your submission could not be read. Please try again." });
  }

  // Honeypot: hidden from people, often filled by bots. Pretend success, store nothing.
  const honeypot = form.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    await audit("security.honeypot");
    return json(200, { ok: true, redirect: "/jobs" });
  }

  const token = form.get("cf-turnstile-response");
  const submissionToken = form.get("submissionToken");
  const turnstile = await verifyTurnstile(
    typeof token === "string" ? token : null,
    ip,
    typeof submissionToken === "string" ? submissionToken : undefined,
  );
  if (!turnstile.ok) {
    await audit("security.turnstile_failed", { metadata: { reason: turnstile.reason } });
    return json(403, { ok: false, error: BLOCKED, code: "verification" });
  }

  try {
    const result = await submitApplication(form);
    if (!result.ok) {
      return json(result.status, { ok: false, error: result.error, fields: result.fields ?? {}, code: result.status === 422 ? "invalid" : "blocked" });
    }
    if (!result.duplicate) {
      const id = result.applicationId;
      after(() => sendApplicationEmails(id).catch((e) => console.error("[apply] email dispatch failed:", (e as Error).message)));
    }
    return json(200, { ok: true, redirect: `/jobs/${result.jobSlug}/applied` });
  } catch (err) {
    console.error("[apply] submission failed:", (err as Error).message);
    return json(500, { ok: false, error: "Something went wrong on our side. Please try again in a few minutes." });
  }
}
