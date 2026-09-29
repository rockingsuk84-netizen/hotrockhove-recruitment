import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { getStaffUser } from "@/lib/session";
import { readStoredFile } from "@/lib/storage";
import { sha256 } from "@/lib/crypto";
import { contentDisposition } from "@/lib/files";

export const runtime = "nodejs";

/**
 * Authorised document access. Staff only; every download is audited. The file
 * is fetched from storage on the server and streamed with its original name,
 * after checking it against the SHA-256 recorded at upload.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/admin/documents/[id]">) {
  const user = await getStaffUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await db.query.documents.findFirst({ where: and(eq(t.documents.id, id), isNull(t.documents.deletedAt)) });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Buffer;
  try {
    body = await readStoredFile(doc.storageProvider, doc.storageKey, { filename: doc.originalFilename, contentType: doc.mimeType });
  } catch (err) {
    console.error("[documents] download failed:", (err as Error).message);
    return NextResponse.json({ error: "The file could not be retrieved from storage." }, { status: 502 });
  }
  // Integrity check against the hash recorded at upload.
  if (sha256(body) !== doc.sha256) {
    console.error(`[documents] checksum mismatch for document ${doc.id}`);
    return NextResponse.json({ error: "The stored file failed an integrity check." }, { status: 502 });
  }

  await audit("document.download", {
    actorUserId: user.id,
    entityType: "document",
    entityId: doc.id,
    metadata: { applicationId: doc.applicationId, provider: doc.storageProvider },
  });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": doc.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": contentDisposition(doc.originalFilename),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
