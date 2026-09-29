/**
 * Idempotent seed: configurable taxonomy, initial settings and the Hove
 * restaurant vacancies from the supplied brief (Job_Description_Restaurant_Hove.docx),
 * one job per role. Campaign content lives in ./seed-data/hove/ and is checked
 * against the brief by tests/seed/hove.test.ts. Everything is edited from the
 * admin afterwards; existing rows and settings are never overwritten.
 */
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import * as t from "../src/db/schema";
import { BENEFITS, DEPARTMENTS, DESCRIPTION, HOMEPAGE, QUALITIES, ROLES, STANDOUT_PROMPT, type Dept } from "./seed-data/hove/content";

const db = createDb(process.env.DATABASE_URL);

async function main() {
  const deptDefs = (["foh", "boh"] as const).map((key) => ({ key, ...DEPARTMENTS[key] }));
  const dept: Record<Dept, string> = { foh: "", boh: "" };
  for (const [i, d] of deptDefs.entries()) {
    const existing = await db.query.departments.findFirst({ where: eq(t.departments.name, d.name) });
    if (existing) {
      // Fill presentation fields only where empty, so admin edits survive.
      await db
        .update(t.departments)
        .set({
          slug: existing.slug ?? d.slug,
          tagline: existing.tagline || d.tagline,
          imageUrl: existing.imageUrl ?? d.imageUrl,
          icon: existing.icon ?? d.icon,
        })
        .where(eq(t.departments.id, existing.id));
      dept[d.key] = existing.id;
    } else {
      const [row] = await db
        .insert(t.departments)
        .values({ name: d.name, slug: d.slug, tagline: d.tagline, imageUrl: d.imageUrl, icon: d.icon, sortOrder: i })
        .returning({ id: t.departments.id });
      dept[d.key] = row.id;
    }
  }

  // Selectable options for admins; not assigned to the seeded jobs.
  for (const [i, name] of ["Full-time", "Part-time", "Full-time / Part-time", "Casual"].entries()) {
    await db
      .insert(t.employmentTypes)
      .values({ name, sortOrder: i })
      .onConflictDoUpdate({ target: t.employmentTypes.name, set: { sortOrder: i } });
  }

  const [hove] = await db
    .insert(t.locations)
    .values({ name: "Hove, UK", town: "Hove", sortOrder: 0 })
    .onConflictDoUpdate({ target: t.locations.name, set: { town: "Hove" } })
    .returning({ id: t.locations.id });

  // Roles also exist as positions so future modules (shifts, employment records) can reference them.
  for (const [i, role] of ROLES.entries()) {
    await db
      .insert(t.positions)
      .values({ name: role.title, departmentId: dept[role.dept], sortOrder: i })
      .onConflictDoNothing();
  }

  let created = 0;
  for (const [index, role] of ROLES.entries()) {
    const exists = await db.query.jobs.findFirst({ where: eq(t.jobs.slug, role.slug), columns: { id: true } });
    if (exists) continue;
    const [job] = await db
      .insert(t.jobs)
      .values({
        slug: role.slug,
        title: role.title,
        summary: role.summary,
        description: DESCRIPTION.join("\n\n"),
        // The brief lists no role-specific responsibilities.
        responsibilities: [],
        requirements: [...QUALITIES[role.dept], ...QUALITIES.universal],
        benefits: BENEFITS,
        standoutPrompt: STANDOUT_PROMPT,
        questions: [],
        locationId: hove.id,
        departmentId: dept[role.dept],
        // The brief does not state hours, so no employment type is set.
        employmentTypeId: null,
        featured: role.featured,
        imageUrl: role.image,
        status: "published",
        // Staggered so listings follow the source order (earlier roles show first).
        publishedAt: new Date(Date.now() - index * 60_000),
      })
      .returning({ id: t.jobs.id });
    // Each job is a single role; linking it records the role on every application.
    const position = await db.query.positions.findFirst({ where: eq(t.positions.name, role.title), columns: { id: true } });
    if (position) await db.insert(t.jobPositions).values({ jobId: job.id, positionId: position.id }).onConflictDoNothing();
    created++;
  }
  console.log(`Jobs: ${created} created, ${ROLES.length - created} already present.`);

  // Initial settings (only written if absent, so admin edits are never overwritten).
  const initial: Record<string, unknown> = {
    notifications: { adminRecipients: ["admin@rockingservicesuk.com"] },
    homepage: HOMEPAGE,
    ...(process.env.ALLOW_LOCAL_STORAGE === "true" ? { storage: { provider: "local" } } : {}),
  };
  for (const [key, value] of Object.entries(initial)) {
    await db.insert(t.settings).values({ key, value }).onConflictDoNothing();
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
