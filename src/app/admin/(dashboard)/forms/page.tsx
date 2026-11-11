import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Forms" };

export default async function FormsPage() {
  await requireStaff();
  const rows = await db
    .select({
      id: t.forms.id,
      title: t.forms.title,
      status: t.forms.status,
      updatedAt: t.forms.updatedAt,
      waiting: sql<number>`count(${t.formRequests.id}) filter (where ${t.formRequests.status} = 'sent')`.mapWith(Number),
      completed: sql<number>`count(${t.formRequests.id}) filter (where ${t.formRequests.status} = 'completed')`.mapWith(Number),
    })
    .from(t.forms)
    .leftJoin(t.formRequests, eq(t.formRequests.formId, t.forms.id))
    .groupBy(t.forms.id)
    .orderBy(asc(t.forms.status), asc(t.forms.title));

  return (
    <>
      <PageHeader title="Forms" description="Send forms to applicants by email and review their answers." />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-600">No forms yet. Run the database seed to add the availability form.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3">Form</th>
                  <th className="px-5 py-3">Waiting for reply</th>
                  <th className="px-5 py-3">Completed</th>
                  <th className="px-5 py-3">Last changed</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((f) => (
                  <tr key={f.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/forms/${f.id}`} className="font-medium text-stone-900 hover:underline">
                        {f.title}
                      </Link>
                      {f.status === "archived" && (
                        <span className="ml-2">
                          <Badge>Archived</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-stone-700">{f.waiting}</td>
                    <td className="px-5 py-3 text-stone-700">{f.completed}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-stone-600">{formatDate(f.updatedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {f.status === "active" && (
                        <LinkButton href={`/admin/forms/${f.id}/send`} variant="secondary" className="py-1.5">
                          Send
                        </LinkButton>
                      )}
                    </td>
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
