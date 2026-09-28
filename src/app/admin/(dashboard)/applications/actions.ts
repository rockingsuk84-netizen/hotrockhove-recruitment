"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { APPLICATION_STATUSES } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin, requireStaff } from "@/lib/session";
import { eraseApplicant } from "@/services/applicants";

const uuid = z.string().uuid();

export async function updateStatus(applicationId: string, formData: FormData) {
  const user = await requireStaff();
  const status = z.enum(APPLICATION_STATUSES).safeParse(formData.get("status"));
  if (!uuid.safeParse(applicationId).success || !status.success) return;

  const current = await db.query.applications.findFirst({ where: eq(t.applications.id, applicationId), columns: { status: true } });
  if (!current || current.status === status.data) return;

  await db.update(t.applications).set({ status: status.data, statusChangedAt: new Date() }).where(eq(t.applications.id, applicationId));
  await audit("application.status_change", {
    actorUserId: user.id,
    entityType: "application",
    entityId: applicationId,
    metadata: { from: current.status, to: status.data },
  });
  revalidatePath(`/admin/applications/${applicationId}`);
}

export type NoteState = { error?: string; ok?: number };

export async function addNote(applicationId: string, _: NoteState, formData: FormData): Promise<NoteState> {
  const user = await requireStaff();
  const body = z.string().trim().min(1, "Write a note first.").max(5000).safeParse(formData.get("body"));
  if (!body.success) return { error: body.error.issues[0].message };
  if (!uuid.safeParse(applicationId).success) return { error: "Application not found." };

  await db.insert(t.applicationNotes).values({ applicationId, authorId: user.id, body: body.data });
  await audit("application.note_add", { actorUserId: user.id, entityType: "application", entityId: applicationId });
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: Date.now() };
}

export async function eraseApplicantAction(applicationId: string, applicantId: string, formData: FormData) {
  const user = await requireAdmin();
  if (formData.get("confirm") !== "yes" || !uuid.safeParse(applicantId).success) return;
  const result = await eraseApplicant(applicantId);
  await audit("applicant.erase", {
    actorUserId: user.id,
    entityType: "applicant",
    entityId: applicantId,
    metadata: { documents: result.documents, fileErrors: result.fileErrors, reason: "manual" },
  });
  revalidatePath("/admin/applications");
  redirect(`/admin/applications/${applicationId}?erased=1`);
}
