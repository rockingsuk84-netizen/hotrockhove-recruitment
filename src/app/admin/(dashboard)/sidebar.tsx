"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/site/icons";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string; children?: { href: string; label: string }[] };

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Vertical admin navigation. Fixed sidebar on large screens; on smaller
 * screens a top bar with a menu button opens the same list as a drawer.
 */
export function AdminSidebar({
  brandName,
  items,
  user,
  signOut,
}: {
  brandName: string;
  items: NavItem[];
  user: { name: string; role: string };
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.children?.[0]?.href ?? item.href}
                aria-current={active && !item.children ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon name={item.icon} className={cx("h-5 w-5 shrink-0", active ? "text-champagne" : "text-white/50")} />
                {item.label}
              </Link>
              {item.children && (
                <ul className="mb-2 ml-[1.35rem] mt-1 space-y-0.5 border-l border-white/10 pl-4">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={cx(
                            "block rounded px-2 py-1.5 text-[0.82rem] transition",
                            childActive ? "font-semibold text-champagne" : "text-white/60 hover:text-white",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4 text-sm">
      <p className="truncate font-medium text-white">{user.name}</p>
      <p className="text-xs capitalize text-white/50">{user.role}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link href="/" target="_blank" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white">
          <Icon name="external" className="h-4 w-4" /> View site
        </Link>
        <form action={signOut}>
          <button type="submit" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white">
            <Icon name="logout" className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link href="/admin" className="block px-6 py-5 font-display text-lg text-white">
      {brandName} <span className="block font-sans text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-champagne">Admin</span>
    </Link>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-night lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile / tablet */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-night px-4 py-3 lg:hidden">
        <Link href="/admin" className="font-display text-base text-white">
          {brandName} <span className="ml-1 font-sans text-xs text-champagne">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="admin-drawer"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center text-white"
        >
          <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside id="admin-drawer" className="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-night lg:hidden">
            {brand}
            {nav}
            {footer}
          </aside>
        </>
      )}
    </>
  );
}
