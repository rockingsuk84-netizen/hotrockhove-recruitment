import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { Alert, Badge, Button, Card, JOB_STATUS_TONE, LinkButton, PageHeader } from "@/components/ui";
import { formatDateTime, JOB_STATUS_LABELS } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { getJobPositions, getTaxonomy } from "@/services/jobs";
import { changeJobStatus } from "../actions";
import { JobForm } from "../job-form";

export const metadata = { title: "Edit job" };

export default async function EditJobPage({ params, searchParams }: PageProps<"/admin/jobs/[id]">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const job = await db.query.jobs.findFirst({ where: eq(t.jobs.id, id) });
  if (!job) notFound();

  const [taxonomy, positions, [{ n: applicationCount }], [{ n: qrCount }]] = await Promise.all([
    getTaxonomy(),
    getJobPositions(id),
    db.select({ n: count() }).from(t.applications).where(eq(t.applications.jobId, id)),
    db.select({ n: count() }).from(t.qrCodes).where(eq(t.qrCodes.jobId, id)),
  ]);

  return (
    <>
      <Link href="/admin/jobs" className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← All jobs
      </Link>
      <div className="mt-3">
        <PageHeader
          title={job.title}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
              {job.featured && <Badge tone="amber">Featured on homepage</Badge>}
              {job.publishedAt && <span>Published {formatDateTime(job.publishedAt)}</span>}
            </span>
          }
        />
      </div>
      {sp.saved && (
        <div className="mb-6">
          <Alert tone="success">Job saved.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Edit job details</h2>
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
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold text-stone-900">Publishing</h2>
            <p className="text-sm text-stone-600">
              {job.status === "published"
                ? "Live on the website and accepting applications."
                : job.status === "draft"
                  ? "Draft: not visible on the website."
                  : "Closed: hidden from the website and not accepting applications."}
            </p>
            {job.status !== "published" && (
              <form action={changeJobStatus.bind(null, job.id, "published")}>
                <Button type="submit" variant="accent" className="w-full">
                  Publish
                </Button>
              </form>
            )}
            {job.status === "published" && (
              <form action={changeJobStatus.bind(null, job.id, "draft")}>
                <Button type="submit" variant="secondary" className="w-full">
                  Unpublish
                </Button>
              </form>
            )}
            {job.status !== "closed" && (
              <form action={changeJobStatus.bind(null, job.id, "closed")}>
                <Button type="submit" variant="secondary" className="w-full">
                  Close job
                </Button>
              </form>
            )}
            {job.status === "published" && (
              <LinkButton href={`/jobs/${job.slug}`} target="_blank" variant="ghost" className="w-full">
                View live page ↗
              </LinkButton>
            )}
          </Card>

          <Card className="space-y-2 p-5 text-sm">
            <h2 className="font-semibold text-stone-900">Related</h2>
            <Link href={`/admin/applications?job=${job.id}&status=all`} className="block text-brand hover:underline">
              {applicationCount} application{applicationCount === 1 ? "" : "s"} →
            </Link>
            <Link href={`/admin/qr-codes?job=${job.id}`} className="block text-brand hover:underline">
              {qrCount > 0 ? `${qrCount} QR code${qrCount === 1 ? "" : "s"} · create another →` : "Create a QR code for this job →"}
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
