import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db, t } from "@/db";
import { Badge, Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatInterviewTime, MODE_LABELS } from "@/lib/interviews";
import { answerRows } from "@/lib/forms/definition";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { cancelInterviewAction, decideFormAction } from "../../actions";
import { OFFER_DECISION } from "@/services/forms";
import { DecisionForm } from "./decision-form";

export const metadata = { title: "Form response" };

const decider = alias(t.users, "decider");

export default async function FormResponsePage({ params }: PageProps<"/admin/forms/responses/[requestId]">) {
  await requireStaff();
  const { requestId } = await params;
  if (!z.string().uuid().safeParse(requestId).success) notFound();

  const [row] = await db
    .select({ request: t.formRequests, applicant: t.applicants, jobTitle: t.jobs.title, decidedBy: decider.name })
    .from(t.formRequests)
    .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
    .leftJoin(t.applications, eq(t.applications.id, t.formRequests.applicationId))
    .leftJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
    .leftJoin(decider, eq(decider.id, t.formRequests.decidedById))
    .where(eq(t.formRequests.id, requestId))
    .limit(1);
  if (!row || row.request.status !== "completed") notFound();
  const { request: r, applicant } = row;
  const def = r.definition;

  const hasCvField = def.fields.some((f) => f.type === "cv_upload");
  const interview = await db.query.interviews.findFirst({
    where: and(eq(t.interviews.formRequestId, r.id), eq(t.interviews.status, "scheduled")),
    orderBy: desc(t.interviews.createdAt),
  });
  const cv = r.cvDocumentId
    ? await db.query.documents.findFirst({ where: and(eq(t.documents.id, r.cvDocumentId), isNull(t.documents.deletedAt)) })
    : null;

  return (
    <>
      <Link href={`/admin/forms/${r.formId}?status=completed`} className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← {def.title}
      </Link>
      <div className="mt-3">
        <PageHeader
          title={applicant.fullName}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {def.title} · completed {formatDateTime(r.completedAt)}
              </span>
              {r.applicationId && (
                <Link href={`/admin/applications/${r.applicationId}`} className="font-medium text-brand hover:underline">
                  {row.jobTitle ? `Application: ${row.jobTitle}` : "View application"}
                </Link>
              )}
            </span>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <h2 className="font-semibold text-stone-900">Answers</h2>
          {applicant.erasedAt ? (
            <p className="mt-2 text-sm text-stone-600">This applicant&apos;s data has been erased.</p>
          ) : (
            <dl className="mt-2 divide-y divide-stone-100">
              {answerRows(def, r.answers).map(({ field, text }) => (
                <div key={field.id} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]">
                  <dt className="text-sm text-stone-500">{field.type === "signature" ? "Declaration" : field.label}</dt>
                  <dd className="whitespace-pre-line text-stone-900">{text}</dd>
                </div>
              ))}
              {hasCvField && (
                <div className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]">
                  <dt className="text-sm text-stone-500">CV</dt>
                  <dd className="text-stone-900">
                    {cv ? (
                      <>
                        New CV uploaded:{" "}
                        <a href={`/api/admin/documents/${cv.id}`} className="font-semibold text-brand hover:underline">
                          {cv.originalFilename}
                        </a>
                      </>
                    ) : (
                      "Already on file (see the application)"
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Interview</h2>
            {interview ? (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-stone-500">When</dt>
                    <dd className="text-stone-900">{formatInterviewTime(interview.scheduledAt)} · {interview.durationMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-stone-500">{MODE_LABELS[interview.mode]}</dt>
                    <dd className="break-words text-stone-900">
                      {interview.mode === "in_person" && interview.location}
                      {interview.mode === "online" && interview.meetingLink && (
                        <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                          {interview.meetingLink}
                        </a>
                      )}
                      {interview.mode === "phone" && (applicant.phone || "No phone number")}
                    </dd>
                  </div>
                  {interview.contactName && (
                    <div>
                      <dt className="text-stone-500">{interview.mode === "in_person" ? "Ask for" : "Interviewer"}</dt>
                      <dd className="text-stone-900">{interview.contactName}</dd>
                    </div>
                  )}
                  {interview.notes && (
                    <div>
                      <dt className="text-stone-500">Notes</dt>
                      <dd className="whitespace-pre-line text-stone-900">{interview.notes}</dd>
                    </div>
                  )}
                  <div>
                    <Badge tone={interview.emailStatus === "sent" ? "green" : interview.emailStatus === "failed" ? "red" : "neutral"}>
                      {interview.emailStatus === "sent" ? "Invitation emailed" : interview.emailStatus === "failed" ? "Email failed" : "Email pending"}
                    </Badge>
                  </div>
                </dl>
                {!applicant.erasedAt && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <LinkButton href={`/admin/forms/${r.formId}/interview?r=${r.id}`} variant="secondary" className="py-1.5">
                      Reschedule
                    </LinkButton>
                    <form action={cancelInterviewAction.bind(null, r.id, interview.id)}>
                      <Button type="submit" variant="ghost" className="py-1.5 text-red-700">
                        Cancel interview
                      </Button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-stone-600">Not invited yet.</p>
                {!applicant.erasedAt && (
                  <LinkButton href={`/admin/forms/${r.formId}/interview?r=${r.id}`} className="mt-3 w-full">
                    Invite to interview
                  </LinkButton>
                )}
              </>
            )}
          </Card>

          {def.reviewOptions.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold text-stone-900">Outcome</h2>
              <p className="mt-1 text-xs text-stone-500">Only “Offer” emails the applicant. Hold and Reject are never sent to them.</p>
              {r.decision && (
                <p className="mt-3 text-sm text-stone-700">
                  <Badge tone={r.decision === "Offer" ? "green" : r.decision === "Reject" ? "red" : "amber"}>{r.decision}</Badge>{" "}
                  by {row.decidedBy ?? "former staff member"} · {formatDateTime(r.decidedAt)}
                </p>
              )}
              {!applicant.erasedAt && (
                <DecisionForm
                  action={decideFormAction.bind(null, r.id)}
                  options={def.reviewOptions}
                  current={r.decision}
                  note={r.decisionNote}
                  offerOption={def.reviewOptions.includes(OFFER_DECISION) ? OFFER_DECISION : null}
                  offerEmailedAt={r.offerEmailedAt ? formatDateTime(r.offerEmailedAt) : null}
                  interviewed={Boolean(interview && interview.scheduledAt <= new Date())}
                />
              )}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
