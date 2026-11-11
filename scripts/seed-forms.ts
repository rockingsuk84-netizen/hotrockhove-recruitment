/**
 * Adds the built-in applicant forms only (currently the availability form).
 * Safe for production: it writes nothing else and never overwrites a form
 * that already exists. Use this instead of the full seed on a live database.
 */
import { createDb } from "../src/db/client";
import * as t from "../src/db/schema";
import { AVAILABILITY_FORM, AVAILABILITY_FORM_ID } from "../src/lib/forms/templates";

const db = createDb(process.env.DATABASE_URL);

async function main() {
  const [form] = await db
    .insert(t.forms)
    .values({ id: AVAILABILITY_FORM_ID, title: AVAILABILITY_FORM.title, definition: AVAILABILITY_FORM })
    .onConflictDoNothing()
    .returning({ id: t.forms.id });
  console.log(`Forms: ${form ? "availability form created" : "availability form already present"}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
