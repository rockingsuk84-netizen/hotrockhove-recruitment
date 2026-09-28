import { NextResponse } from "next/server";
import { recordScan } from "@/services/qr-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Printed QR codes point here. Counts the scan and redirects (302, never
 * cached) to the code's current target on this site, so codes can be
 * re-pointed after printing. Unknown codes go to the homepage.
 */
export async function GET(request: Request, ctx: RouteContext<"/q/[code]">) {
  const { code } = await ctx.params;
  let target = "/";
  if (/^[A-Za-z0-9]{6,16}$/.test(code)) {
    try {
      target = (await recordScan(code)) ?? "/";
    } catch (err) {
      console.error("[qr] scan failed:", (err as Error).message);
    }
  }
  return NextResponse.redirect(new URL(target, request.url), {
    status: 302,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
