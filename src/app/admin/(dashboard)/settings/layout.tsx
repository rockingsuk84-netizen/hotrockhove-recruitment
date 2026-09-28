import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

/** Sub-sections are listed under Configuration in the admin sidebar. */
export default async function SettingsLayout({ children }: LayoutProps<"/admin/settings">) {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Configuration" description="Business settings are managed here rather than in code." />
      <div className="max-w-3xl">{children}</div>
    </>
  );
}
