import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { getStaffUser } from "@/lib/session";
import { jobPublicUrl, normaliseSource, qrPng, qrSvg } from "@/lib/qr";

export const runtime = "nodejs";

/** Download a job's QR code as PNG or SVG. Staff only. */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/jobs/[id]/qr">) {
  if (!(await getStaffUser())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await db.query.jobs.findFirst({ where: eq(t.jobs.id, id), columns: { slug: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const params = new URL(request.url).searchParams;
  const source = normaliseSource(params.get("source"));
  const format = params.get("format") === "svg" ? "svg" : "png";
  const url = jobPublicUrl(job.slug, source);
  const filename = `qr-${job.slug}${source ? `-${source}` : ""}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };

  if (format === "svg") {
    return new NextResponse(await qrSvg(url), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  return new NextResponse(new Uint8Array(await qrPng(url)), { headers: { ...headers, "Content-Type": "image/png" } });
}
