import Link from "next/link";
import { desc, eq, like } from "drizzle-orm";
import { db, t } from "@/db";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const sp = await searchParams;
  const securityOnly = sp.filter === "security";

  const rows = await db
    .select({ log: t.auditLogs, actor: t.users.name })
    .from(t.auditLogs)
    .leftJoin(t.users, eq(t.users.id, t.auditLogs.actorUserId))
    .where(securityOnly ? like(t.auditLogs.action, "security.%") : undefined)
    .orderBy(desc(t.auditLogs.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="The latest 200 administrative and security events. IP addresses are stored only as keyed hashes."
        actions={
          <div className="flex gap-3 text-sm">
            <Link href="/admin/audit" className={securityOnly ? "text-brand hover:underline" : "font-semibold"}>
              All
            </Link>
            <Link href="/admin/audit?filter=security" className={securityOnly ? "font-semibold" : "text-brand hover:underline"}>
              Security only
            </Link>
          </div>
        }
      />
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map(({ log, actor }) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-2 text-stone-600">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                <td className="px-4 py-2">{actor ?? (log.actorUserId ? "Deleted user" : "—")}</td>
                <td className="px-4 py-2 text-xs text-stone-600">{log.entityType ? `${log.entityType}${log.entityId ? `:${log.entityId.slice(0, 8)}` : ""}` : "—"}</td>
                <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-stone-600">
                  {Object.keys(log.metadata).length ? JSON.stringify(log.metadata) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
