import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { APPLICATION_STATUSES } from "@/db/schema";
import { Alert, APPLICATION_STATUS_TONE, Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { formatBytes } from "@/lib/files";
import { formatDateTime, STATUS_LABELS } from "@/lib/format";
import { canManageSettings, requireStaff } from "@/lib/session";
import { eraseApplicantAction, updateStatus } from "../actions";
import { NoteForm } from "./note-form";

export const metadata = { title: "Application" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="whitespace-pre-line text-stone-900">{children}</dd>
    </div>
  );
}

export default async function ApplicationPage({ params, searchParams }: PageProps<"/admin/applications/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [row] = await db
    .select({ application: t.applications, job: t.jobs, position: t.positions.name, applicant: t.applicants })
    .from(t.applications)
    .innerJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
    .innerJoin(t.applicants, eq(t.applicants.id, t.applications.applicantId))
    .leftJoin(t.positions, eq(t.positions.id, t.applications.positionId))
    .where(eq(t.applications.id, id))
    .limit(1);
  if (!row) notFound();
  const { application: a, job, applicant } = row;

  const [documents, notes, otherApplications, emails] = await Promise.all([
    db
      .select()
      .from(t.documents)
      .where(and(eq(t.documents.applicationId, id), isNull(t.documents.deletedAt)))
      .orderBy(desc(t.documents.createdAt)),
    db
      .select({ id: t.applicationNotes.id, body: t.applicationNotes.body, createdAt: t.applicationNotes.createdAt, author: t.users.name })
      .from(t.applicationNotes)
      .leftJoin(t.users, eq(t.users.id, t.applicationNotes.authorId))
      .where(eq(t.applicationNotes.applicationId, id))
      .orderBy(desc(t.applicationNotes.createdAt)),
    db
      .select({ id: t.applications.id, status: t.applications.status, createdAt: t.applications.createdAt, jobTitle: t.jobs.title })
      .from(t.applications)
      .innerJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
      .where(and(eq(t.applications.applicantId, applicant.id), ne(t.applications.id, id)))
      .orderBy(desc(t.applications.createdAt)),
    db
      .select({ id: t.notifications.id, template: t.notifications.template, status: t.notifications.status, createdAt: t.notifications.createdAt })
      .from(t.notifications)
      .where(eq(t.notifications.applicationId, id))
      .orderBy(desc(t.notifications.createdAt)),
  ]);

  const erased = Boolean(applicant.erasedAt);

  return (
    <>
      <Link href="/admin/applications" className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← All applications
      </Link>
      <div className="mt-3">
        <PageHeader
          title={a.fullName}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={APPLICATION_STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge>
              <span>
                {row.position && row.position !== job.title ? `${row.position} · ` : ""}
                <Link href={`/admin/jobs/${job.id}`} className="hover:underline">
                  {job.title}
                </Link>
              </span>
            </span>
          }
        />
      </div>
      {sp.erased && (
        <div className="mb-6">
          <Alert tone="success">The applicant&apos;s personal data and files have been erased.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Application</h2>
            <dl className="mt-2 divide-y divide-stone-100">
              <Row label="Email">{a.email ? <a href={`mailto:${a.email}`} className="text-brand hover:underline">{a.email}</a> : "—"}</Row>
              <Row label="Phone">{a.phone ? <a href={`tel:${a.phone.replace(/\s/g, "")}`} className="text-brand hover:underline">{a.phone}</a> : "—"}</Row>
              <Row label="Role">{row.position ?? job.title}</Row>
              <Row label={job.standoutPrompt}>{a.standoutQuality || "—"}</Row>
              {job.questions.map((q) => (
                <Row key={q.id} label={q.label}>
                  {a.answers[q.id] ?? "—"}
                </Row>
              ))}
              {Object.entries(a.answers)
                .filter(([k]) => !job.questions.some((q) => q.id === k))
                .map(([k, v]) => (
                  <Row key={k} label={`${k} (removed question)`}>
                    {v}
                  </Row>
                ))}
              <Row label="Message">{a.coverMessage || "—"}</Row>
              <Row label="Source">{a.source ?? "Direct"}</Row>
              <Row label="Submitted">{formatDateTime(a.createdAt)}</Row>
              <Row label="Consent">
                <span className="text-sm text-stone-700">
                  Given {formatDateTime(a.consentedAt)}: “{a.consentText}”
                </span>
              </Row>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Documents</h2>
            {documents.length === 0 ? (
              <p className="mt-2 text-sm text-stone-600">{erased ? "Files were erased." : "No documents."}</p>
            ) : (
              <ul className="mt-3 divide-y divide-stone-100">
                {documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-stone-900">{d.originalFilename}</p>
                      <p className="text-xs text-stone-500">
                        {d.type.toUpperCase()} · {formatBytes(d.sizeBytes)} · stored in {d.storageProvider}
                      </p>
                    </div>
                    <a href={`/api/admin/documents/${d.id}`} className="text-sm font-semibold text-brand hover:underline">
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Internal notes</h2>
            <p className="mt-1 text-xs text-stone-500">Visible to staff only. Notes may be disclosed if the applicant makes a subject access request.</p>
            {!erased && <NoteForm applicationId={id} />}
            <ul className="mt-4 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md bg-stone-50 p-3">
                  <p className="whitespace-pre-line text-sm text-stone-900">{n.body}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {n.author ?? "Former staff member"} · {formatDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Status</h2>
            <form action={updateStatus.bind(null, id)} className="mt-3 space-y-3">
              <Select name="status" defaultValue={a.status} aria-label="Application status">
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              <Button type="submit" className="w-full">
                Update status
              </Button>
            </form>
            <p className="mt-2 text-xs text-stone-500">Last changed {formatDateTime(a.statusChangedAt)}</p>
          </Card>

          {otherApplications.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold text-stone-900">Other applications</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {otherApplications.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/applications/${o.id}`} className="text-brand hover:underline">
                      {o.jobTitle}
                    </Link>
                    <span className="text-stone-500"> · {STATUS_LABELS[o.status]} · {formatDateTime(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-semibold text-stone-900">Emails</h2>
            {emails.length === 0 ? (
              <p className="mt-2 text-sm text-stone-600">None recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {emails.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="text-stone-700">{e.template === "admin.new_application" ? "Admin alert" : "Applicant confirmation"}</span>
                    <Badge tone={e.status === "sent" ? "green" : e.status === "failed" ? "red" : "neutral"}>{e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManageSettings(user) && !erased && (
            <Card className="border-red-200 p-5">
              <h2 className="font-semibold text-red-800">Erase applicant data</h2>
              <p className="mt-1 text-sm text-stone-600">
                Permanently deletes this person&apos;s files and anonymises all of their applications. This cannot be undone.
              </p>
              <form action={eraseApplicantAction.bind(null, id, applicant.id)} className="mt-3 space-y-3">
                <label className="flex items-start gap-2 text-sm text-stone-800">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4 accent-red-700" />
                  I understand this is permanent.
                </label>
                <Button type="submit" variant="danger" className="w-full">
                  Erase data
                </Button>
              </form>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
