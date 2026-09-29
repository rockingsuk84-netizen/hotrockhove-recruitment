import "server-only";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, t } from "@/db";
import type { ApplicationQuestion } from "@/db/schema";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { adminNewApplicationEmail, applicantConfirmationEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { safeDisplayFilename, validateCv } from "@/lib/files";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { fillTemplate, getSetting } from "@/lib/settings";
import { getActiveStorage } from "@/lib/storage";
import { applicationFieldsSchema, fieldErrors, type ApplicationFields } from "@/lib/validation";

export type SubmitResult =
  | { ok: true; applicationId: string; jobSlug: string; duplicate: boolean }
  | { ok: false; status: number; error: string; fields?: Record<string, string> };

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function readAnswers(form: FormData, questions: ApplicationQuestion[]) {
  const answers: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const raw = form.get(`q_${q.id}`);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (q.required && !value) errors[`q_${q.id}`] = "This question is required.";
    else if (value.length > q.maxLength) errors[`q_${q.id}`] = `Please keep this under ${q.maxLength} characters.`;
    else if (value) answers[q.id] = value;
  }
  return { answers, errors };
}

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

/**
 * Validate and persist a public application. The caller (route handler) is
 * responsible for method/size checks, rate limiting, honeypot and Turnstile.
 */
export async function submitApplication(form: FormData): Promise<SubmitResult> {
  const parsed = applicationFieldsSchema.safeParse({
    jobId: str(form, "jobId"),
    positionId: str(form, "positionId"),
    fullName: str(form, "fullName"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    standoutQuality: str(form, "standoutQuality"),
    coverMessage: str(form, "coverMessage"),
    source: str(form, "source"),
    consent: str(form, "consent"),
    submissionToken: str(form, "submissionToken"),
  });

  const job = parsed.success
    ? await db.query.jobs.findFirst({ where: (j, { eq, and }) => and(eq(j.id, parsed.data.jobId), eq(j.status, "published")) })
    : null;

  const { answers, errors: answerErrors } = readAnswers(form, job?.questions ?? []);
  const errors = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...answerErrors };

  if (parsed.success && !job) {
    return { ok: false, status: 404, error: "This job is no longer accepting applications." };
  }

  let positionName: string | null = null;
  if (parsed.success && job) {
    const jobPositions = await db
      .select({ id: t.positions.id, name: t.positions.name })
      .from(t.jobPositions)
      .innerJoin(t.positions, eq(t.positions.id, t.jobPositions.positionId))
      .where(eq(t.jobPositions.jobId, job.id));
    if (jobPositions.length === 1) {
      // Single-role job: the role is implied, so record it without asking the applicant.
      parsed.data.positionId = jobPositions[0].id;
      positionName = jobPositions[0].name;
    } else if (jobPositions.length > 1) {
      const match = jobPositions.find((p) => p.id === parsed.data.positionId);
      if (!match) errors.positionId = "Please choose the role you are applying for.";
      positionName = match?.name ?? null;
    }
  }

  // CV
  const file = form.get("cv");
  const uploads = await getSetting("uploads");
  const rules = { maxBytes: uploads.maxCvBytes, allowed: uploads.allowedCvTypes };
  let cv: { buf: Buffer; name: string; check: Extract<ReturnType<typeof validateCv>, { ok: true }> } | null = null;
  if (!(file instanceof File) || file.size === 0) {
    errors.cv = "Please upload your CV.";
  } else {
    // Size is checked before the bytes are read into memory.
    const buf = file.size > rules.maxBytes ? Buffer.alloc(0) : Buffer.from(await file.arrayBuffer());
    const check = validateCv(file, buf, rules);
    if (check.ok) {
      cv = { buf, name: file.name, check };
    } else {
      errors.cv = check.error;
      await audit("security.invalid_upload", { entityType: "job", entityId: job?.id, metadata: { size: file.size } });
    }
  }

  if (!parsed.success || !job || Object.keys(errors).length > 0 || !cv) {
    return { ok: false, status: 422, error: "Please check the highlighted fields.", fields: errors };
  }

  return persist(parsed.data, job, positionName, answers, cv.buf, cv.name, cv.check);
}

