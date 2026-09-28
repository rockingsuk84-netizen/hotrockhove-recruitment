import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { AdminNav } from "../nav";

export default async function SettingsLayout({ children }: LayoutProps<"/admin/settings">) {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Configuration" description="Business settings are managed here rather than in code." />
      <div className="-mx-4 mb-6 border-b border-stone-200">
        <AdminNav
          links={[
            { href: "/admin/settings/general", label: "Branding" },
            { href: "/admin/settings/homepage", label: "Homepage" },
            { href: "/admin/settings/notifications", label: "Notifications" },
            { href: "/admin/settings/privacy", label: "Privacy & uploads" },
            { href: "/admin/settings/storage", label: "File storage" },
            { href: "/admin/settings/lists", label: "Lists" },
          ]}
        />
      </div>
      <div className="max-w-3xl">{children}</div>
    </>
  );
}
