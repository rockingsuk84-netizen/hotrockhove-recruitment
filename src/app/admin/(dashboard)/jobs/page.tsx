import Link from "next/link";
import { Badge, Card, JOB_STATUS_TONE, LinkButton, PageHeader } from "@/components/ui";
import { formatDate, JOB_STATUS_LABELS } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { listAllJobs } from "@/services/jobs";

export const metadata = { title: "Jobs" };

export default async function AdminJobsPage() {
  await requireStaff();
  const jobs = await listAllJobs();

  return (
    <>
      <PageHeader title="Jobs" description="Create, publish and close vacancies." actions={<LinkButton href="/admin/jobs/new">New job</LinkButton>} />
      <Card className="overflow-hidden">
        {jobs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-600">No jobs yet. Create your first vacancy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3 text-right">Applications</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/jobs/${job.id}`} className="font-medium text-stone-900 hover:underline">
                        {job.title}
                      </Link>
                      <p className="text-xs text-stone-500">/jobs/{job.slug}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                        {job.featured && <Badge tone="amber">Featured</Badge>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-stone-700">{job.location ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <Link href={`/admin/applications?job=${job.id}&status=all`} className="text-brand hover:underline">
                        {job.applications}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-stone-600">{formatDate(job.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
