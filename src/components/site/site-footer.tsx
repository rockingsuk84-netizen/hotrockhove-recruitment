import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import { SocialIcon } from "./icons";
import { Logo } from "./logo";
import { NAV_LINKS } from "./nav";

export function SiteFooter({ site }: { site: SiteSettings }) {
  const socials = [
    { name: "instagram" as const, href: site.instagramUrl, label: "Instagram" },
    { name: "linkedin" as const, href: site.linkedinUrl, label: "LinkedIn" },
    { name: "facebook" as const, href: site.facebookUrl, label: "Facebook" },
  ].filter((s) => s.href);

  return (
    <footer className="bg-night text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-8 py-12 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Logo brandName={site.brandName} logoUrl={site.logoUrl} />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-9 gap-y-3 text-sm text-white/80">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {socials.length > 0 && (
            <ul className="flex gap-4 md:justify-end">
              {socials.map((s) => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="block text-white/80 transition hover:text-champagne">
                    <SocialIcon name={s.name} className="h-[18px] w-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-4 border-t border-white/10 py-7 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.brandName}. All rights reserved.
            {site.footerText ? ` ${site.footerText}` : ""}
          </p>
          <ul className="flex gap-7">
            <li>
              <Link href="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
