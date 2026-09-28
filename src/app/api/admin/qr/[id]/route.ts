import { NextResponse } from "next/server";
import { z } from "zod";
import { qrPng, qrShortUrl, qrSvg } from "@/lib/qr";
import { getStaffUser } from "@/lib/session";
import { slugify } from "@/lib/validation";
import { getQrCode } from "@/services/qr-codes";

export const runtime = "nodejs";

/** Download a QR code as PNG (print-ready, 1024px) or SVG (scalable). Staff only. */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/qr/[id]">) {
  if (!(await getStaffUser())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await getQrCode(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") === "svg" ? "svg" : "png";
  const url = qrShortUrl(row.qr.code);
  const filename = `qr-${slugify(row.qr.label) || row.qr.code}.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" };

  if (format === "svg") {
    return new NextResponse(await qrSvg(url), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  return new NextResponse(new Uint8Array(await qrPng(url)), { headers: { ...headers, "Content-Type": "image/png" } });
}
