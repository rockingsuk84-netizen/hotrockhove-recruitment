# Recruitment Platform (UK)

A lean, production-ready recruitment MVP. Employers publish jobs and manage applications. Applicants apply from their phone, often after scanning a QR code, upload a CV and get a confirmation email. The data model already makes room for applicant accounts, certificates, employment records, shifts and salary records.

**Stack:** Next.js 16 (App Router, TypeScript) · PostgreSQL/Neon via Drizzle ORM · Better Auth · Cloudinary **or** Amazon S3, switchable in the admin · Resend · Cloudflare Turnstile · Vercel.

---

## Quick start (local)

```bash
npm install
cp .env.example .env.local          # then fill BETTER_AUTH_SECRET, SETTINGS_ENCRYPTION_KEY, CRON_SECRET
                                     # and set ALLOW_LOCAL_STORAGE=true
npm run db:migrate                   # create tables
npm run db:seed                      # lists + the initial Hove campaign (8 jobs) + homepage copy
ADMIN_PASSWORD='choose-a-long-password' npm run admin:create -- --email you@example.co.uk --name "Your Name"
npm run dev                          # http://localhost:3000  ·  admin at /admin
```

Without a `DATABASE_URL`, the app runs on **PGlite**, an embedded Postgres stored in `.data/`. It supports only one process, so stop the dev server before running scripts. Always stop it with **Ctrl+C**, because force-killing the process can corrupt the local database. If that happens, delete `.data/` and re-run migrate, seed and admin:create.

With no `RESEND_API_KEY`, emails are logged to the console and still recorded in the notification history. The Turnstile test keys in `.env.example` always pass.

| Script | Purpose |
|---|---|
| `npm run db:generate` | Create a new SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (Neon or PGlite) |
| `npm run db:seed` | Idempotent seed. It never overwrites admin edits |
| `npm run admin:create -- --email … --name … [--role owner\|admin\|recruiter]` | Create a staff account or reset its password |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm test` | All tests; `npm run test:seed` runs only the seed-data regression tests |

---

## Going live: what to provide

| Service | Where it goes |
|---|---|
| **Neon** | `DATABASE_URL` (pooled connection string). Run `npm run db:migrate` and `npm run db:seed` against it once. |
| **Resend** | `RESEND_API_KEY`, plus `EMAIL_FROM` on a domain verified in Resend. |
| **Cloudflare Turnstile** | Create a widget for the production domain. The site key goes in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret in `TURNSTILE_SECRET_KEY`. |
| **Cloudinary** or **S3** | Entered in **Admin → Configuration → File storage**, not in env vars. Secrets are encrypted at rest. Use **Test connection**, then save. |
| **Vercel** | Import the repo and set every variable from `.env.example` with production values. Set `APP_URL` to the real domain and keep `ALLOW_LOCAL_STORAGE=false`. |

After the first deploy:
1. Create the owner account by running `admin:create` locally with `DATABASE_URL` pointing at Neon.
2. Choose Cloudinary or S3 under Configuration → File storage.
3. Check Branding, Notifications (admin recipients) and **Privacy & uploads**. The Privacy Policy text and retention period are placeholders and must be approved by your organisation.

**S3:** keep *Block all public access* on. Give the IAM user only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` and `s3:ListBucket` on the bucket.

---

## Architecture

```
src/
  db/schema.ts          Domain model (users, applicants, jobs, applications, documents,
                        certificates, employment_records, shifts, salary_records,
                        notifications, audit_logs, settings, taxonomy tables)
  lib/storage/          Provider-agnostic adapter: cloudinary.ts, s3.ts, local.ts (dev)
  lib/email/            Transport (Resend / console) + reusable templates
  lib/settings.ts       Admin-managed configuration (validated, secrets encrypted)
  lib/csp.ts            The single Content Security Policy definition
  lib/turnstile.ts      Server-side Turnstile verification
  lib/rate-limit.ts     Postgres-backed fixed-window rate limiting
  lib/files.ts          CV validation by file signature
  services/             Business logic (applications, jobs, applicants/erasure)
  proxy.ts              Per-request CSP nonce + admin redirect
  app/(public)          Job list, job page, apply, success, privacy
  app/admin             Dashboard, jobs, applications, configuration, staff, audit log
  app/api               /applications, /admin/documents/:id, /admin/jobs/:id/qr,
                        /auth/*, /cron/retention
```

