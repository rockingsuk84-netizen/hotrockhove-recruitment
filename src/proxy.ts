import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp } from "@/lib/csp";

/**
 * Runs before every page render:
 *  1. Generates a per-request nonce and applies the CSP (report-only when
 *     CSP_REPORT_ONLY=true, for troubleshooting before enforcement).
 *  2. Optimistically redirects signed-out visitors away from /admin. This is a
 *     UX shortcut only — every admin page, action and route re-checks the
 *     session server-side.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicAdminPaths = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
  if (pathname.startsWith("/admin") && !publicAdminPaths.includes(pathname) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, { isDev: process.env.NODE_ENV === "development" });
  const reportOnly = process.env.CSP_REPORT_ONLY === "true";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from this request header and applies it to its own scripts.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
