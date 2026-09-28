import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { Alert, Badge, Button, Card, JOB_STATUS_TONE, LinkButton, PageHeader } from "@/components/ui";
import { formatDateTime, JOB_STATUS_LABELS } from "@/lib/format";
import { jobPublicUrl, qrDataUrl } from "@/lib/qr";
import { requireStaff } from "@/lib/session";
import { getJobPositions, getTaxonomy } from "@/services/jobs";
import { changeJobStatus, deleteQrCode } from "../actions";
import { JobForm } from "../job-form";
import { QrCreateForm } from "./qr-create-form";

export const metadata = { title: "Edit job" };

export default async function EditJobPage({ params, searchParams }: PageProps<"/admin/jobs/[id]">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const job = await db.query.jobs.findFirst({ where: eq(t.jobs.id, id) });
  if (!job) notFound();

  const [taxonomy, positions, qrCodes] = await Promise.all([
    getTaxonomy(),
    getJobPositions(id),
    db.select().from(t.jobQrCodes).where(eq(t.jobQrCodes.jobId, id)).orderBy(asc(t.jobQrCodes.createdAt)),
  ]);
  const qrs = await Promise.all(
    qrCodes.map(async (q) => {
      const url = jobPublicUrl(job.slug, q.source);
      return { ...q, url, preview: await qrDataUrl(url) };
    }),
  );

  const statusButtons = (
    <>
      {job.status !== "published" && (
        <form action={changeJobStatus.bind(null, job.id, "published")}>
          <Button type="submit" variant="accent">
            Publish
          </Button>
        </form>
      )}
      {job.status === "published" && (
        <form action={changeJobStatus.bind(null, job.id, "draft")}>
          <Button type="submit" variant="secondary">
            Unpublish
          </Button>
        </form>
      )}
      {job.status !== "closed" && (
        <form action={changeJobStatus.bind(null, job.id, "closed")}>
          <Button type="submit" variant="secondary">
            Close job
          </Button>
        </form>
      )}
      {job.status === "published" && (
        <LinkButton href={`/jobs/${job.slug}`} target="_blank" variant="ghost">
          View public page ↗
        </LinkButton>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        title={job.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
            {job.publishedAt && <span>Published {formatDateTime(job.publishedAt)}</span>}
            {job.closedAt && job.status === "closed" && <span>· Closed {formatDateTime(job.closedAt)}</span>}
          </span>
        }
        actions={statusButtons}
      />
      {sp.saved && (
        <div className="mb-6">
          <Alert tone="success">Job saved.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <JobForm
          taxonomy={taxonomy}
          initial={{
            id: job.id,
            title: job.title,
            slug: job.slug,
            summary: job.summary,
            description: job.description,
            responsibilities: job.responsibilities,
            requirements: job.requirements,
            benefits: job.benefits,
            standoutPrompt: job.standoutPrompt,
            locationId: job.locationId,
            departmentId: job.departmentId,
            employmentTypeId: job.employmentTypeId,
            positionIds: positions.map((p) => p.id),
            questions: job.questions,
            featured: job.featured,
            imageUrl: job.imageUrl,
          }}
        />

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">QR codes</h2>
            <p className="mt-1 text-sm text-stone-600">
              Generated in-house. Each code opens this job&apos;s public page; the source records where applicants came from.
            </p>
            {job.status !== "published" && (
              <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Publish the job before printing QR codes — unpublished jobs show “not found”.</p>
            )}
            <ul className="mt-4 space-y-5">
              {qrs.map((q) => (
                <li key={q.id} className="border-t border-stone-100 pt-4 first:border-0 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-stone-900">{q.label}</p>
                      <p className="text-xs text-stone-500">{q.source ? `source=${q.source} · ${q.scanCount} visits` : "No source tag"}</p>
                    </div>
                    {q.source && (
                      <form action={deleteQrCode.bind(null, job.id, q.id)}>
                        <button type="submit" className="text-xs text-red-700 hover:underline">
                          Delete
                        </button>
                      </form>
                    )}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
                  <img src={q.preview} alt={`QR code for ${q.label}`} width={160} height={160} className="mt-3 rounded border border-stone-200" />
                  <p className="mt-2 break-all text-xs text-stone-600">{q.url}</p>
                  <div className="mt-2 flex gap-3 text-sm">
                    <a className="font-medium text-brand hover:underline" href={`/api/admin/jobs/${job.id}/qr?format=png&source=${encodeURIComponent(q.source)}`}>
                      Download PNG
                    </a>
                    <a className="font-medium text-brand hover:underline" href={`/api/admin/jobs/${job.id}/qr?format=svg&source=${encodeURIComponent(q.source)}`}>
                      Download SVG
                    </a>
                  </div>
                </li>
              ))}
            </ul>
            <QrCreateForm jobId={job.id} />
          </Card>
        </aside>
      </div>
    </>
  );
}