- **The applicant is a canonical person record.** Applications reference it, and returning applicants are matched on their normalised email. `applicants.user_id` is ready for future applicant logins (`users.role = 'applicant'`). Each application also keeps a snapshot of the contact details and the consent text that was shown.
- **Public design** (`src/components/site/`, `src/app/(public)/`) is a presentation layer over the data. The homepage hero, section text, "Why join us" benefits and About text live in **Configuration → Homepage**. Category cards are the **departments** (slug, tagline, image and icon under Configuration → Lists). Featured vacancies are jobs with **Feature on homepage** ticked, and each job can have its own card image. Design tokens are CSS variables in `src/app/globals.css`, and the brand colours come from Configuration → Branding.
- **Images** are bundled in `public/images/` (Unsplash License, see `public/images/CREDITS.md`) and optimised by `next/image`. Any image field also accepts an `https://` URL, for example a Cloudinary asset.
- **Seed campaigns are separate from the app.** The initial Hove campaign lives in `scripts/seed-data/hove/`: `brief.txt` is the authoritative source (from `Job_Description_Restaurant_Hove.docx`) and `content.ts` holds the jobs and homepage copy. Only `scripts/seed.ts` uses them, and it writes each record once, so admin edits are never overwritten. `tests/seed/hove.test.ts` is a regression test for that seed data only: it checks the eight roles, verbatim characteristics and benefits, and fact-only marketing summaries. It is not a rule for job content. Jobs and homepage text created in the admin are free-form, and `tests/job-content-configurable.test.ts` checks that.
- **Configuration-first.** Branding, recipients, email wording, upload limits, allowed file types, consent text, retention, storage provider, locations, departments, employment types, roles and per-job questions are all edited in the admin.
- **Future modules** (`certificates`, `employment_records`, `shifts`, `salary_records`) exist as tables only, with no UI. Money is stored in pence with a GBP default.
- **QR codes** are generated in-house with `qrcode`. Each code points to `APP_URL/jobs/{slug}?source={tag}`. The source is stored on the application, and visits are counted per code.
- **Dates:** stored in UTC and shown in Europe/London time with UK formats.

---

## Security controls

| Control | Where enforced |
|---|---|
| Turnstile verified server-side (missing, expired or reused tokens rejected) | App: `lib/turnstile.ts`, `api/applications` |
| Rate limits: 30 submissions/hour per IP; 3/hour per email + job (valid submissions only); 10 sign-ins per 15 min per IP | App: Postgres-backed, so it works across serverless instances |
| Honeypot field, idempotency key, 10-minute duplicate window | App |
| Content-Length check before parsing, multipart only, POST only (other methods get 405), CV size limit (≤ 4 MB, the Vercel body limit) | App |
| CV checked by file signature and extension; macro-enabled DOCX rejected; storage keys generated by the server | App: `lib/files.ts` |
| Private storage: Cloudinary `private` raw uploads, S3 SSE with public access blocked. Staff-only download route; every download audited; 60-second signed URLs | App |
| Admin pages, actions and API routes check the session on the server; roles are owner, admin and recruiter | App (`proxy.ts` only redirects early; it isn't the security boundary) |
| Server Actions reject cross-origin requests; Better Auth checks Origin | Framework |
| Storage secrets encrypted with AES-256-GCM and never sent to the browser | App |
| Audit log for admin and security events; IPs stored only as keyed hashes; no CV contents or secrets logged | App |
| CSP + security headers (see below) | App |
| **WAF, bot management, edge rate limiting, DDoS** | **Cloudflare**, configured in the dashboard (below) |

### Content Security Policy

This is defined once in `src/lib/csp.ts` and applied per request with a fresh nonce (`src/proxy.ts`). Only `https://challenges.cloudflare.com` is allowed as a third party, for the Turnstile script, frame and connections. The documented exceptions are:
- `style-src-attr 'unsafe-inline'` allows inline style **attributes** only, which Turnstile uses to size its container. `<style>` elements still need the nonce.
- `img-src https:` allows an admin-configured logo URL to load. You can restrict it to one host.
- `'unsafe-eval'` is added **in development only**.

Other headers: `frame-ancestors 'none'`/`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and HSTS in production. To troubleshoot, set `CSP_REPORT_ONLY=true` and then turn it off again. The policy was tested against the production build with the Turnstile flow and produced no CSP violations.

### Cloudflare (recommended rules)

Proxy the domain through Cloudflare (orange cloud) with SSL mode **Full (strict)**. Then add:
1. **Rate limiting rule:** `http.request.uri.path eq "/api/applications" and http.request.method eq "POST"`. Allow 20 requests per minute per IP, with a managed challenge or 10-minute block. This is looser than the app limit, so shared networks aren't blocked at the edge.
2. **Rate limiting rule:** path starts with `/admin/login` or `/api/auth/`. Allow 10 requests per minute per IP, then block for 10 minutes.
3. **Managed WAF ruleset** switched on. Optionally add a custom rule challenging `/admin*` from countries you never operate in.
4. **Do not** enable Rocket Loader or HTML minification. Both rewrite scripts and break the CSP nonces.

The app sees the real client IP through `cf-connecting-ip`.

---

## Data protection

These tools help you apply your own UK GDPR policies. They don't make the site compliant by themselves.
- Only the minimum data is collected (name, email, phone, role, answers, CV). Consent is recorded with a timestamp and the exact wording shown.
- **Erase applicant data** (owners and admins) deletes the stored files and anonymises the records.
- **Retention:** a daily job at `/api/cron/retention` (scheduled in `vercel.json`) erases applicants whose most recent application is older than the configured number of days. Applicants who were hired are kept.

---

## Before launch checklist

- [ ] Real Turnstile keys, and the widget's allowed hostnames set to the production domain
- [ ] `APP_URL` set to the production domain before printing QR codes
- [ ] Verified sending domain in Resend; confirmation and admin alert emails received
- [ ] Storage provider selected and **Test connection** passing (test both Cloudinary and S3 if you'll use both)
- [ ] Privacy Policy, consent text and retention period approved
- [ ] Cloudflare rules above enabled; full flow tested on the real domain: QR → job page → apply → Turnstile → storage → emails
