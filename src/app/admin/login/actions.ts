"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, clientIp } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export type LoginState = { error?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export async function signIn(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password." };

  const ip = (await clientIp()) ?? "unknown";
  const limit = await rateLimit(RATE_LIMITS.adminSignInPerIp, ip);
  if (!limit.allowed) {
    await audit("security.rate_limited", { metadata: { rule: RATE_LIMITS.adminSignInPerIp.name } });
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  try {
    const result = await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
    await audit("auth.sign_in", { actorUserId: result.user.id, entityType: "user", entityId: result.user.id });
  } catch {
    // Same message for unknown email, wrong password or deactivated account.
    await audit("auth.sign_in_failed");
    return { error: "Incorrect email or password." };
  }
  redirect("/admin");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
