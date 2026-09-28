/**
 * Create (or reset the password of) a staff account.
 *
 *   npm run admin:create -- --email you@example.co.uk --name "Your Name" [--role owner]
 *
 * The password is read from ADMIN_PASSWORD, or generated and printed once.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { createDb } from "../src/db/client";
import * as t from "../src/db/schema";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Administrator";
  const role = (arg("role") ?? "owner") as "owner" | "admin" | "recruiter";
  if (!email || !email.includes("@")) throw new Error("Pass --email you@example.co.uk");
  if (!["owner", "admin", "recruiter"].includes(role)) throw new Error("--role must be owner, admin or recruiter");

  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

  const db = createDb(process.env.DATABASE_URL);
  const hash = await hashPassword(password);

  let user = await db.query.users.findFirst({ where: eq(t.users.email, email) });
  if (!user) {
    [user] = await db.insert(t.users).values({ id: randomUUID(), email, name, role, emailVerified: true }).returning();
  } else {
    await db.update(t.users).set({ name, role, active: true }).where(eq(t.users.id, user.id));
  }

  const account = await db.query.accounts.findFirst({
    where: and(eq(t.accounts.userId, user.id), eq(t.accounts.providerId, "credential")),
  });
  if (account) {
    await db.update(t.accounts).set({ password: hash }).where(eq(t.accounts.id, account.id));
  } else {
    await db.insert(t.accounts).values({ id: randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: hash });
  }

  console.log(`Staff account ready: ${email} (${role})`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Generated password (shown once): ${password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
