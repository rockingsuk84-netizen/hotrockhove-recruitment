import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { eraseApplicant, findApplicantsPastRetention } from "@/services/applicants";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily housekeeping (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 * erase applicants past the configured retention period, expire sessions and
 * clear old rate-limit counters.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const privacy = await getSetting("privacy");
  let erased = 0;
  if (privacy.retentionDays) {
    const due = await findApplicantsPastRetention(privacy.retentionDays);
    for (const { id } of due) {
      const r = await eraseApplicant(id);
      await audit("applicant.erase", { entityType: "applicant", entityId: id, metadata: { reason: "retention", fileErrors: r.fileErrors } });
      erased++;
    }
  }
  await purgeExpiredRateLimits();
  await db.delete(t.sessions).where(lt(t.sessions.expiresAt, new Date()));
  if (erased) await audit("retention.purge", { metadata: { erased, retentionDays: privacy.retentionDays } });

  return NextResponse.json({ ok: true, erased });
}
