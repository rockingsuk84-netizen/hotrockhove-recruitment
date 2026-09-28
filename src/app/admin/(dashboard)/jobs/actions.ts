"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { JobStatus } from "@/db/schema";
import { audit } from "@/lib/audit";
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
