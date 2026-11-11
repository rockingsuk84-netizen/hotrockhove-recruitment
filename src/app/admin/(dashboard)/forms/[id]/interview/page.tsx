import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { Alert, PageHeader } from "@/components/ui";
import { formatInterviewTime, utcToLondonLocal } from "@/lib/interviews";
import { requireStaff } from "@/lib/session";
import { MAX_RECIPIENTS_PER_SEND } from "@/services/forms";
import { scheduleInterviewsAction } from "../../actions";
import { InterviewForm, type Defaults, type Invitee } from "./interview-form";

export const metadata = { title: "Invite to interview" };
// Emails go out one by one, so allow time for a full batch.
export const maxDuration = 300;

/** Selected people arrive as ?r=<form request id>&r=… from the form page or a response page. */
export default async function InterviewPage({ params, searchParams }: PageProps<"/admin/forms/[id]/interview">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const form = await db.query.forms.findFirst({ where: eq(t.forms.id, id), columns: { id: true, title: true } });
  if (!form) notFound();

  const raw = Array.isArray(sp.r) ? sp.r : typeof sp.r === "string" ? [sp.r] : [];
  const ids = [...new Set(raw.filter((v) => z.string().uuid().safeParse(v).success))].slice(0, MAX_RECIPIENTS_PER_SEND);

  const rows = ids.length
    ? await db
        .select({ id: t.formRequests.id, name: t.applicants.fullName, phone: t.applicants.phone, jobTitle: t.jobs.title })
        .from(t.formRequests)
        .innerJoin(t.applicants, eq(t.applicants.id, t.formRequests.applicantId))
        .leftJoin(t.applications, eq(t.applications.id, t.formRequests.applicationId))
        .leftJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
        .where(and(inArray(t.formRequests.id, ids), eq(t.formRequests.formId, id), eq(t.formRequests.status, "completed")))
    : [];
  const current = rows.length
    ? await db
        .select()
        .from(t.interviews)
        .where(and(inArray(t.interviews.formRequestId, rows.map((r) => r.id)), eq(t.interviews.status, "scheduled")))
        .orderBy(desc(t.interviews.createdAt))
    : [];
  const byRequest = new Map(current.map((i) => [i.formRequestId, i]));

  const invitees: Invitee[] = rows.map((r) => {
    const existing = byRequest.get(r.id);
    return {
      requestId: r.id,
      name: r.name,
      jobTitle: r.jobTitle,
      phone: r.phone,
      current: existing ? formatInterviewTime(existing.scheduledAt) : null,
      currentLocal: existing ? utcToLondonLocal(existing.scheduledAt) : "",
    };
  });

  // Rescheduling one person starts from their current details; otherwise sensible defaults.
  const base = rows.length === 1 ? byRequest.get(rows[0].id) : undefined;
  const defaults: Defaults = {
    mode: base?.mode ?? "in_person",
    durationMinutes: base?.durationMinutes ?? 30,
    location: base?.location ?? "",
    meetingLink: base?.meetingLink ?? "",
    contactName: base?.contactName ?? "",
    notes: base?.notes ?? "",
  };

  return (
    <>
      <Link href={`/admin/forms/${id}?status=completed`} className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← {form.title}
      </Link>
      <div className="mt-3">
        <PageHeader title="Invite to interview" description="Only people who have completed the form can be invited." />
      </div>
      {invitees.length === 0 ? (
        <Alert tone="info">
          Nobody selected. Go to the{" "}
          <Link href={`/admin/forms/${id}?status=completed`} className="font-semibold underline">
            completed responses
          </Link>
          , tick the people to invite and choose “Invite to interview”.
        </Alert>
      ) : (
        <InterviewForm
          action={scheduleInterviewsAction.bind(null, id)}
          invitees={invitees}
          defaults={defaults}
          minLocal={utcToLondonLocal(new Date())}
        />
      )}
    </>
  );
}
