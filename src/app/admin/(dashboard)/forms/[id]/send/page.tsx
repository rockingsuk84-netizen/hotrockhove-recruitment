import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/db/schema";
import { Alert, APPLICATION_STATUS_TONE, Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { applicantsWithCv, MAX_RECIPIENTS_PER_SEND } from "@/services/forms";
import { sendFormAction } from "../../actions";
import { SendForm } from "./send-form";

export const metadata = { title: "Send form" };
// Emails go out one by one (Resend allows about 2 per second), so allow time for a full batch.
export const maxDuration = 300;

const OPEN: ApplicationStatus[] = ["new", "reviewing", "shortlisted", "interview"];
const ROW_LIMIT = 500;

export default async function SendFormPage({ params, searchParams }: PageProps<"/admin/forms/[id]/send">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const form = await db.query.forms.findFirst({ where: eq(t.forms.id, id) });
  if (!form) notFound();

  const jobId = typeof sp.job === "string" && z.string().uuid().safeParse(sp.job).success ? sp.job : "";
  const statusParam = typeof sp.status === "string" ? sp.status : "open";
  const status = ["open", "all", ...APPLICATION_STATUSES].includes(statusParam) ? statusParam : "open";
  const cvFilter = sp.cv === "yes" || sp.cv === "no" ? sp.cv : "any";

  const where: SQL[] = [isNull(t.applicants.erasedAt)];
  if (jobId) where.push(eq(t.applications.jobId, jobId));
  if (status === "open") where.push(inArray(t.applications.status, OPEN));
  else if (status !== "all") where.push(eq(t.applications.status, status as ApplicationStatus));

  const [jobs, apps] = await Promise.all([
    db.select({ id: t.jobs.id, title: t.jobs.title }).from(t.jobs).orderBy(desc(t.jobs.updatedAt)),
    db
      .select({
        id: t.applications.id,
        applicantId: t.applications.applicantId,
        name: t.applicants.fullName,
        email: t.applicants.email,
        status: t.applications.status,
        createdAt: t.applications.createdAt,
        jobTitle: t.jobs.title,
      })
      .from(t.applications)
      .innerJoin(t.applicants, eq(t.applicants.id, t.applications.applicantId))
      .innerJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
      .where(and(...where))
      .orderBy(desc(t.applications.createdAt))
      .limit(ROW_LIMIT),
  ]);

  const applicantIds = [...new Set(apps.map((a) => a.applicantId))];
  const [withCv, existing] = await Promise.all([
    applicantsWithCv(applicantIds),
    applicantIds.length
      ? db
          .select({ applicantId: t.formRequests.applicantId, status: t.formRequests.status })
          .from(t.formRequests)
          .where(and(eq(t.formRequests.formId, id), inArray(t.formRequests.applicantId, applicantIds)))
      : Promise.resolve([]),
  ]);
  // Completed beats waiting; cancelled requests don't count.
  const already = new Map<string, "sent" | "completed">();
  for (const e of existing) {
    if (e.status === "completed") already.set(e.applicantId, "completed");
    else if (e.status === "sent" && !already.has(e.applicantId)) already.set(e.applicantId, "sent");
  }

  const rows = apps.filter((a) => cvFilter === "any" || (cvFilter === "yes") === withCv.has(a.applicantId));

  return (
    <>
      <Link href={`/admin/forms/${id}`} className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← {form.title}
      </Link>
      <div className="mt-3">
        <PageHeader
          title={`Send “${form.title}”`}
          description="Each applicant gets an email with a private link. Someone who applied for more than one job gets the form once."
        />
      </div>

      {form.status !== "active" ? (
        <Alert tone="error">This form is archived and can&apos;t be sent.</Alert>
      ) : (
        <>
          <form method="get" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-64">
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
                Application status
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
            <div className="sm:w-44">
              <label htmlFor="cv" className="mb-1 block text-sm font-medium text-stone-800">
                CV
              </label>
              <Select id="cv" name="cv" defaultValue={cvFilter}>
                <option value="any">Any</option>
                <option value="yes">CV on file</option>
                <option value="no">No CV yet</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>

          <SendForm action={sendFormAction.bind(null, id)} total={rows.length} max={MAX_RECIPIENTS_PER_SEND}>
            <Card className="overflow-hidden">
              {rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-stone-600">No applicants match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="w-10 px-5 py-3">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="px-5 py-3">Applicant</th>
                        <th className="px-5 py-3">Job</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">CV</th>
                        <th className="px-5 py-3">This form</th>
                        <th className="px-5 py-3">Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {rows.map((a) => {
                        const prior = already.get(a.applicantId);
                        return (
                          <tr key={a.id} className="hover:bg-stone-50">
                            <td className="px-5 py-3">
                              <input
                                type="checkbox"
                                name="applicationIds"
                                value={a.id}
                                id={`app-${a.id}`}
                                aria-label={`Select ${a.name}, ${a.jobTitle}`}
                                className="h-4 w-4"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <label htmlFor={`app-${a.id}`} className="font-medium text-stone-900">
                                {a.name}
                              </label>
                              <span className="block text-stone-500">{a.email}</span>
                            </td>
                            <td className="px-5 py-3 text-stone-700">{a.jobTitle}</td>
                            <td className="px-5 py-3">
                              <Badge tone={APPLICATION_STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                            </td>
                            <td className="px-5 py-3">
                              {withCv.has(a.applicantId) ? <Badge tone="green">On file</Badge> : <Badge tone="amber">No CV</Badge>}
                            </td>
                            <td className="px-5 py-3">
                              {prior === "completed" ? (
                                <Badge tone="green">Completed</Badge>
                              ) : prior === "sent" ? (
                                <Badge tone="amber">Waiting</Badge>
                              ) : (
                                <span className="text-stone-400">Not sent</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-stone-600">{formatDate(a.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            {apps.length === ROW_LIMIT && (
              <p className="text-sm text-stone-600">Showing the newest {ROW_LIMIT} applications. Narrow the filters to see others.</p>
            )}
          </SendForm>
        </>
      )}
    </>
  );
}
