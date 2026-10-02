import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, t } from "@/db";
import { audit } from "./audit";

/**
 * Admin authentication (Better Auth, email + password, database sessions).
 * Public sign-up is disabled: staff accounts are created by an owner/admin or
 * the `npm run admin:create` script. The same user table can later hold
 * applicant accounts (role = "applicant") linked from `applicants.user_id`.
 */
export const auth = betterAuth({
  appName: "Recruitment",
  baseURL: process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: t.users, session: t.sessions, account: t.accounts, verification: t.verifications },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    // Invite/reset links are created by services/staff-passwords.ts; this only
    // governs Better Auth's own reset endpoint. Resetting signs out everywhere.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await audit("auth.password_reset", { actorUserId: user.id, entityType: "user", entityId: user.id });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "recruiter" },
      active: { type: "boolean", input: false, defaultValue: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60,
  },
  rateLimit: { enabled: true, window: 60, max: 20 },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { generateId: () => crypto.randomUUID() },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, session.userId) });
          // Deactivated staff and (future) applicant accounts cannot open admin sessions here.
          if (!user || !user.active || user.role === "applicant") return false;
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
