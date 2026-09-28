import "server-only";
import { z } from "zod";

/**
 * Server environment. Only infrastructure values live here; business settings
 * (branding, recipients, storage provider, upload limits…) are admin-managed in
 * the `settings` table.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Postgres/Neon connection string. `pglite:<dir>` runs an embedded Postgres for local development. */
  DATABASE_URL: z.string().min(1).default("pglite:./.data/pglite"),
  /** Canonical public origin, e.g. https://jobs.example.co.uk — used for QR codes and email links. */
  APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  /** 32-byte key (base64 or hex) for encrypting admin-managed credentials at rest. */
  SETTINGS_ENCRYPTION_KEY: z.string().min(32),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Recruitment <onboarding@resend.dev>"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  /** Shared secret for scheduled jobs such as the retention purge. */
  CRON_SECRET: z.string().optional(),
  /** Allows the local-disk storage adapter (development/testing only; refused on Vercel). */
  ALLOW_LOCAL_STORAGE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  // Serverless filesystems are ephemeral: uploads written locally would be lost.
  if (process.env.VERCEL && parsed.data.ALLOW_LOCAL_STORAGE) {
    throw new Error("ALLOW_LOCAL_STORAGE must not be enabled on Vercel");
  }
  cached = parsed.data;
  return cached;
}
