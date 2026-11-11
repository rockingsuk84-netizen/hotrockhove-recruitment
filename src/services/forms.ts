import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, TransactionRollbackError } from "drizzle-orm";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { formRequestEmail, formResponseCopyEmail, offerEmail, sendEmail } from "@/lib/email";
import { getTransport } from "@/lib/email/transport";
import { env } from "@/lib/env";
import { safeDisplayFilename, validateCv } from "@/lib/files";
import { answerRows, CV_INPUT, parseAnswers, type FormDefinition } from "@/lib/forms/definition";
import { formatDate } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { getActiveStorage } from "@/lib/storage";

/** How long an emailed form link stays valid. */
export const FORM_LINK_DAYS = 30;
/** Most recipients per send, so one request finishes well inside the function time limit. */
export const MAX_RECIPIENTS_PER_SEND = 200;
/** Resend's default limit is 2 requests per second. */
const SEND_GAP_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* -------------------------------------------------------------------------- */

/** 256-bit random link token. Only its hash is stored, so a database leak exposes no working links. */
export function newFormToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashFormToken(token) };
}

export function hashFormToken(token: string) {
  return sha256(Buffer.from(token, "utf8"));
}

/** Tokens are 43 base64url characters; anything else is rejected before touching the database. */
export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

function linkFor(token: string) {
  return new URL(`/forms/${token}`, env().APP_URL).toString();
}

function expiry() {
  return new Date(Date.now() + FORM_LINK_DAYS * 24 * 60 * 60 * 1000);
}

/* -------------------------------------------------------------------------- */
/* CV on file                                                                 */
/* -------------------------------------------------------------------------- */

/** Applicants (of those given) who already have a CV stored. */
export async function applicantsWithCv(applicantIds: string[]): Promise<Set<string>> {
  if (applicantIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ applicantId: t.documents.applicantId })
    .from(t.documents)
    .where(and(inArray(t.documents.applicantId, applicantIds), eq(t.documents.type, "cv"), isNull(t.documents.deletedAt)));
  return new Set(rows.map((r) => r.applicantId));
}

/* -------------------------------------------------------------------------- */
/* Sending                                                                    */
/* -------------------------------------------------------------------------- */

async function deliver(requestId: string, token: string) {
  const [row] = await db
    .select({ request: t.formRequests, applicant: t.applicants })
    .from(t.formRequests)
    .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
    .where(eq(t.formRequests.id, requestId))
    .limit(1);
  if (!row || row.applicant.erasedAt) return false;

  const site = await getSetting("site");
  const def = row.request.definition;
  const msg = formRequestEmail(site, {
    applicantName: row.applicant.fullName,
    formTitle: def.title,
    intro: def.intro,
    url: linkFor(token),
    expiresOn: formatDate(row.request.expiresAt),
  });
  const result = await sendEmail(
    { to: [row.applicant.email], ...msg, replyTo: site.contactEmail || undefined },
    { template: "applicant.form_request", applicationId: row.request.applicationId ?? undefined, recipientApplicantId: row.applicant.id },
  );
  await db
    .update(t.formRequests)
    .set({ emailStatus: result.ok ? "sent" : "failed" })
    .where(eq(t.formRequests.id, requestId));
  return result.ok;
}

export type SendSummary = { sent: number; failed: number; skippedAlreadySent: number; skippedErased: number };

/**
 * Send a form to the applicants behind the chosen applications. Each person
 * gets one request even if several of their applications were ticked. People
 * who already have an open or completed request for this form are skipped
 * unless `includeAlreadySent` is set.
 */
