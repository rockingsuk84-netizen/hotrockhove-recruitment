"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/session";

export type StaffState = { error?: string; created?: { email: string; password: string } };

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["owner", "admin", "recruiter"]),
});

export async function createStaff(_: StaffState, fd: FormData): Promise<StaffState> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({ name: fd.get("name"), email: fd.get("email"), role: fd.get("role") });
  if (!parsed.success) return { error: "Enter a name, a valid email address and a role." };
  if (parsed.data.role === "owner" && actor.role !== "owner") return { error: "Only an owner can create another owner." };

  const existing = await db.query.users.findFirst({ where: eq(t.users.email, parsed.data.email) });
  if (existing) return { error: "A user with this email already exists." };

  // Temporary password shown once to the creating admin; share it securely and ask them to change it.
  const password = randomBytes(12).toString("base64url");
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(t.users).values({ id, ...parsed.data, emailVerified: true });
    await tx.insert(t.accounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hashPassword(password) });
  });
  await audit("user.create", { actorUserId: actor.id, entityType: "user", entityId: id, metadata: { role: parsed.data.role } });
  revalidatePath("/admin/users");
  return { created: { email: parsed.data.email, password } };
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