async function persist(
  data: ApplicationFields,
  job: typeof t.jobs.$inferSelect,
  positionName: string | null,
  answers: Record<string, string>,
  buf: Buffer,
  originalName: string,
  check: Extract<ReturnType<typeof validateCv>, { ok: true }>,
): Promise<SubmitResult> {
  // Idempotency: a retried request with the same token returns the original result.
  const existingByToken = await db.query.applications.findFirst({
    where: (a, { eq }) => eq(a.submissionToken, data.submissionToken),
  });
  if (existingByToken) return { ok: true, applicationId: existingByToken.id, jobSlug: job.slug, duplicate: true };

  // Accidental double submission (e.g. two tabs) within a short window.
  const known = await db.query.applicants.findFirst({ where: (a, { eq }) => eq(a.email, data.email), columns: { id: true } });
  if (known) {
    const recent = await db.query.applications.findFirst({
      where: (a, { and, eq, gt }) =>
        and(eq(a.applicantId, known.id), eq(a.jobId, job.id), gt(a.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS))),
    });
    if (recent) return { ok: true, applicationId: recent.id, jobSlug: job.slug, duplicate: true };
  }

  // Per person + job limit. Counted only for valid, non-duplicate submissions so an
  // applicant correcting mistakes is never locked out.
  const emailLimit = await rateLimit(RATE_LIMITS.applicationPerEmail, `${data.email}|${job.id}`);
  if (!emailLimit.allowed) {
    await audit("security.rate_limited", { metadata: { rule: RATE_LIMITS.applicationPerEmail.name } });
    return { ok: false, status: 429, error: "You've already applied for this job recently. Please try again later." };
  }

  // Returning applicants reuse their canonical record (matched on normalised email).
  // The email is unverified, so an existing profile's name/phone are not overwritten;
  // each application keeps its own snapshot of the submitted contact details.
  const [applicant] = await db
    .insert(t.applicants)
    .values({ email: data.email, fullName: data.fullName, phone: data.phone, lastAppliedAt: new Date() })
    .onConflictDoUpdate({ target: t.applicants.email, set: { lastAppliedAt: new Date() } })
    .returning();

  const storage = await getActiveStorage();
  const documentId = randomUUID();
  const { storageKey } = await storage.upload({
    key: `applicants/${applicant.id}/${documentId}.${check.extension}`,
    body: buf,
    contentType: check.mimeType,
  });

  const site = await getSetting("site");
  const privacy = await getSetting("privacy");

  let applicationId: string;
  try {
    applicationId = await db.transaction(async (tx) => {
      const [application] = await tx
        .insert(t.applications)
        .values({
          applicantId: applicant.id,
          jobId: job.id,
          positionId: data.positionId,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          standoutQuality: data.standoutQuality,
          coverMessage: data.coverMessage,
          answers,
          source: data.source,
          consentText: fillTemplate(privacy.consentText, { brandName: site.brandName }),
          consentedAt: new Date(),
          submissionToken: data.submissionToken,
        })
        .returning({ id: t.applications.id });
      await tx.insert(t.documents).values({
        id: documentId,
        applicantId: applicant.id,
        applicationId: application.id,
        type: "cv",
        originalFilename: safeDisplayFilename(originalName, check.extension),
        mimeType: check.mimeType,
        sizeBytes: buf.length,
        sha256: sha256(buf),
        storageProvider: storage.provider,
        storageKey,
      });
      return application.id;
    });
  } catch (err) {
    await storage.delete(storageKey).catch(() => undefined);
    // Concurrent retry with the same idempotency token.
    const again = await db.query.applications.findFirst({ where: (a, { eq }) => eq(a.submissionToken, data.submissionToken) });
    if (again) return { ok: true, applicationId: again.id, jobSlug: job.slug, duplicate: true };
    throw err;
  }

  await audit("application.submitted", {
    entityType: "application",
    entityId: applicationId,
    metadata: { jobId: job.id, source: data.source, storage: storage.provider },
  });

  return { ok: true, applicationId, jobSlug: job.slug, duplicate: false };
}

/** Confirmation to the applicant and alert to configured recipients. Runs after the response. */
export async function sendApplicationEmails(applicationId: string) {
  const [row] = await db
    .select({
      application: t.applications,
      jobTitle: t.jobs.title,
      positionName: t.positions.name,
    })
    .from(t.applications)
    .innerJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
    .leftJoin(t.positions, eq(t.positions.id, t.applications.positionId))
    .where(eq(t.applications.id, applicationId))
    .limit(1);
  if (!row) return;

  const site = await getSetting("site");
  const n = await getSetting("notifications");
  const a = row.application;
  const role = row.positionName && row.positionName !== row.jobTitle ? row.positionName : null;
  const jobTitle = role ? `${role} – ${row.jobTitle}` : row.jobTitle;

  if (n.sendApplicantConfirmation) {
    const msg = applicantConfirmationEmail(site, n, { applicantName: a.fullName, jobTitle });
    await sendEmail(
      { to: [a.email], ...msg, replyTo: site.contactEmail || undefined },
      { template: "applicant.application_received", applicationId, recipientApplicantId: a.applicantId },
    );
  }

  if (n.sendAdminNotification && n.adminRecipients.length > 0) {
    const msg = adminNewApplicationEmail(site, n, {
      applicantName: a.fullName,
      jobTitle: row.jobTitle,
      position: role,
      email: a.email,
      phone: a.phone,
      source: a.source,
      dashboardUrl: new URL(`/admin/applications/${applicationId}`, env().APP_URL).toString(),
    });
    await sendEmail({ to: n.adminRecipients, ...msg }, { template: "admin.new_application", applicationId });
  }
}
