import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/cards";
import { Icon } from "@/components/site/icons";
import { TextBlocks } from "@/components/site/text-blocks";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const home = await getSetting("homepage");
  return (
    <>
      <PageHero eyebrow="About us" title={home.aboutTitle} image={home.whyImage || undefined} />
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12">
        <div className="max-w-3xl">
          <TextBlocks text={home.aboutText} />
        </div>
        {home.benefits.length > 0 && (
          <aside className="h-fit rounded-[4px] bg-forest p-8 text-white">
            <p className="eyebrow">{home.whyEyebrow || "Why join us"}</p>
            <ul className="mt-6 space-y-5">
              {home.benefits.map((b) => (
                <li key={b.label} className="flex items-center gap-4">
                  <Icon name={b.icon} className="h-7 w-7 shrink-0 text-champagne" />
                  <span className="text-sm text-white/90">{b.label}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/jobs"
              className="group mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-champagne px-5 py-3.5 text-sm font-semibold text-night"
            >
              View open positions <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </aside>
        )}
      </div>
    </>
  );
}