export async function sendFormToApplications(
  formId: string,
  applicationIds: string[],
  opts: { includeAlreadySent: boolean; sentById: string },
): Promise<SendSummary | { error: string }> {
  const form = await db.query.forms.findFirst({ where: and(eq(t.forms.id, formId), eq(t.forms.status, "active")) });
  if (!form) return { error: "This form can't be sent because it is archived or doesn't exist." };
  const ids = [...new Set(applicationIds)];
  if (ids.length === 0) return { error: "Choose at least one applicant." };
  if (ids.length > MAX_RECIPIENTS_PER_SEND) return { error: `You can send to up to ${MAX_RECIPIENTS_PER_SEND} applicants at a time.` };

  const apps = await db
    .select({ id: t.applications.id, applicantId: t.applications.applicantId, erasedAt: t.applicants.erasedAt })
    .from(t.applications)
    .innerJoin(t.applicants, eq(t.applicants.id, t.applications.applicantId))
    .where(inArray(t.applications.id, ids))
    .orderBy(desc(t.applications.createdAt));

  // One request per person, linked to their most recent ticked application.
  const byApplicant = new Map<string, string>();
  let skippedErased = 0;
  for (const a of apps) {
    if (a.erasedAt) {
      skippedErased++;
      continue;
    }
    if (!byApplicant.has(a.applicantId)) byApplicant.set(a.applicantId, a.id);
  }

  let skippedAlreadySent = 0;
  if (!opts.includeAlreadySent && byApplicant.size) {
    const existing = await db
      .select({ applicantId: t.formRequests.applicantId })
      .from(t.formRequests)
      .where(
        and(
          eq(t.formRequests.formId, formId),
          inArray(t.formRequests.applicantId, [...byApplicant.keys()]),
          inArray(t.formRequests.status, ["sent", "completed"]),
        ),
      );
    for (const e of existing) if (byApplicant.delete(e.applicantId)) skippedAlreadySent++;
  }

  const throttle = getTransport().name === "resend";
  let sent = 0;
  let failed = 0;
  for (const [applicantId, applicationId] of byApplicant) {
    const { token, hash } = newFormToken();
    const [req] = await db
      .insert(t.formRequests)
      .values({
        formId,
        applicantId,
        applicationId,
        definition: form.definition,
        tokenHash: hash,
        sentById: opts.sentById,
        expiresAt: expiry(),
      })
      .returning({ id: t.formRequests.id });
    if (throttle && sent + failed > 0) await sleep(SEND_GAP_MS);
    if (await deliver(req.id, token)) sent++;
    else failed++;
  }

  await audit("form.send", {
    actorUserId: opts.sentById,
    entityType: "form",
    entityId: formId,
    metadata: { sent, failed, skippedAlreadySent, skippedErased },
  });
  return { sent, failed, skippedAlreadySent, skippedErased };
}

/** Email a fresh link (the old one stops working) and restart the expiry clock. */
export async function resendFormRequest(requestId: string, userId: string) {
  const req = await db.query.formRequests.findFirst({ where: eq(t.formRequests.id, requestId) });
  if (!req || req.status !== "sent") return false;
  const { token, hash } = newFormToken();
  await db
    .update(t.formRequests)
    .set({ tokenHash: hash, expiresAt: expiry(), sentAt: new Date(), emailStatus: "queued" })
    .where(and(eq(t.formRequests.id, requestId), eq(t.formRequests.status, "sent")));
  const ok = await deliver(requestId, token);
  await audit("form.resend", { actorUserId: userId, entityType: "form_request", entityId: requestId, metadata: { emailed: ok } });
  return true;
}

export async function cancelFormRequest(requestId: string, userId: string) {
  const rows = await db
    .update(t.formRequests)
    .set({ status: "cancelled" })
    .where(and(eq(t.formRequests.id, requestId), eq(t.formRequests.status, "sent")))
    .returning({ id: t.formRequests.id });
  if (rows.length) await audit("form.cancel", { actorUserId: userId, entityType: "form_request", entityId: requestId });
  return rows.length > 0;
}

/* -------------------------------------------------------------------------- */
/* The applicant's side                                                       */
/* -------------------------------------------------------------------------- */

export type OpenFormRequest = {
  state: "open" | "completed" | "expired" | "cancelled";
  id: string;
  definition: FormDefinition;
  applicantName: string;
  cvOnFile: boolean;
  expiresAt: Date;
};

/** Look up a request from the token in an emailed link. Unknown tokens and erased applicants return null. */
export async function findFormRequestByToken(token: string): Promise<OpenFormRequest | null> {
  if (!isWellFormedToken(token)) return null;
  const [row] = await db
    .select({ request: t.formRequests, applicant: t.applicants })
    .from(t.formRequests)
    .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
    .where(eq(t.formRequests.tokenHash, hashFormToken(token)))
    .limit(1);
  if (!row || row.applicant.erasedAt) return null;
  const r = row.request;
  const state =
    r.status === "completed" ? "completed" : r.status === "cancelled" ? "cancelled" : r.expiresAt < new Date() ? "expired" : "open";
  const cvOnFile = (await applicantsWithCv([row.applicant.id])).has(row.applicant.id);
  return { state, id: r.id, definition: r.definition, applicantName: row.applicant.fullName, cvOnFile, expiresAt: r.expiresAt };
}

