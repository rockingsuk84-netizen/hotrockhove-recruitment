import Link from "next/link";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/db/schema";
import { APPLICATION_STATUS_TONE, Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { formatDateTime, STATUS_LABELS } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Applications" };

const PAGE_SIZE = 50;
const OPEN: ApplicationStatus[] = ["new", "reviewing", "shortlisted", "interview"];

export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/applications">) {
  await requireStaff();
  const sp = await searchParams;
  const jobId = typeof sp.job === "string" && z.string().uuid().safeParse(sp.job).success ? sp.job : "";
  const statusParam = typeof sp.status === "string" ? sp.status : "open";
  const status = statusParam === "all" || statusParam === "open" || (APPLICATION_STATUSES as readonly string[]).includes(statusParam) ? statusParam : "open";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: SQL[] = [];
  if (jobId) where.push(eq(t.applications.jobId, jobId));
  if (status === "open") where.push(inArray(t.applications.status, OPEN));
  else if (status !== "all") where.push(eq(t.applications.status, status as ApplicationStatus));
  const filter = where.length ? and(...where) : undefined;

  const [jobs, rows, [{ n: total }]] = await Promise.all([
    db.select({ id: t.jobs.id, title: t.jobs.title }).from(t.jobs).orderBy(desc(t.jobs.updatedAt)),
    db
      .select({
        id: t.applications.id,
        fullName: t.applications.fullName,
        status: t.applications.status,
        source: t.applications.source,
        createdAt: t.applications.createdAt,
        jobTitle: t.jobs.title,
        position: t.positions.name,
      })
      .from(t.applications)
      .innerJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
      .leftJoin(t.positions, eq(t.positions.id, t.applications.positionId))
      .where(filter)
      .orderBy(desc(t.applications.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(t.applications).where(filter),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(jobId ? { job: jobId } : {}), status, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Applications" description={`${total} matching application${total === 1 ? "" : "s"}`} />

      <form method="get" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-72">
          <label htmlFor="job" className="mb-1 block text-sm font-medium text-stone-800">
            Job
          </label>
          <Select id="job" name="job" defaultValue={jobId}>
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-56">
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-stone-800">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="open">Open (not rejected or hired)</option>
            <option value="all">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-600">No applications match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Job / role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/applications/${r.id}`} className="font-medium text-stone-900 hover:underline">
                        {r.fullName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-stone-700">
                      {r.position && r.position !== r.jobTitle && <span className="block font-medium">{r.position}</span>}
                      <span className="text-stone-500">{r.jobTitle}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={APPLICATION_STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{r.source ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-stone-600">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={qs(page - 1)} className="font-medium text-brand hover:underline">← Previous</Link> : <span />}
          <span className="text-stone-600">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={qs(page + 1)} className="font-medium text-brand hover:underline">Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
