import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { FormRequestStatus } from "@/db/schema";
import { Alert, Badge, Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { applicantsWithCv } from "@/services/forms";
import { cancelFormAction, resendFormAction } from "../actions";
import { SelectAll } from "./select-all";

export const metadata = { title: "Form" };

const FILTERS = { all: "All", sent: "Waiting for reply", completed: "Completed", cancelled: "Cancelled" } as const;
const STATUS_TONE = { sent: "amber", completed: "green", cancelled: "neutral" } as const;
const STATUS_LABEL = { sent: "Waiting", completed: "Completed", cancelled: "Cancelled" } as const;
const DECISION_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = { Offer: "green", Hold: "amber", Reject: "red" };

export default async function FormPage({ params, searchParams }: PageProps<"/admin/forms/[id]">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const form = await db.query.forms.findFirst({ where: eq(t.forms.id, id) });
  if (!form) notFound();

  const filter = typeof sp.status === "string" && sp.status in FILTERS ? (sp.status as keyof typeof FILTERS) : "all";
  const where: SQL[] = [eq(t.formRequests.formId, id)];
  if (filter !== "all") where.push(eq(t.formRequests.status, filter as FormRequestStatus));

  const requests = await db
    .select({
      id: t.formRequests.id,
      status: t.formRequests.status,
      emailStatus: t.formRequests.emailStatus,
      sentAt: t.formRequests.sentAt,
      expiresAt: t.formRequests.expiresAt,
      completedAt: t.formRequests.completedAt,
      decision: t.formRequests.decision,
      applicantId: t.formRequests.applicantId,
      applicationId: t.formRequests.applicationId,
      name: t.applicants.fullName,
      jobTitle: t.jobs.title,
    })
    .from(t.formRequests)
    .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
    .leftJoin(t.applications, eq(t.applications.id, t.formRequests.applicationId))
    .leftJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
    .where(and(...where))
    .orderBy(desc(t.formRequests.sentAt))
    .limit(500);
  const completedIds = requests.filter((r) => r.status === "completed").map((r) => r.id);
  const [withCv, interviews] = await Promise.all([
    applicantsWithCv([...new Set(requests.map((r) => r.applicantId))]),
    completedIds.length
      ? db
          .select({ formRequestId: t.interviews.formRequestId, scheduledAt: t.interviews.scheduledAt, emailStatus: t.interviews.emailStatus })
          .from(t.interviews)
          .where(and(inArray(t.interviews.formRequestId, completedIds), eq(t.interviews.status, "scheduled")))
      : Promise.resolve([]),
  ]);
  const interviewFor = new Map(interviews.map((i) => [i.formRequestId, i]));
  const now = new Date();

  return (
    <>
      <Link href="/admin/forms" className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← All forms
      </Link>
      <div className="mt-3">
        <PageHeader
          title={form.title}
          description={form.definition.intro}
          actions={form.status === "active" && <LinkButton href={`/admin/forms/${id}/send`}>Send to applicants</LinkButton>}
        />
      </div>

      {typeof sp.sent === "string" && (
        <div className="mb-6">
          <Alert tone={Number(sp.failed) > 0 ? "error" : "success"}>
            Sent to {sp.sent} applicant{sp.sent === "1" ? "" : "s"}.
            {Number(sp.failed) > 0 && ` ${sp.failed} email(s) failed. Use “Resend” to try again.`}
            {Number(sp.skipped) > 0 && ` ${sp.skipped} skipped because they already had this form.`}
          </Alert>
        </div>
      )}

      {typeof sp.invited === "string" && (
        <div className="mb-6">
          <Alert tone={Number(sp.failed) > 0 ? "error" : "success"}>
            {Number(sp.invited) > 0 && `Interview invitations sent to ${sp.invited}. `}
            {Number(sp.updated) > 0 && `Updated interview details sent to ${sp.updated}. `}
            {Number(sp.failed) > 0 && `${sp.failed} email(s) failed. Open the response and reschedule to try again.`}
          </Alert>
        </div>
      )}

      {/* Checkboxes in the table belong to this form via the form attribute (rows also hold their own action forms). */}
      <form id="invite-form" method="get" action={`/admin/forms/${id}/interview`} className="mb-4 flex flex-wrap items-center gap-2">
        {completedIds.length > 0 && (
          <>
            <SelectAll target='input[form="invite-form"][name="r"]' label={`Select all completed (${completedIds.length})`} />
            <Button type="submit" variant="primary" className="py-1.5">
              Invite selected to interview
            </Button>
          </>
        )}
      </form>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter responses">
        {Object.entries(FILTERS).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? `/admin/forms/${id}` : `/admin/forms/${id}?status=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={
              filter === key
                ? "rounded-full bg-stone-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {requests.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-600">Nobody here yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="w-10 px-5 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">CV</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Interview</th>
                  <th className="px-5 py-3">Outcome</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {requests.map((r) => {
                  const expired = r.status === "sent" && r.expiresAt < now;
                  return (
                    <tr key={r.id} className="align-top hover:bg-stone-50">
                      <td className="px-5 py-3">
                        {r.status === "completed" && (
                          <input type="checkbox" form="invite-form" name="r" value={r.id} aria-label={`Select ${r.name}`} className="h-4 w-4" />
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {r.applicationId ? (
                          <Link href={`/admin/applications/${r.applicationId}`} className="font-medium text-stone-900 hover:underline">
                            {r.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-stone-900">{r.name}</span>
                        )}
                        {r.jobTitle && <span className="block text-stone-500">{r.jobTitle}</span>}
                      </td>
                      <td className="px-5 py-3">
                        {withCv.has(r.applicantId) ? <Badge tone="green">On file</Badge> : <Badge tone="amber">No CV</Badge>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={expired ? "red" : STATUS_TONE[r.status]}>{expired ? "Link expired" : STATUS_LABEL[r.status]}</Badge>
                          {r.emailStatus === "failed" && <Badge tone="red">Email failed</Badge>}
                        </span>
                        {r.completedAt && <span className="mt-1 block text-xs text-stone-500">{formatDateTime(r.completedAt)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-stone-600">
                        {formatDate(r.sentAt)}
                        {r.status === "sent" && !expired && <span className="block text-xs text-stone-500">Link works until {formatDate(r.expiresAt)}</span>}
                      </td>
                      <td className="px-5 py-3">
                        {interviewFor.get(r.id) ? (
                          <>
                            <span className="whitespace-nowrap text-stone-700">{formatDateTime(interviewFor.get(r.id)!.scheduledAt)}</span>
                            {interviewFor.get(r.id)!.emailStatus === "failed" && (
                              <span className="mt-1 block">
                                <Badge tone="red">Email failed</Badge>
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3">{r.decision ? <Badge tone={DECISION_TONE[r.decision] ?? "neutral"}>{r.decision}</Badge> : "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {r.status === "completed" && (
                          <Link href={`/admin/forms/responses/${r.id}`} className="font-semibold text-brand hover:underline">
                            View answers
                          </Link>
                        )}
                        {r.status === "sent" && (
                          <span className="inline-flex gap-1">
                            <form action={resendFormAction.bind(null, id, r.id)}>
                              <Button type="submit" variant="ghost" className="px-2 py-1">
                                Resend
                              </Button>
                            </form>
                            <form action={cancelFormAction.bind(null, id, r.id)}>
                              <Button type="submit" variant="ghost" className="px-2 py-1 text-red-700">
                                Cancel
                              </Button>
                            </form>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-stone-500">“Resend” emails a new link and the old one stops working. Links last 30 days.</p>
    </>
  );
}