export type SubmitFormResult = { ok: true; requestId: string } | { ok: false; status: number; error: string; fields?: Record<string, string> };

/** Validate and store a response. The route handler does the size, method and rate-limit checks. */
export async function submitFormResponse(token: string, form: FormData): Promise<SubmitFormResult> {
  const req = await findFormRequestByToken(token);
  if (!req) return { ok: false, status: 404, error: "This link isn't valid. Please use the link in your most recent email." };
  if (req.state === "completed") return { ok: false, status: 409, error: "You've already completed this form. Thank you." };
  if (req.state !== "open") return { ok: false, status: 410, error: "This link has expired. Please contact us and we'll send you a new one." };

  const parsed = parseAnswers(req.definition, form, { cvOnFile: req.cvOnFile });
  const errors: Record<string, string> = parsed.ok ? {} : { ...parsed.errors };

  const hasCvField = req.definition.fields.some((f) => f.type === "cv_upload");
  const file = form.get(CV_INPUT);
  const uploads = await getSetting("uploads");
  let cv: { buf: Buffer; name: string; check: Extract<ReturnType<typeof validateCv>, { ok: true }> } | null = null;
  if (hasCvField && file instanceof File && file.size > 0) {
    const buf = file.size > uploads.maxCvBytes ? Buffer.alloc(0) : Buffer.from(await file.arrayBuffer());
    const check = validateCv(file, buf, { maxBytes: uploads.maxCvBytes, allowed: uploads.allowedCvTypes });
    if (check.ok) cv = { buf, name: file.name, check };
    else {
      errors[CV_INPUT] = check.error;
      await audit("security.invalid_upload", { entityType: "form_request", entityId: req.id, metadata: { size: file.size } });
    }
  } else if (parsed.ok && parsed.cvRequired) {
    errors[CV_INPUT] = "Please upload your CV.";
  }

  if (!parsed.ok || Object.keys(errors).length) {
    return { ok: false, status: 422, error: "Please check the highlighted fields.", fields: errors };
  }

  const request = await db.query.formRequests.findFirst({ where: eq(t.formRequests.id, req.id) });
  if (!request) return { ok: false, status: 404, error: "This link isn't valid." };

  let stored: { key: string; provider: Awaited<ReturnType<typeof getActiveStorage>>["provider"]; documentId: string } | null = null;
  if (cv) {
    const storage = await getActiveStorage();
    const documentId = randomUUID();
    const { storageKey } = await storage.upload({
      key: `applicants/${request.applicantId}/${documentId}.${cv.check.extension}`,
      body: cv.buf,
      contentType: cv.check.mimeType,
    });
    stored = { key: storageKey, provider: storage.provider, documentId };
  }

  const answers = parsed.answers;
  let updated = false;
  try {
    updated = await db.transaction(async (tx) => {
      if (cv && stored) {
        await tx.insert(t.documents).values({
          id: stored.documentId,
          applicantId: request.applicantId,
          applicationId: request.applicationId,
          type: "cv",
          originalFilename: safeDisplayFilename(cv.name, cv.check.extension),
          mimeType: cv.check.mimeType,
          sizeBytes: cv.buf.length,
          sha256: sha256(cv.buf),
          storageProvider: stored.provider,
          storageKey: stored.key,
        });
      }
      // Guarded on status so two simultaneous submissions can't both be accepted.
      const rows = await tx
        .update(t.formRequests)
        .set({ status: "completed", completedAt: new Date(), answers, cvDocumentId: stored?.documentId ?? null })
        .where(and(eq(t.formRequests.id, request.id), eq(t.formRequests.status, "sent")))
        .returning({ id: t.formRequests.id });
      if (rows.length === 0) tx.rollback();
      return true;
    });
  } catch (err) {
    if (stored) {
      const storage = await getActiveStorage();
      await storage.delete(stored.key).catch(() => undefined);
    }
    if (!(err instanceof TransactionRollbackError)) throw err;
  }

  if (!updated) return { ok: false, status: 409, error: "You've already completed this form. Thank you." };

  await audit("form.completed", { entityType: "form_request", entityId: request.id, metadata: { formId: request.formId, cvUploaded: Boolean(cv) } });
  return { ok: true, requestId: request.id };
}

