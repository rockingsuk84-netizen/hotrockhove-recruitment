import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/cards";
import { Icon } from "@/components/site/icons";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const site = await getSetting("site");
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch">
        <p className="mt-4 max-w-xl text-white/80">Questions about a role or your application? We&apos;re happy to help.</p>
      </PageHero>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-2 lg:px-12">
        {site.contactEmail && (
          <a href={`mailto:${site.contactEmail}`} className="group rounded-[4px] border border-line bg-paper p-8 transition hover:border-ink/30">
            <Icon name="mail" className="h-8 w-8 text-[#9a7b45]" />
            <h2 className="mt-5 font-display text-2xl text-ink">Email us</h2>
            <p className="mt-2 break-all text-forest underline-offset-4 group-hover:underline">{site.contactEmail}</p>
            <p className="mt-3 text-sm text-muted">We aim to reply within two working days.</p>
          </a>
        )}
        <Link href="/jobs" className="group rounded-[4px] bg-forest p-8 text-white">
          <Icon name="briefcase" className="h-8 w-8 text-champagne" />
          <h2 className="mt-5 font-display text-2xl">Looking for a role?</h2>
          <p className="mt-2 text-white/80">The quickest way to reach our hiring team is to apply online — no account needed.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-champagne">
            View open positions <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </>
  );
}
