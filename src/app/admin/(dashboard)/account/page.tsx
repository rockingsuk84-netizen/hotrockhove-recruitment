import { Alert, Card, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: PageProps<"/admin/account">) {
  const user = await requireStaff();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="My account" />
      {sp.changed && (
        <div className="mb-6 max-w-3xl">
          <Alert tone="success">Password changed. You&apos;ve been signed out on any other devices.</Alert>
        </div>
      )}
      <div className="grid max-w-3xl gap-6 md:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit p-5 text-sm">
          <h2 className="font-semibold text-stone-900">Details</h2>
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="text-stone-500">Name</dt>
              <dd className="text-stone-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Email</dt>
              <dd className="break-all text-stone-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Role</dt>
              <dd className="capitalize text-stone-900">{user.role}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold text-stone-900">Change password</h2>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
