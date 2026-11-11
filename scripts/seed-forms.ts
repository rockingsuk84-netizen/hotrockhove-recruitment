/**
 * Adds the built-in applicant forms only (currently the availability form).
 * Safe for production: it writes nothing else. Use this instead of the full
 * seed on a live database.
 *
 * By default an existing form is left alone. With --update, the built-in
 * form's questions are replaced by the version in src/lib/forms/templates.ts.
 * Forms already sent to applicants are unaffected (each request keeps a copy
 * of the questions it was sent with).
 */
import { eq } from "drizzle-orm";
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
  if (form) {
    console.log("Forms: availability form created.");
  } else if (process.argv.includes("--update")) {
    await db
      .update(t.forms)
      .set({ title: AVAILABILITY_FORM.title, definition: AVAILABILITY_FORM })
      .where(eq(t.forms.id, AVAILABILITY_FORM_ID));
    console.log("Forms: availability form updated to the latest questions.");
  } else {
    console.log("Forms: availability form already present (run with --update to replace its questions).");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
