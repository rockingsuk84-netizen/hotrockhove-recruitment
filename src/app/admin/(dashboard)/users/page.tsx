import { asc, ne } from "drizzle-orm";
import { db, t } from "@/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { setStaffActive } from "./actions";
import { CreateStaffForm } from "./create-staff-form";
import { ResetPasswordButton } from "./reset-button";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireAdmin();
  const staff = await db.select().from(t.users).where(ne(t.users.role, "applicant")).orderBy(asc(t.users.name));

  return (
    <>
      <PageHeader title="Staff" description="Owners and admins manage configuration and staff. Recruiters manage jobs and applications. New staff are emailed an invitation to set their own password." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {staff.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-stone-900">
                    {u.name} {u.id === me.id && <span className="text-sm font-normal text-stone-500">(you)</span>}
                  </p>
                  <p className="text-sm text-stone-600">
                    {u.email} · added {formatDate(u.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={u.role === "recruiter" ? "neutral" : "violet"}>{u.role}</Badge>
                  {!u.active && <Badge tone="red">Deactivated</Badge>}
                  {u.id !== me.id && (u.role !== "owner" || me.role === "owner") && (
                    <>
                      {u.active && <ResetPasswordButton userId={u.id} name={u.name} />}
                      <form action={setStaffActive.bind(null, u.id, !u.active)}>
                        <button type="submit" className="text-sm font-medium text-brand hover:underline">
                          {u.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold text-stone-900">Add staff member</h2>
          <CreateStaffForm canCreateOwner={me.role === "owner"} />
        </Card>
      </div>
    </>
  );
}
