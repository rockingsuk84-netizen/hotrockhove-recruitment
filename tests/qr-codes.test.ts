import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newQrCode, qrInputSchema, resolveTarget, sitePathSchema } from "../src/services/qr-codes";

describe("QR code destinations", () => {
  it("only allows paths on this site", () => {
    for (const ok of ["/", "/jobs", "/jobs?department=front-of-house", "/jobs/bartender-hove", "/about"]) {
      assert.ok(sitePathSchema.safeParse(ok).success, ok);
    }
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "jobs", "/admin", "/admin/jobs", "/api/applications", "/q/abc", "javascript:alert(1)"]) {
      assert.equal(sitePathSchema.safeParse(bad).success, false, bad);
    }
  });

  it("normalises the source tag", () => {
    const parsed = qrInputSchema.parse({ targetType: "page", label: "Instagram bio", path: "/", source: " Instagram Bio! " });
    assert.equal(parsed.source, "instagram-bio");
  });

  const base = { id: "x", code: "abc12345", label: "t", jobId: null, path: null, source: "poster", active: true, scanCount: 0, lastScannedAt: null, createdById: null, createdAt: new Date(), updatedAt: new Date() };

  it("sends job codes to the live job, or the jobs list when it is not published", () => {
    const qr = { ...base, targetType: "job" as const, jobId: "j" };
    assert.equal(resolveTarget({ qr, jobSlug: "bartender-hove", jobStatus: "published" }), "/jobs/bartender-hove?source=poster");
    assert.equal(resolveTarget({ qr, jobSlug: "bartender-hove", jobStatus: "closed" }), "/jobs?source=poster");
    assert.equal(resolveTarget({ qr, jobSlug: null, jobStatus: null }), "/jobs?source=poster");
  });

  it("appends the source to page paths and sends inactive codes home", () => {
    const qr = { ...base, targetType: "page" as const, path: "/jobs?department=back-of-house" };
    assert.equal(resolveTarget({ qr, jobSlug: null, jobStatus: null }), "/jobs?department=back-of-house&source=poster");
    assert.equal(resolveTarget({ qr: { ...qr, active: false }, jobSlug: null, jobStatus: null }), "/");
  });

  it("generates short unambiguous codes", () => {
    const code = newQrCode();
    assert.match(code, /^[a-km-zA-HJ-NP-Z2-9]{8}$/);
  });
});
