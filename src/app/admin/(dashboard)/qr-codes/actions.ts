"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/session";
import { createQrCode, qrInputSchema, updateQrCode } from "@/services/qr-codes";

export type QrFormState = { error?: string; fields?: Record<string, string> };

export async function saveQrCode(_: QrFormState, fd: FormData): Promise<QrFormState> {
  const user = await requireStaff();
  const id = String(fd.get("id") ?? "");
  const targetType = fd.get("targetType");
  const pageChoice = String(fd.get("pageChoice") ?? "");
  const parsed = qrInputSchema.safeParse({
    targetType,
    label: fd.get("label") ?? "",
    source: fd.get("source") ?? "",
    ...(targetType === "job"
      ? { jobId: fd.get("jobId") ?? "" }
      : { path: pageChoice === "custom" ? String(fd.get("customPath") ?? "") : pageChoice }),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Please check the highlighted fields.", fields };
  }

  if (id) {
    if (!z.string().uuid().safeParse(id).success) return { error: "QR code not found." };
    const row = await updateQrCode(id, parsed.data);
    if (!row) return { error: "QR code not found." };
    await audit("qr.update", { actorUserId: user.id, entityType: "qr_code", entityId: id, metadata: { targetType: parsed.data.targetType } });
  } else {
    const row = await createQrCode(parsed.data, user.id);
    await audit("qr.create", { actorUserId: user.id, entityType: "qr_code", entityId: row.id, metadata: { targetType: parsed.data.targetType } });
  }
  revalidatePath("/admin/qr-codes");
  redirect("/admin/qr-codes?saved=1");
}

export async function setQrActive(id: string, active: boolean) {
  const user = await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return;
  await db.update(t.qrCodes).set({ active }).where(eq(t.qrCodes.id, id));
  await audit("qr.update", { actorUserId: user.id, entityType: "qr_code", entityId: id, metadata: { active } });
  revalidatePath("/admin/qr-codes");
}

export async function deleteQrCode(id: string) {
  const user = await requireStaff();
  if (!z.string().uuid().safeParse(id).success) return;
  await db.delete(t.qrCodes).where(eq(t.qrCodes.id, id));
  await audit("qr.delete", { actorUserId: user.id, entityType: "qr_code", entityId: id });
  revalidatePath("/admin/qr-codes");
  redirect("/admin/qr-codes");
}
