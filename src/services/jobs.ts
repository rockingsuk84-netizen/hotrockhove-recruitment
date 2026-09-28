import "server-only";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { JobStatus } from "@/db/schema";
import { imageRefSchema } from "@/lib/settings";
import { slugify } from "@/lib/validation";

const lines = z
  .string()
  .max(10_000)
  .transform((v) =>
    v
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 50),
  );

const optionalUuid = z.union([z.literal(""), z.string().uuid()]).transform((v) => v || null);

export const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(3).max(300),
  helpText: z.string().trim().max(300).optional(),
  type: z.enum(["short_text", "long_text"]),
  required: z.boolean(),
  maxLength: z.number().int().min(20).max(3000),
});

export const jobInputSchema = z.object({
  title: z.string().trim().min(3, "Title is required.").max(150),
  slug: z
    .string()
    .trim()
    .max(80)
    .transform((v) => slugify(v)),
  summary: z.string().trim().max(400),
  description: z.string().trim().max(20_000),
  responsibilities: lines,
  requirements: lines,
  benefits: lines,
  standoutPrompt: z.string().trim().min(5, "The stand-out question is required.").max(300),
  locationId: optionalUuid,
  departmentId: optionalUuid,
  employmentTypeId: optionalUuid,
  positionIds: z.array(z.string().uuid()).max(50),
  featured: z.boolean(),
  imageUrl: z.union([z.literal(""), imageRefSchema]).transform((v) => v || null),
  questions: z.array(questionSchema).max(10),
});

export type JobInput = z.infer<typeof jobInputSchema>;

