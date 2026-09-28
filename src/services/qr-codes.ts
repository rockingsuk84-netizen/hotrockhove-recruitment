import "server-only";
import { randomBytes } from "node:crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { normaliseSource } from "@/lib/qr";

/** Unambiguous characters for printed/typed codes (no 0/O, 1/l/I). */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newQrCode(length = 8) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Site-relative paths only: must start with a single "/", no scheme or host,
 * and never the admin or API areas. This prevents a QR code (or a tampered
 * form) from redirecting people off-site.
 */
export const sitePathSchema = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?![/\\])[A-Za-z0-9\-._~/?=&%+]*$/, "Enter a path on this website, starting with /")
  .refine((p) => !/^\/(admin|api|q)(\/|\?|$)/.test(p), "Admin, API and QR links can't be used as a destination");

export const qrInputSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("job"),
    label: z.string().trim().min(2, "Give the QR code a name.").max(80),
    jobId: z.string().uuid("Choose a job."),
    source: z.string().max(40).transform((v) => normaliseSource(v) || null),
  }),
  z.object({
    targetType: z.literal("page"),
    label: z.string().trim().min(2, "Give the QR code a name.").max(80),
    path: sitePathSchema,
    source: z.string().max(40).transform((v) => normaliseSource(v) || null),
  }),
]);
export type QrInput = z.infer<typeof qrInputSchema>;

function toRow(input: QrInput) {
  return input.targetType === "job"
    ? { label: input.label, targetType: "job" as const, jobId: input.jobId, path: null, source: input.source }
    : { label: input.label, targetType: "page" as const, jobId: null, path: input.path, source: input.source };
}

export async function createQrCode(input: QrInput, userId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newQrCode();
    const [row] = await db
      .insert(t.qrCodes)
      .values({ ...toRow(input), code, createdById: userId })
      .onConflictDoNothing({ target: t.qrCodes.code })
      .returning();
    if (row) return row;
  }
  throw new Error("Could not allocate a unique QR code");
}

/** Re-pointing keeps the same code, so already-printed QR codes follow the new target. */
export async function updateQrCode(id: string, input: QrInput) {
  const [row] = await db.update(t.qrCodes).set(toRow(input)).where(eq(t.qrCodes.id, id)).returning();
  return row;
}

export async function listQrCodes() {
  return db
    .select({ qr: t.qrCodes, jobTitle: t.jobs.title, jobSlug: t.jobs.slug, jobStatus: t.jobs.status })
    .from(t.qrCodes)
    .leftJoin(t.jobs, eq(t.jobs.id, t.qrCodes.jobId))
    .orderBy(desc(t.qrCodes.active), desc(t.qrCodes.createdAt));
}

export async function getQrCode(id: string) {
  const [row] = await db
    .select({ qr: t.qrCodes, jobTitle: t.jobs.title, jobSlug: t.jobs.slug, jobStatus: t.jobs.status })
    .from(t.qrCodes)
    .leftJoin(t.jobs, eq(t.jobs.id, t.qrCodes.jobId))
    .where(eq(t.qrCodes.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Where a scan should land. Closed or unpublished jobs fall back to the jobs
 * list and inactive codes to the homepage, so a printed code never dead-ends.
 */
export function resolveTarget(row: { qr: typeof t.qrCodes.$inferSelect; jobSlug: string | null; jobStatus: string | null }) {
  let path = "/";
  if (row.qr.active) {
    if (row.qr.targetType === "job") path = row.jobSlug && row.jobStatus === "published" ? `/jobs/${row.jobSlug}` : "/jobs";
    else path = row.qr.path ?? "/";
  }
  if (!row.qr.active || !row.qr.source) return path;
  return `${path}${path.includes("?") ? "&" : "?"}source=${encodeURIComponent(row.qr.source)}`;
}

/** Count a scan and return the redirect target. */
export async function recordScan(code: string) {
  const [updated] = await db
    .update(t.qrCodes)
    .set({ scanCount: sql`${t.qrCodes.scanCount} + 1`, lastScannedAt: new Date() })
    .where(eq(t.qrCodes.code, code))
    .returning({ id: t.qrCodes.id });
  if (!updated) return null;
  const row = await getQrCode(updated.id);
  return row ? resolveTarget(row) : null;
}

/** Destinations offered in the admin dropdown; any other site path can be typed in. */
export async function pageTargetOptions() {
  const depts = await db
    .select({ name: t.departments.name, slug: t.departments.slug })
    .from(t.departments)
    .where(eq(t.departments.active, true))
    .orderBy(asc(t.departments.sortOrder));
  return [
    { path: "/", label: "Homepage" },
    { path: "/jobs", label: "All jobs" },
    ...depts.filter((d) => d.slug).map((d) => ({ path: `/jobs?department=${d.slug}`, label: `${d.name} jobs` })),
    { path: "/about", label: "About" },
    { path: "/contact", label: "Contact" },
  ];
}
