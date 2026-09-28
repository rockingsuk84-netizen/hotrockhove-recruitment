"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { JobStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
import { normaliseSource } from "@/lib/qr";
import { requireStaff } from "@/lib/session";
import { fieldErrors } from "@/lib/validation";
import { createJob, jobInputSchema, setJobStatus, updateJob } from "@/services/jobs";

export type JobFormState = { error?: string; fields?: Record<string, string> };

export async function saveJob(_: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireStaff();
  const id = formData.get("id");

  let questions: unknown = [];
  try {
    questions = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { error: "The additional questions could not be read." };
  }

  const parsed = jobInputSchema.safeParse({
    title: formData.get("title") ?? "",
    slug: formData.get("slug") ?? "",
    summary: formData.get("summary") ?? "",
    description: formData.get("description") ?? "",
    responsibilities: formData.get("responsibilities") ?? "",
    requirements: formData.get("requirements") ?? "",
    benefits: formData.get("benefits") ?? "",
    standoutPrompt: formData.get("standoutPrompt") ?? "",
    locationId: formData.get("locationId") ?? "",
    departmentId: formData.get("departmentId") ?? "",
    employmentTypeId: formData.get("employmentTypeId") ?? "",
    positionIds: formData.getAll("positionIds").map(String),
    featured: formData.get("featured") === "on",
    imageUrl: formData.get("imageUrl") ?? "",
    questions,
  });
  if (!parsed.success) return { error: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) };

  let jobId: string;
  if (typeof id === "string" && id) {
    const job = await updateJob(id, parsed.data);
    if (!job) return { error: "This job no longer exists." };
    jobId = job.id;
    await audit("job.update", { actorUserId: user.id, entityType: "job", entityId: jobId });
  } else {
    const job = await createJob(parsed.data, user.id);
    jobId = job.id;
    await db.insert(t.jobQrCodes).values({ jobId, source: "", label: "Direct link", createdById: user.id }).onConflictDoNothing();
    await audit("job.create", { actorUserId: user.id, entityType: "job", entityId: jobId });
  }
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${jobId}?saved=1`);
}

const STATUS_ACTION: Record<JobStatus, "job.publish" | "job.unpublish" | "job.close"> = {
  published: "job.publish",
  draft: "job.unpublish",
  closed: "job.close",
};

export async function changeJobStatus(jobId: string, status: JobStatus) {
  const user = await requireStaff();
  if (!z.string().uuid().safeParse(jobId).success || !(status in STATUS_ACTION)) return;
  await setJobStatus(jobId, status);
  await audit(STATUS_ACTION[status], { actorUserId: user.id, entityType: "job", entityId: jobId });
  revalidatePath(`/admin/jobs/${jobId}`);
}

export type QrFormState = { error?: string };

export async function createQrCode(jobId: string, _: QrFormState, formData: FormData): Promise<QrFormState> {
  const user = await requireStaff();
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  const source = normaliseSource(String(formData.get("source") ?? "") || label);
  if (!label) return { error: "Give the QR code a name, e.g. Window poster." };
  if (!source) return { error: "Enter a source such as poster, event or instagram." };
  const existing = await db.query.jobQrCodes.findFirst({
    where: and(eq(t.jobQrCodes.jobId, jobId), eq(t.jobQrCodes.source, source)),
  });
  if (existing) return { error: `A QR code with source "${source}" already exists for this job.` };
  await db.insert(t.jobQrCodes).values({ jobId, label, source, createdById: user.id });
  await audit("job.qr_create", { actorUserId: user.id, entityType: "job", entityId: jobId, metadata: { source } });
  revalidatePath(`/admin/jobs/${jobId}`);
  return {};
}

export async function deleteQrCode(jobId: string, qrId: string) {
  const user = await requireStaff();
  await db.delete(t.jobQrCodes).where(and(eq(t.jobQrCodes.id, qrId), eq(t.jobQrCodes.jobId, jobId)));
  await audit("job.qr_delete", { actorUserId: user.id, entityType: "job", entityId: jobId });
  revalidatePath(`/admin/jobs/${jobId}`);
}
