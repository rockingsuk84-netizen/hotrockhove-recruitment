import type { Metadata } from "next";
import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { canManageSettings, requireStaff } from "@/lib/session";
import { signOut } from "../login/actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s | Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const site = await getSetting("site");
  const links = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/jobs", label: "Jobs" },
    { href: "/admin/applications", label: "Applications" },
    ...(canManageSettings(user)
      ? [
          { href: "/admin/settings", label: "Configuration" },
          { href: "/admin/users", label: "Staff" },
          { href: "/admin/audit", label: "Audit log" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="font-display text-lg font-semibold text-stone-900">
            {site.brandName} <span className="font-sans text-sm font-normal text-stone-500">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-stone-600 sm:inline">
              {user.name} · <span className="capitalize">{user.role}</span>
            </span>
            <Link href="/" target="_blank" className="text-stone-600 hover:text-stone-900">
              View site
            </Link>
            <form action={signOut}>
              <button type="submit" className="font-medium text-stone-800 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <AdminNav links={links} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
