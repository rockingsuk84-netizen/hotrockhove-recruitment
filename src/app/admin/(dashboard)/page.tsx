import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";
import { Alert, APPLICATION_STATUS_TONE, Badge, Card, PageHeader } from "@/components/ui";
import { formatDateTime, STATUS_LABELS } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { requireStaff } from "@/lib/session";

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  await requireStaff();
  const sp = await searchParams;

  const [[published], [open], [total], recent, storage, notifications] = await Promise.all([
    db.select({ n: count() }).from(t.jobs).where(eq(t.jobs.status, "published")),
    db
      .select({ n: count() })
      .from(t.applications)
      .where(inArray(t.applications.status, ["new", "reviewing", "shortlisted", "interview"])),
    db.select({ n: count() }).from(t.applications),
    db
      .select({
        id: t.applications.id,
        fullName: t.applications.fullName,
        status: t.applications.status,
        createdAt: t.applications.createdAt,
        jobTitle: t.jobs.title,
        position: t.positions.name,
      })
      .from(t.applications)
      .innerJoin(t.jobs, eq(t.jobs.id, t.applications.jobId))
      .leftJoin(t.positions, eq(t.positions.id, t.applications.positionId))
      .orderBy(desc(t.applications.createdAt))
      .limit(8),
    getSetting("storage"),
    getSetting("notifications"),
  ]);
  const [newCount] = await db.select({ n: count() }).from(t.applications).where(eq(t.applications.status, "new"));

  const stats = [
    { label: "Published jobs", value: published.n, href: "/admin/jobs" },
    { label: "New applications", value: newCount.n, href: "/admin/applications?status=new" },
    { label: "Open applications", value: open.n, href: "/admin/applications" },
    { label: "All applications", value: total.n, href: "/admin/applications?status=all" },
  ];

  const warnings = [
    storage.provider === "local" && "File storage is set to local development storage. Choose Cloudinary or Amazon S3 before going live.",
    notifications.adminRecipients.length === 0 && "No admin notification recipients are configured.",
    !process.env.RESEND_API_KEY && "RESEND_API_KEY is not set, so emails are not being delivered.",
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="Overview" />
      {sp.error === "forbidden" && (
        <div className="mb-6">
          <Alert tone="error">You don&apos;t have permission to open that page.</Alert>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {warnings.map((w) => (
            <Alert key={w}>{w}</Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 transition hover:border-stone-300">
              <p className="text-sm text-stone-600">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-stone-900">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-8">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="font-semibold text-stone-900">Recent applications</h2>
          <Link href="/admin/applications" className="text-sm font-medium text-brand hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-600">No applications yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/applications/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-stone-50">
                  <div>
                    <p className="font-medium text-stone-900">{a.fullName}</p>
                    <p className="text-sm text-stone-600">
                      {a.position ? `${a.position} · ` : ""}
                      {a.jobTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500">{formatDateTime(a.createdAt)}</span>
                    <Badge tone={APPLICATION_STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
