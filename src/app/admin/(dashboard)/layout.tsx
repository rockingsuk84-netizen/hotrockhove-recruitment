import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";
import { canManageSettings, requireStaff } from "@/lib/session";
import { signOut } from "../login/actions";
import { AdminSidebar, type NavItem } from "./sidebar";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s | Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const site = await getSetting("site");
  const items: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "grid" },
    { href: "/admin/jobs", label: "Jobs", icon: "briefcase" },
    { href: "/admin/applications", label: "Applications", icon: "inbox" },
    { href: "/admin/qr-codes", label: "QR codes", icon: "qr" },
    ...(canManageSettings(user)
      ? [
          {
            href: "/admin/settings",
            label: "Configuration",
            icon: "settings",
            children: [
              { href: "/admin/settings/general", label: "Branding" },
              { href: "/admin/settings/homepage", label: "Homepage" },
              { href: "/admin/settings/notifications", label: "Notifications" },
              { href: "/admin/settings/privacy", label: "Privacy & uploads" },
              { href: "/admin/settings/storage", label: "File storage" },
              { href: "/admin/settings/lists", label: "Lists" },
            ],
          },
          { href: "/admin/users", label: "Staff", icon: "users" },
          { href: "/admin/audit", label: "Audit log", icon: "shield" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-stone-100">
      <AdminSidebar brandName={site.brandName} items={items} user={{ name: user.name, role: user.role }} signOut={signOut} />
      <main className="px-4 py-8 sm:px-6 lg:ml-64 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
