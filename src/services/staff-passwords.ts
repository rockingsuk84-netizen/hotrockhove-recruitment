import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { auth } from "@/lib/auth";
import { passwordResetEmail, sendEmail, staffInviteEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";

export const INVITE_EXPIRES_HOURS = 72;
export const RESET_EXPIRES_MINUTES = 60;

export type LinkKind = "invite" | "reset";

/**
 * One-time link that lets a staff member choose a password. Tokens are stored
 * through Better Auth's own verification storage (identifier
 * `reset-password:<token>`), so its reset endpoint validates, expires and
 * consumes them; only the lifetime differs between invites and resets.
 */
export async function createPasswordLink(userId: string, kind: LinkKind) {
  const token = randomBytes(24).toString("base64url");
  const ttlMs = kind === "invite" ? INVITE_EXPIRES_HOURS * 3600_000 : RESET_EXPIRES_MINUTES * 60_000;
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    value: userId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  const url = new URL("/admin/reset-password", env().APP_URL);
  url.searchParams.set("token", token);
  if (kind === "invite") url.searchParams.set("invite", "1");
  return url.toString();
}

/** True when emails are really delivered (Resend configured), not just logged. */
export function emailDeliveryConfigured() {
  return Boolean(env().RESEND_API_KEY);
}

/**
 * Create a link and email it. `link` is returned only when the email could
 * not be delivered, so the admin can pass it on securely instead.
 */
export async function sendPasswordLink(user: { id: string; name: string; email: string }, kind: LinkKind, inviterName?: string) {
  const url = await createPasswordLink(user.id, kind);
  const site = await getSetting("site");
  const msg =
    kind === "invite"
      ? staffInviteEmail(site, { name: user.name, inviterName: inviterName ?? "An administrator", url, expiresHours: INVITE_EXPIRES_HOURS })
      : passwordResetEmail(site, { name: user.name, url, expiresMinutes: RESET_EXPIRES_MINUTES });
  const result = await sendEmail(
    { to: [user.email], ...msg, replyTo: site.contactEmail || undefined },
    { template: kind === "invite" ? "staff.invite" : "staff.password_reset", recipientUserId: user.id },
  );
  const delivered = result.ok && emailDeliveryConfigured();
  return { delivered, link: delivered ? null : url };
}

/** Active staff member by email (never applicants or deactivated accounts). */
export async function findActiveStaffByEmail(email: string) {
  const user = await db.query.users.findFirst({ where: eq(t.users.email, email.trim().toLowerCase()) });
  if (!user || !user.active || user.role === "applicant") return null;
  return user;
}
