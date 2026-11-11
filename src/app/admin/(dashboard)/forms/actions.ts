"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin, requireStaff } from "@/lib/session";
import { eraseApplicant } from "@/services/applicants";
import { interviewDetailsSchema, parseInterviewTime } from "@/lib/interviews";
import {
  cancelFormRequest,
  directRecipientSchema,
  MAX_RECIPIENTS_PER_SEND,
  recordFormDecision,
  resendFormRequest,
  sendFormToApplications,
  sendFormToPerson,
} from "@/services/forms";
import { cancelInterview, scheduleInterviews } from "@/services/interviews";

const uuid = z.string().uuid();

export type SendFormState = { error?: string };

export async function sendFormAction(formId: string, _: SendFormState, fd: FormData): Promise<SendFormState> {
  const user = await requireStaff();
  if (!uuid.safeParse(formId).success) return { error: "Form not found." };
  const ids = fd.getAll("applicationIds").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);
  const result = await sendFormToApplications(formId, ids, { includeAlreadySent: fd.get("includeAlreadySent") === "yes", sentById: user.id });
  if ("error" in result) return { error: result.error };
  revalidatePath(`/admin/forms/${formId}`);
  revalidatePath("/admin/forms");
  const qs = new URLSearchParams({
    sent: String(result.sent),
    failed: String(result.failed),
    skipped: String(result.skippedAlreadySent),
  });
  redirect(`/admin/forms/${formId}?${qs}`);
}

export type DirectSendState = { error?: string; fields?: Record<string, string> };

export async function sendFormToPersonAction(formId: string, _: DirectSendState, fd: FormData): Promise<DirectSendState> {
  const user = await requireStaff();
  if (!uuid.safeParse(formId).success) return { error: "Form not found." };
  const parsed = directRecipientSchema.safeParse({
    fullName: fd.get("fullName") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Please check the highlighted fields.", fields };
  }
  const result = await sendFormToPerson(formId, parsed.data, { includeAlreadySent: fd.get("includeAlreadySent") === "yes", sentById: user.id });
  if ("error" in result) return { error: result.error };
  revalidatePath(`/admin/forms/${formId}`);
  revalidatePath("/admin/forms");
  const qs = new URLSearchParams({ sent: result.emailed ? "1" : "0", failed: result.emailed ? "0" : "1", skipped: "0" });
  redirect(`/admin/forms/${formId}?${qs}`);
}

export async function resendFormAction(formId: string, requestId: string) {
  const user = await requireStaff();
  if (!uuid.safeParse(requestId).success) return;
  await resendFormRequest(requestId, user.id);
  revalidatePath(`/admin/forms/${formId}`);
}

export async function cancelFormAction(formId: string, requestId: string) {
  const user = await requireStaff();
  if (!uuid.safeParse(requestId).success) return;
  await cancelFormRequest(requestId, user.id);
  revalidatePath(`/admin/forms/${formId}`);
}

export type DecisionState = { error?: string; ok?: number; offerEmailed?: boolean | null };

export async function decideFormAction(requestId: string, _: DecisionState, fd: FormData): Promise<DecisionState> {
  const user = await requireStaff();
  if (!uuid.safeParse(requestId).success) return { error: "Response not found." };
  const decision = z.string().trim().min(1, "Choose an outcome.").max(40).safeParse(fd.get("decision"));
  if (!decision.success) return { error: decision.error.issues[0].message };
  const note = z.string().trim().max(2000, "Keep the note under 2,000 characters.").safeParse(fd.get("note") ?? "");
  if (!note.success) return { error: note.error.issues[0].message };
  const offerMessage = z.string().trim().max(3000, "Keep the offer message under 3,000 characters.").safeParse(fd.get("offerMessage") ?? "");
  if (!offerMessage.success) return { error: offerMessage.error.issues[0].message };
  const result = await recordFormDecision(
    requestId,
    { decision: decision.data, note: note.data, sendOffer: fd.get("sendOffer") === "yes", offerMessage: offerMessage.data },
    user.id,
  );
  if ("error" in result) return { error: result.error };
  revalidatePath(`/admin/forms/responses/${requestId}`);
  return { ok: Date.now(), offerEmailed: result.offerEmailed };
}

export type InterviewFormState = { error?: string; fields?: Record<string, string> };

export async function scheduleInterviewsAction(formId: string, _: InterviewFormState, fd: FormData): Promise<InterviewFormState> {
  const user = await requireStaff();
  if (!uuid.safeParse(formId).success) return { error: "Form not found." };
  const requestIds = [...new Set(fd.getAll("requestIds").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success))];
  if (requestIds.length === 0) return { error: "Choose at least one applicant." };
  if (requestIds.length > MAX_RECIPIENTS_PER_SEND) return { error: `You can invite up to ${MAX_RECIPIENTS_PER_SEND} people at a time.` };

  const fields: Record<string, string> = {};
  const details = interviewDetailsSchema.safeParse({
    mode: fd.get("mode") ?? "",
    durationMinutes: fd.get("durationMinutes") ?? "",
    location: fd.get("location") ?? "",
    meetingLink: fd.get("meetingLink") ?? "",
    contactName: fd.get("contactName") ?? "",
    notes: fd.get("notes") ?? "",
  });
  if (!details.success) for (const issue of details.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;

  const items: { requestId: string; at: Date }[] = [];
  for (const id of requestIds) {
    const time = parseInterviewTime(String(fd.get(`at_${id}`) ?? ""));
    if (time.ok) items.push({ requestId: id, at: time.at });
    else fields[`at_${id}`] = time.error;
  }
  if (!details.success || Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };

  const summary = await scheduleInterviews(formId, items, details.data, user.id);
  revalidatePath(`/admin/forms/${formId}`);
  const qs = new URLSearchParams({
    invited: String(summary.invited),
    updated: String(summary.updated),
    failed: String(summary.failed),
  });
  redirect(`/admin/forms/${formId}?${qs}`);
}

export async function eraseFormPersonAction(requestId: string, applicantId: string, fd: FormData) {
  const user = await requireAdmin();
  if (fd.get("confirm") !== "yes" || !uuid.safeParse(applicantId).success) return;
  const result = await eraseApplicant(applicantId);
  await audit("applicant.erase", {
    actorUserId: user.id,
    entityType: "applicant",
    entityId: applicantId,
    metadata: { documents: result.documents, fileErrors: result.fileErrors, reason: "manual" },
  });
  revalidatePath(`/admin/forms/responses/${requestId}`);
}

export async function cancelInterviewAction(requestId: string, interviewId: string) {
  const user = await requireStaff();
  if (!uuid.safeParse(interviewId).success) return;
  await cancelInterview(interviewId, user.id);
  revalidatePath(`/admin/forms/responses/${requestId}`);
}
