"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";
import { sendPasswordLink } from "@/services/staff-passwords";

/** `link` is only returned when the email couldn't be delivered, for the admin to pass on securely. */
export type StaffState = { error?: string; created?: { email: string; delivered: boolean; link: string | null } };

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["owner", "admin", "recruiter"]),
});

/**
 * Create a staff account and email an invitation to set a password. The
 * account starts with a random password nobody knows, so it can only be used
 * once the invitee has chosen their own.
 */
export async function createStaff(_: StaffState, fd: FormData): Promise<StaffState> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({ name: fd.get("name"), email: fd.get("email"), role: fd.get("role") });
  if (!parsed.success) return { error: "Enter a name, a valid email address and a role." };
  if (parsed.data.role === "owner" && actor.role !== "owner") return { error: "Only an owner can create another owner." };

  const existing = await db.query.users.findFirst({ where: eq(t.users.email, parsed.data.email) });
  if (existing) return { error: "A user with this email already exists." };

  const id = randomUUID();
  const unusablePassword = await hashPassword(randomBytes(32).toString("base64url"));
  await db.transaction(async (tx) => {
    await tx.insert(t.users).values({ id, ...parsed.data, emailVerified: true });
    await tx.insert(t.accounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: unusablePassword });
  });

  const result = await sendPasswordLink({ id, name: parsed.data.name, email: parsed.data.email }, "invite", actor.name);
  await audit("user.create", { actorUserId: actor.id, entityType: "user", entityId: id, metadata: { role: parsed.data.role } });
  await audit("user.invite", { actorUserId: actor.id, entityType: "user", entityId: id, metadata: { delivered: result.delivered } });
  revalidatePath("/admin/users");
  return { created: { email: parsed.data.email, delivered: result.delivered, link: result.link } };
}

export type ResetLinkState = { error?: string; delivered?: boolean; link?: string | null };

/** Send a staff member a password reset (or a fresh invite if they never set one). */
export async function sendStaffPasswordReset(userId: string): Promise<ResetLinkState> {
  const actor = await requireAdmin();
  const target = await db.query.users.findFirst({ where: eq(t.users.id, userId) });
  if (!target || target.role === "applicant") return { error: "User not found." };
  if (!target.active) return { error: "Reactivate this account first." };
  if (target.role === "owner" && actor.role !== "owner") return { error: "Only an owner can reset another owner's password." };

  const result = await sendPasswordLink(target, "reset");
  await audit("auth.password_reset_requested", { actorUserId: actor.id, entityType: "user", entityId: target.id, metadata: { byAdmin: true, delivered: result.delivered } });
  return { delivered: result.delivered, link: result.link };
}

export async function setStaffActive(userId: string, active: boolean) {
  const actor = await requireAdmin();
  if (userId === actor.id) return; // cannot lock yourself out
  const target = await db.query.users.findFirst({ where: eq(t.users.id, userId) });
  if (!target || (target.role === "owner" && actor.role !== "owner")) return;
  await db.update(t.users).set({ active }).where(eq(t.users.id, userId));
  if (!active) await db.delete(t.sessions).where(eq(t.sessions.userId, userId)); // sign out everywhere
  await audit("user.update", { actorUserId: actor.id, entityType: "user", entityId: userId, metadata: { active } });
  revalidatePath("/admin/users");
}
