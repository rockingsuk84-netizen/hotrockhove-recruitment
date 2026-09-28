import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { getStaffUser } from "@/lib/session";
import { getStorageFor } from "@/lib/storage";
import { contentDisposition } from "@/lib/files";

export const runtime = "nodejs";

/**
 * Authorised document access. Staff only; every download is audited. The
 * browser receives either the bytes or a signed URL valid for 60 seconds.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/admin/documents/[id]">) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await db.query.documents.findFirst({ where: and(eq(t.documents.id, id), isNull(t.documents.deletedAt)) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let result;
  try {
    const storage = await getStorageFor(doc.storageProvider);
    result = await storage.download(doc.storageKey, { filename: doc.originalFilename, contentType: doc.mimeType });
  } catch (err) {
    console.error("[documents] download failed:", (err as Error).message);
    return NextResponse.json({ error: "The file could not be retrieved from storage." }, { status: 502 });
  }

  await audit("document.download", {
    actorUserId: user.id,
    entityType: "document",
    entityId: doc.id,
    metadata: { applicationId: doc.applicationId, provider: doc.storageProvider },
  });

  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (result.kind === "redirect") {
    return NextResponse.redirect(result.url, { status: 303, headers });
  }
  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      ...headers,
      "Content-Type": result.contentType,
      "Content-Disposition": contentDisposition(doc.originalFilename),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
