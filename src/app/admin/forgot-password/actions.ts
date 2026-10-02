"use server";

import { z } from "zod";
import { audit, clientIp } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { findActiveStaffByEmail, sendPasswordLink } from "@/services/staff-passwords";

export type ForgotState = { done?: boolean; error?: string };

/**
 * Always answers the same way, so the form can't reveal which emails have
 * accounts. Only active staff receive a link.
 */
export async function requestPasswordReset(_: ForgotState, fd: FormData): Promise<ForgotState> {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(fd.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };

  const ipLimit = await rateLimit(RATE_LIMITS.passwordResetPerIp, (await clientIp()) ?? "unknown");
  const emailLimit = await rateLimit(RATE_LIMITS.passwordResetPerEmail, email.data);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    await audit("security.rate_limited", { metadata: { rule: "password-reset" } });
    return { done: true };
  }

  const user = await findActiveStaffByEmail(email.data);
  if (user) {
    try {
      await sendPasswordLink(user, "reset");
      await audit("auth.password_reset_requested", { actorUserId: user.id, entityType: "user", entityId: user.id });
    } catch (err) {
      console.error("[auth] reset email failed:", (err as Error).message);
    }
  }
  return { done: true };
}