async function uniqueSlug(base: string, excludeId?: string) {
  const root = base || "job";
  let candidate = root;
  for (let i = 2; ; i++) {
    const clash = await db.query.jobs.findFirst({
      where: excludeId ? and(eq(t.jobs.slug, candidate), ne(t.jobs.id, excludeId)) : eq(t.jobs.slug, candidate),
      columns: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${root}-${i}`;
  }
}

export async function createJob(input: JobInput, userId: string) {
  const slug = await uniqueSlug(input.slug || slugify(input.title));
  return db.transaction(async (tx) => {
    const { positionIds, ...fields } = input;
    const [job] = await tx.insert(t.jobs).values({ ...fields, slug, createdById: userId }).returning();
    if (positionIds.length) {
      await tx.insert(t.jobPositions).values(positionIds.map((positionId, i) => ({ jobId: job.id, positionId, sortOrder: i })));
    }
    return job;
  });
}

export async function updateJob(id: string, input: JobInput) {
  const slug = await uniqueSlug(input.slug || slugify(input.title), id);
  return db.transaction(async (tx) => {
    const { positionIds, ...fields } = input;
    const [job] = await tx.update(t.jobs).set({ ...fields, slug }).where(eq(t.jobs.id, id)).returning();
    await tx.delete(t.jobPositions).where(eq(t.jobPositions.jobId, id));
    if (positionIds.length) {
      await tx.insert(t.jobPositions).values(positionIds.map((positionId, i) => ({ jobId: id, positionId, sortOrder: i })));
    }
    return job;
  });
}

export async function setJobStatus(id: string, status: JobStatus) {
  const now = new Date();
  const [job] = await db
    .update(t.jobs)
    .set({
      status,
      ...(status === "published" ? { publishedAt: now, closedAt: null } : {}),
      ...(status === "closed" ? { closedAt: now } : {}),
    })
    .where(eq(t.jobs.id, id))
    .returning();
  return job;
}

export async function getJobPositions(jobId: string) {
  return db
    .select({ id: t.positions.id, name: t.positions.name })
    .from(t.jobPositions)
    .innerJoin(t.positions, eq(t.positions.id, t.jobPositions.positionId))
    .where(eq(t.jobPositions.jobId, jobId))
    .orderBy(asc(t.jobPositions.sortOrder));
}

const FALLBACK_IMAGE = "/images/hero.jpg";

/** Public job with resolved taxonomy labels. */
export async function getPublishedJobBySlug(slug: string) {
  const [row] = await db
    .select({
      job: t.jobs,
      location: t.locations.name,
      department: t.departments.name,
      departmentSlug: t.departments.slug,
      departmentImage: t.departments.imageUrl,
      employmentType: t.employmentTypes.name,
    })
    .from(t.jobs)
    .leftJoin(t.locations, eq(t.locations.id, t.jobs.locationId))
    .leftJoin(t.departments, eq(t.departments.id, t.jobs.departmentId))
    .leftJoin(t.employmentTypes, eq(t.employmentTypes.id, t.jobs.employmentTypeId))
    .where(and(eq(t.jobs.slug, slug), eq(t.jobs.status, "published")))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    image: row.job.imageUrl || row.departmentImage || FALLBACK_IMAGE,
    positions: await getJobPositions(row.job.id),
  };
}

/**
 * Published jobs as card data (presentation layer over the jobs table).
 * Featured jobs sort first; `departmentSlug` filters by category.
 */
export async function listPublishedJobs(opts: { departmentSlug?: string; featuredOnly?: boolean; limit?: number } = {}) {
  const where = [eq(t.jobs.status, "published")];
  if (opts.departmentSlug) where.push(eq(t.departments.slug, opts.departmentSlug));
  if (opts.featuredOnly) where.push(eq(t.jobs.featured, true));
  const rows = await db
    .select({
      id: t.jobs.id,
      slug: t.jobs.slug,
      title: t.jobs.title,
      summary: t.jobs.summary,
      featured: t.jobs.featured,
      imageUrl: t.jobs.imageUrl,
      publishedAt: t.jobs.publishedAt,
      location: t.locations.name,
      department: t.departments.name,
      departmentImage: t.departments.imageUrl,
      employmentType: t.employmentTypes.name,
    })
    .from(t.jobs)
    .leftJoin(t.locations, eq(t.locations.id, t.jobs.locationId))
    .leftJoin(t.departments, eq(t.departments.id, t.jobs.departmentId))
    .leftJoin(t.employmentTypes, eq(t.employmentTypes.id, t.jobs.employmentTypeId))
    .where(and(...where))
    .orderBy(desc(t.jobs.featured), asc(t.departments.sortOrder), desc(t.jobs.publishedAt))
    .limit(opts.limit ?? 100);
  return rows.map((r) => ({ ...r, image: r.imageUrl || r.departmentImage || FALLBACK_IMAGE }));
}

/** Homepage featured vacancies: admin-flagged jobs, falling back to the most recent. */
export async function listFeaturedJobs(limit = 3) {
  const featured = await listPublishedJobs({ featuredOnly: true, limit });
  if (featured.length >= limit) return featured;
  const extra = (await listPublishedJobs({ limit: limit * 2 })).filter((j) => !featured.some((f) => f.id === j.id));
  return [...featured, ...extra].slice(0, limit);
}

/** Active departments (job categories) that currently have published jobs. */
export async function listPublicDepartments() {
  return db
    .select({
      id: t.departments.id,
      slug: t.departments.slug,
      name: t.departments.name,
      tagline: t.departments.tagline,
      imageUrl: t.departments.imageUrl,
      icon: t.departments.icon,
      jobs: count(t.jobs.id),
    })
    .from(t.departments)
    .innerJoin(t.jobs, and(eq(t.jobs.departmentId, t.departments.id), eq(t.jobs.status, "published")))
    .where(eq(t.departments.active, true))
    .groupBy(t.departments.id)
    .orderBy(asc(t.departments.sortOrder), asc(t.departments.name));
}

export async function listAllJobs() {
  const jobs = await db
    .select({
      id: t.jobs.id,
      slug: t.jobs.slug,
      title: t.jobs.title,
      status: t.jobs.status,
      featured: t.jobs.featured,
      updatedAt: t.jobs.updatedAt,
      publishedAt: t.jobs.publishedAt,
      location: t.locations.name,
    })
    .from(t.jobs)
    .leftJoin(t.locations, eq(t.locations.id, t.jobs.locationId))
    .orderBy(desc(t.jobs.updatedAt));
  const counts = jobs.length
    ? await db
        .select({ jobId: t.applications.jobId, n: count() })
        .from(t.applications)
        .where(inArray(t.applications.jobId, jobs.map((j) => j.id)))
        .groupBy(t.applications.jobId)
    : [];
  const byJob = new Map(counts.map((c) => [c.jobId, c.n]));
  return jobs.map((j) => ({ ...j, applications: byJob.get(j.id) ?? 0 }));
}

export async function getTaxonomy() {
  const [locations, departments, employmentTypes, positions] = await Promise.all([
    db.select().from(t.locations).orderBy(asc(t.locations.sortOrder), asc(t.locations.name)),
    db.select().from(t.departments).orderBy(asc(t.departments.sortOrder), asc(t.departments.name)),
    db.select().from(t.employmentTypes).orderBy(asc(t.employmentTypes.sortOrder), asc(t.employmentTypes.name)),
    db.select().from(t.positions).orderBy(asc(t.positions.sortOrder), asc(t.positions.name)),
  ]);
  return { locations, departments, employmentTypes, positions };
}

export const DEFAULT_STANDOUT_LABEL =
  "What single quality makes you stand out in a high-pressure environment?";
