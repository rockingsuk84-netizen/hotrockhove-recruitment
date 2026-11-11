import { after, NextResponse } from "next/server";
import { audit, clientIp } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { sendFormResponseCopy, submitFormResponse } from "@/services/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Headroom for the answers and multipart framing on top of the CV limit. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

function json(status: number, body: Record<string, unknown>, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * Completed applicant form. The private link token in the URL is the
 * applicant's authorisation; only POST is exported, so other methods get 405.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/forms/[token]">) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) return json(415, { ok: false, error: "Unsupported request." });

  const uploads = await getSetting("uploads");
  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declared) || declared > uploads.maxCvBytes + FORM_OVERHEAD_BYTES) {
    await audit("security.oversized_request", { metadata: { declared: Number.isFinite(declared) ? declared : null, route: "forms" } });
    return json(413, { ok: false, error: "Your submission is too large. Please upload a smaller CV." });
  }

  const ip = await clientIp();
  const limit = await rateLimit(RATE_LIMITS.formSubmitPerIp, ip ?? "unknown");
  if (!limit.allowed) {
    await audit("security.rate_limited", { metadata: { rule: RATE_LIMITS.formSubmitPerIp.name } });
    return json(429, { ok: false, error: "Too many submissions. Please try again later." }, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: "Your submission could not be read. Please try again." });
  }

  const { token } = await ctx.params;
  try {
    const result = await submitFormResponse(token, form);
    if (!result.ok) return json(result.status, { ok: false, error: result.error, fields: result.fields ?? {} });
    const id = result.requestId;
    after(() => sendFormResponseCopy(id).catch((e) => console.error("[forms] copy email failed:", (e as Error).message)));
    return json(200, { ok: true });
  } catch (err) {
    console.error("[forms] submission failed:", (err as Error).message);
    return json(500, { ok: false, error: "Something went wrong on our side. Please try again in a few minutes." });
  }
}
