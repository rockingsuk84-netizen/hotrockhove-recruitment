"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";

export type ResetState = { error?: string; expired?: boolean };

const schema = z
  .object({
    token: z.string().min(10).max(200),
    password: z.string().min(12, "Use at least 12 characters.").max(128, "Use 128 characters or fewer."),
    confirm: z.string(),
    invite: z.string().optional(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

/** Sets a new password from an invite or reset link (token validated and consumed by Better Auth). */
export async function setNewPassword(_: ResetState, fd: FormData): Promise<ResetState> {
  const parsed = schema.safeParse({
    token: fd.get("token") ?? "",
    password: fd.get("password") ?? "",
    confirm: fd.get("confirm") ?? "",
    invite: fd.get("invite") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token }, headers: await headers() });
  } catch {
    return { error: "This link is invalid, has already been used or has expired.", expired: true };
  }
  redirect(`/admin/login?${parsed.data.invite === "1" ? "welcome" : "reset"}=1`);
}
