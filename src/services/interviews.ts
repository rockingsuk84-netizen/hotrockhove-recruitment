import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import type { ApplicationStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { interviewCancelledEmail, interviewInviteEmail, sendEmail } from "@/lib/email";
import { getTransport } from "@/lib/email/transport";
import { formatInterviewTime, type InterviewDetails } from "@/lib/interviews";
import { getSetting } from "@/lib/settings";

const SEND_GAP_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Inviting to interview moves these statuses forward; rejected and hired are never changed. */
const ADVANCE_FROM: ApplicationStatus[] = ["new", "reviewing", "shortlisted"];

export type ScheduleItem = { requestId: string; at: Date };
export type ScheduleSummary = { invited: number; updated: number; failed: number; skipped: number };

/**
 * Invite applicants who completed a form to interview. Each person has their
 * own time; the format, place or link, contact and notes are shared. If a
 * person already has an interview from this form it is replaced, and they are
 * told the details have changed.
 */
export async function scheduleInterviews(
  formId: string,
  items: ScheduleItem[],
  details: InterviewDetails,
  userId: string,
): Promise<ScheduleSummary> {
  const ids = items.map((i) => i.requestId);
  const rows = ids.length
    ? await db
        .select({ request: t.formRequests, applicant: t.applicants, jobTitle: t.jobs.title, appStatus: t.applications.status })
        .from(t.formRequests)
        .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
        .leftJoin(t.applications, eq(t.applications.id, t.formRequests.applicationId))
        .leftJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
        .where(and(inArray(t.formRequests.id, ids), eq(t.formRequests.formId, formId), eq(t.formRequests.status, "completed")))
    : [];
  const byId = new Map(rows.map((r) => [r.request.id, r]));

  const site = await getSetting("site");
  const throttle = getTransport().name === "resend";
  const summary: ScheduleSummary = { invited: 0, updated: 0, failed: 0, skipped: 0 };
  let emailed = 0;

  for (const item of items) {
    const row = byId.get(item.requestId);
    if (!row || row.applicant.erasedAt) {
      summary.skipped++;
      continue;
    }
    const { request, applicant } = row;

    const interviewId = await db.transaction(async (tx) => {
      const replaced = await tx
        .update(t.interviews)
        .set({ status: "cancelled" })
        .where(and(eq(t.interviews.formRequestId, request.id), eq(t.interviews.status, "scheduled")))
        .returning({ id: t.interviews.id });
      const [created] = await tx
        .insert(t.interviews)
        .values({
          applicantId: applicant.id,
          applicationId: request.applicationId,
          formRequestId: request.id,
          scheduledAt: item.at,
          ...details,
          invitedById: userId,
        })
        .returning({ id: t.interviews.id });
      const advance = Boolean(request.applicationId && row.appStatus && ADVANCE_FROM.includes(row.appStatus));
      if (advance && request.applicationId) {
        await tx
          .update(t.applications)
          .set({ status: "interview", statusChangedAt: new Date() })
          .where(eq(t.applications.id, request.applicationId));
      }
      return { id: created.id, updated: replaced.length > 0, advance };
    });
    if (interviewId.advance) {
      await audit("application.status_change", {
        actorUserId: userId,
        entityType: "application",
        entityId: request.applicationId ?? undefined,
        metadata: { from: row.appStatus, to: "interview", reason: "interview_invite" },
      });
    }

    if (throttle && emailed > 0) await sleep(SEND_GAP_MS);
    emailed++;
    const msg = interviewInviteEmail(site, {
      applicantName: applicant.fullName,
      jobTitle: row.jobTitle,
      when: formatInterviewTime(item.at),
      durationMinutes: details.durationMinutes,
      mode: details.mode,
      location: details.location,
      meetingLink: details.meetingLink,
      phone: applicant.phone || null,
      contactName: details.contactName,
      notes: details.notes,
      updated: interviewId.updated,
    });
    const result = await sendEmail(
      { to: [applicant.email], ...msg, replyTo: site.contactEmail || undefined },
      {
        template: interviewId.updated ? "applicant.interview_updated" : "applicant.interview_invite",
        applicationId: request.applicationId ?? undefined,
        recipientApplicantId: applicant.id,
      },
    );
    await db.update(t.interviews).set({ emailStatus: result.ok ? "sent" : "failed" }).where(eq(t.interviews.id, interviewId.id));
    if (!result.ok) summary.failed++;
    if (interviewId.updated) summary.updated++;
    else summary.invited++;
  }

  await audit("interview.schedule", {
    actorUserId: userId,
    entityType: "form",
    entityId: formId,
    metadata: { ...summary, mode: details.mode },
  });
  return summary;
}

/** Cancel a scheduled interview and tell the applicant. */
export async function cancelInterview(interviewId: string, userId: string) {
  const [row] = await db
    .update(t.interviews)
    .set({ status: "cancelled" })
    .where(and(eq(t.interviews.id, interviewId), eq(t.interviews.status, "scheduled")))
    .returning();
  if (!row) return false;

  const applicant = await db.query.applicants.findFirst({ where: eq(t.applicants.id, row.applicantId) });
  // No email for interviews that have already happened, or for erased applicants.
  if (applicant && !applicant.erasedAt && row.scheduledAt > new Date()) {
    const site = await getSetting("site");
    const msg = interviewCancelledEmail(site, { applicantName: applicant.fullName, when: formatInterviewTime(row.scheduledAt) });
    await sendEmail(
      { to: [applicant.email], ...msg, replyTo: site.contactEmail || undefined },
      { template: "applicant.interview_cancelled", applicationId: row.applicationId ?? undefined, recipientApplicantId: applicant.id },
    );
  }
  await audit("interview.cancel", { actorUserId: userId, entityType: "interview", entityId: interviewId });
  return true;
}
