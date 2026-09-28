import Link from "next/link";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { qrDataUrl, qrShortUrl, siteUrl } from "@/lib/qr";
import { requireStaff } from "@/lib/session";
import { listQrCodes, pageTargetOptions, resolveTarget } from "@/services/qr-codes";
import { QrForm } from "./qr-form";

export const metadata = { title: "QR codes" };

export default async function QrCodesPage({ searchParams }: PageProps<"/admin/qr-codes">) {
  await requireStaff();
  const sp = await searchParams;
  const presetJob = typeof sp.job === "string" && z.string().uuid().safeParse(sp.job).success ? sp.job : "";

  const [rows, jobs, pages] = await Promise.all([
    listQrCodes(),
    db.select({ id: t.jobs.id, title: t.jobs.title, status: t.jobs.status }).from(t.jobs).orderBy(asc(t.jobs.title)),
    pageTargetOptions(),
  ]);
  const codes = await Promise.all(
    rows.map(async (row) => ({ ...row, shortUrl: qrShortUrl(row.qr.code), preview: await qrDataUrl(qrShortUrl(row.qr.code)), target: resolveTarget(row) })),
  );

  return (
    <>
      <PageHeader
        title="QR codes"
        description="Create QR codes for any job or page on the website. Each code is a short link, so you can change where it goes after printing."
      />
      {sp.saved && (
        <div className="mb-6">
          <Alert tone="success">QR code saved.</Alert>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-semibold text-stone-900">New QR code</h2>
          <QrForm
            submitLabel="Create QR code"
            jobs={jobs}
            pages={pages}
            initial={{ label: "", targetType: presetJob ? "job" : "page", jobId: presetJob, path: "/", source: "poster" }}
          />
        </Card>

        <section aria-label="Your QR codes">
          {codes.length === 0 ? (
            <Card className="p-10 text-center text-sm text-stone-600">No QR codes yet. Create your first one on the left.</Card>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {codes.map(({ qr, jobTitle, jobStatus, shortUrl, preview, target }) => (
                <li key={qr.id}>
                  <Card className={`flex h-full gap-4 p-4 ${qr.active ? "" : "opacity-60"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
                    <img src={preview} alt={`QR code: ${qr.label}`} width={112} height={112} className="h-28 w-28 shrink-0 rounded border border-stone-200" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-stone-900">{qr.label}</h3>
                        {!qr.active && <Badge tone="red">Inactive</Badge>}
                        {qr.targetType === "job" && jobStatus && jobStatus !== "published" && <Badge tone="amber">Job {jobStatus}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-stone-600">
                        → {qr.targetType === "job" ? `Job: ${jobTitle ?? "deleted job"}` : `Page: ${qr.path}`}
                        {qr.source && <span className="text-stone-500"> · source: {qr.source}</span>}
                      </p>
                      <p className="mt-1 truncate text-xs text-stone-500" title={shortUrl}>
                        {shortUrl}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {qr.scanCount} scan{qr.scanCount === 1 ? "" : "s"}
                        {qr.lastScannedAt ? ` · last ${formatDateTime(qr.lastScannedAt)}` : ""} ·{" "}
                        <a href={siteUrl(target)} target="_blank" rel="noopener" className="hover:underline">
                          opens {target}
                        </a>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
                        <a className="text-brand hover:underline" href={`/api/admin/qr/${qr.id}?format=png`}>
                          PNG
                        </a>
                        <a className="text-brand hover:underline" href={`/api/admin/qr/${qr.id}?format=svg`}>
                          SVG
                        </a>
                        <Link className="text-brand hover:underline" href={`/admin/qr-codes/${qr.id}`}>
                          Edit
                        </Link>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
