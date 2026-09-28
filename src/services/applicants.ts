import "server-only";
import { and, eq, inArray, isNull, lt, notExists } from "drizzle-orm";
import { db, t } from "@/db";
import { getStorageFor } from "@/lib/storage";

/**
 * Erase an applicant's personal data (right to erasure / retention expiry).
 * Stored files are deleted from their provider; database rows are anonymised
 * rather than removed so aggregate reporting and referential integrity survive.
 */
export async function eraseApplicant(applicantId: string) {
  const docs = await db
    .select()
    .from(t.documents)
    .where(and(eq(t.documents.applicantId, applicantId), isNull(t.documents.deletedAt)));

  let fileErrors = 0;
  for (const doc of docs) {
    try {
      const storage = await getStorageFor(doc.storageProvider);
      await storage.delete(doc.storageKey);
    } catch {
      fileErrors++;
    }
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(t.documents)
      .set({ deletedAt: now, originalFilename: "erased", storageKey: "erased" })
      .where(eq(t.documents.applicantId, applicantId));
    const apps = await tx.select({ id: t.applications.id }).from(t.applications).where(eq(t.applications.applicantId, applicantId));
    const appIds = apps.map((a) => a.id);
    if (appIds.length) {
      await tx
        .update(t.applications)
        .set({ fullName: "Erased applicant", email: "", phone: "", standoutQuality: "", coverMessage: null, answers: {} })
        .where(inArray(t.applications.id, appIds));
      await tx.delete(t.applicationNotes).where(inArray(t.applicationNotes.applicationId, appIds));
      await tx.update(t.notifications).set({ recipientAddress: null, subject: null }).where(inArray(t.notifications.applicationId, appIds));
    }
    await tx
      .update(t.applicants)
      .set({ fullName: "Erased applicant", email: `erased-${applicantId}@invalid`, phone: "", erasedAt: now })
      .where(eq(t.applicants.id, applicantId));
  });

  return { documents: docs.length, fileErrors };
}

/**
 * Applicants whose most recent application is older than the retention period.
 * Anyone with a "hired" application is excluded — they move into employment records.
 */
export async function findApplicantsPastRetention(retentionDays: number, limit = 100) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  return db
    .select({ id: t.applicants.id })
    .from(t.applicants)
    .where(
      and(
        isNull(t.applicants.erasedAt),
        lt(t.applicants.lastAppliedAt, cutoff),
        notExists(
          db
            .select({ id: t.applications.id })
            .from(t.applications)
            .where(and(eq(t.applications.applicantId, t.applicants.id), eq(t.applications.status, "hired"))),
        ),
      ),
    )
    .limit(limit);
}
