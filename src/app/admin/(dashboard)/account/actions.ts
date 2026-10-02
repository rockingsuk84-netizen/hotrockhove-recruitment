"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { requireStaff } from "@/lib/session";

export type ChangePasswordState = { error?: string };

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().min(12, "Use at least 12 characters.").max(128, "Use 128 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two new passwords don't match.", path: ["confirm"] })
  .refine((v) => v.password !== v.current, { message: "Choose a password different from your current one.", path: ["password"] });

/** Change your own password. Other devices are signed out; this one stays signed in. */
export async function changeOwnPassword(_: ChangePasswordState, fd: FormData): Promise<ChangePasswordState> {
  const user = await requireStaff();
  const parsed = schema.safeParse({ current: fd.get("current") ?? "", password: fd.get("password") ?? "", confirm: fd.get("confirm") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.current, newPassword: parsed.data.password, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    return { error: "Your current password is incorrect." };
  }
  await audit("auth.password_changed", { actorUserId: user.id, entityType: "user", entityId: user.id });
  // Changing the password replaces this session; a fresh navigation picks up the new cookie.
  redirect("/admin/account?changed=1");
}
