"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { Icon } from "./icons";
import { Logo } from "./logo";
import { NAV_LINKS } from "./nav";


function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Transparent over the dark page heroes, turning solid once the page scrolls.
 * On small screens the links move into a full-screen menu.
 */
export function SiteHeader({ brandName, logoUrl }: { brandName: string; logoUrl?: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const solid = scrolled || open;

  return (
    <>
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,padding] duration-300",
        solid ? "bg-night/95 py-3 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur" : "bg-transparent py-5",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-champagne focus:px-3 focus:py-2 focus:text-sm focus:text-night"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Logo brandName={brandName} logoUrl={logoUrl} />

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-10">
            {NAV_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "relative py-2 text-[0.82rem] font-medium tracking-wide text-white/85 transition hover:text-white",
                      "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-champagne after:transition-transform",
                      active ? "text-white after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="hidden rounded-[3px] bg-champagne px-5 py-2.5 text-[0.8rem] font-semibold text-night transition hover:brightness-105 sm:inline-flex"
          >
            Apply Now
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-white md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
          </button>
        </div>
      </div>

    </header>
    {/* Outside <header>: its backdrop-filter would otherwise contain this fixed panel. */}
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-[68px] z-40 flex flex-col overflow-y-auto bg-night px-6 pb-10 pt-8 md:hidden">
          <nav aria-label="Mobile">
            <ul className="space-y-1">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className="flex items-center justify-between border-b border-white/10 py-4 font-display text-3xl text-white aria-[current=page]:text-champagne"
                  >
                    {l.label}
                    <Icon name="arrow" className="h-5 w-5 text-white/40" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/jobs"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-[3px] bg-champagne px-6 py-4 text-base font-semibold text-night"
          >
            View open positions <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      )}
    </>
  );
}
