import "server-only";
import { headers } from "next/headers";
import { db, t } from "@/db";
import { hashIdentifier } from "./crypto";

export type AuditAction =
  | "auth.sign_in"
  | "auth.sign_in_failed"
  | "job.create"
  | "job.update"
  | "job.publish"
  | "job.unpublish"
  | "job.close"
  | "job.qr_create"
  | "job.qr_delete"
  | "application.submitted"
  | "application.status_change"
  | "application.note_add"
  | "document.download"
  | "applicant.erase"
  | "settings.update"
  | "storage.test"
  | "taxonomy.update"
  | "user.create"
  | "user.update"
  | "retention.purge"
  | "security.turnstile_failed"
  | "security.rate_limited"
  | "security.honeypot"
  | "security.invalid_upload"
  | "security.oversized_request";

/** Client IP as reported by Cloudflare / Vercel. Used only transiently or hashed. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/**
 * Record an administrative or security event. Metadata must not contain
 * passwords, secrets, CV contents or unnecessary applicant personal data.
 */
export async function audit(
  action: AuditAction,
  opts: { actorUserId?: string | null; entityType?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
) {
  try {
    const ip = await clientIp().catch(() => null);
    await db.insert(t.auditLogs).values({
      action,
      actorUserId: opts.actorUserId ?? null,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      metadata: opts.metadata ?? {},
      ipHash: ip ? hashIdentifier(ip) : null,
    });
  } catch (err) {
    // Auditing must never break the user flow; log without payload.
    console.error(`[audit] failed to record ${action}:`, (err as Error).message);
  }
}