/** Email the applicant a copy of their answers. Runs after the response is sent. */
export async function sendFormResponseCopy(requestId: string) {
  const [row] = await db
    .select({ request: t.formRequests, applicant: t.applicants })
    .from(t.formRequests)
    .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
    .where(eq(t.formRequests.id, requestId))
    .limit(1);
  if (!row || row.request.status !== "completed" || row.applicant.erasedAt) return;

  const site = await getSetting("site");
  const def = row.request.definition;
  const hasCvField = def.fields.some((f) => f.type === "cv_upload");
  const msg = formResponseCopyEmail(site, {
    applicantName: row.applicant.fullName,
    formTitle: def.title,
    rows: answerRows(def, row.request.answers).map((r) => ({ question: r.field.label, answer: r.text })),
    cvNote: hasCvField ? (row.request.cvDocumentId ? "New CV uploaded with this form" : "Using the CV we already have") : null,
  });
  await sendEmail(
    { to: [row.applicant.email], ...msg, replyTo: site.contactEmail || undefined },
    { template: "applicant.form_response_copy", applicationId: row.request.applicationId ?? undefined, recipientApplicantId: row.applicant.id },
  );
}

/* -------------------------------------------------------------------------- */
/* Staff review                                                               */
/* -------------------------------------------------------------------------- */

/** The only outcome that emails the applicant. Hold and Reject are recorded silently. */
export const OFFER_DECISION = "Offer";

export async function recordFormDecision(
  requestId: string,
  input: { decision: string; note: string; sendOffer: boolean; offerMessage: string },
  userId: string,
): Promise<{ error: string } | { ok: true; offerEmailed: boolean | null }> {
  const req = await db.query.formRequests.findFirst({ where: eq(t.formRequests.id, requestId) });
  if (!req || req.status !== "completed") return { error: "Only completed forms can be reviewed." };
  if (!req.definition.reviewOptions.includes(input.decision)) return { error: "Choose one of the options." };
  await db
    .update(t.formRequests)
    .set({ decision: input.decision, decisionNote: input.note || null, decidedById: userId, decidedAt: new Date() })
    .where(eq(t.formRequests.id, requestId));
  // The note may contain personal remarks, so only the outcome is audited.
  await audit("form.decision", {
    actorUserId: userId,
    entityType: "form_request",
    entityId: requestId,
    metadata: { from: req.decision, to: input.decision },
  });

  if (input.decision !== OFFER_DECISION || !input.sendOffer) return { ok: true, offerEmailed: null };
  return { ok: true, offerEmailed: await sendOfferEmail(requestId, input.offerMessage, userId) };
}

async function sendOfferEmail(requestId: string, message: string, userId: string) {
  const [row] = await db
    .select({ request: t.formRequests, applicant: t.applicants, jobTitle: t.jobs.title, positionName: t.positions.name })
    .from(t.formRequests)
    .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
    .leftJoin(t.applications, eq(t.applications.id, t.formRequests.applicationId))
    .leftJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
    .leftJoin(t.positions, eq(t.positions.id, t.applications.positionId))
    .where(eq(t.formRequests.id, requestId))
    .limit(1);
  if (!row || row.applicant.erasedAt) return false;

  const site = await getSetting("site");
  const msg = offerEmail(site, { applicantName: row.applicant.fullName, jobTitle: row.positionName ?? row.jobTitle, message: message || null });
  const result = await sendEmail(
    { to: [row.applicant.email], ...msg, replyTo: site.contactEmail || undefined },
    { template: "applicant.offer", applicationId: row.request.applicationId ?? undefined, recipientApplicantId: row.applicant.id },
  );
  if (result.ok) await db.update(t.formRequests).set({ offerEmailedAt: new Date() }).where(eq(t.formRequests.id, requestId));
  // The message may include pay or personal terms, so it is never audited or stored.
  await audit("form.offer_email", { actorUserId: userId, entityType: "form_request", entityId: requestId, metadata: { emailed: result.ok } });
  return result.ok;
}
