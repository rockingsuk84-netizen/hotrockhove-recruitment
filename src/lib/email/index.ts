import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getTransport, type OutgoingEmail } from "./transport";

export * from "./templates";

type NotificationContext = {
  template: string;
  applicationId?: string;
  recipientApplicantId?: string;
  recipientUserId?: string;
};

/**
 * Send an email and record it in the notifications history. Failures are
 * recorded rather than thrown so a submission is never lost to an email outage.
 */
export async function sendEmail(msg: OutgoingEmail, ctx: NotificationContext) {
  const [row] = await db
    .insert(t.notifications)
    .values({
      channel: "email",
      template: ctx.template,
      applicationId: ctx.applicationId ?? null,
      recipientApplicantId: ctx.recipientApplicantId ?? null,
      recipientUserId: ctx.recipientUserId ?? null,
      recipientAddress: msg.to.join(", "),
      subject: msg.subject,
      status: "queued",
    })
    .returning({ id: t.notifications.id });

  let result;
  try {
    result = await getTransport().send(msg);
  } catch (err) {
    result = { ok: false as const, error: (err as Error).message };
  }

  await db
    .update(t.notifications)
    .set(
      result.ok
        ? { status: "sent", providerMessageId: result.id, sentAt: new Date() }
        : { status: "failed", error: result.error.slice(0, 500) },
    )
    .where(eq(t.notifications.id, row.id));

  if (!result.ok) console.error(`[email] ${ctx.template} failed: ${result.error}`);
  return result;
}
