import type { Metadata } from "next";
import { PageHero } from "@/components/site/cards";
import { TextBlocks } from "@/components/site/text-blocks";
import { fillTemplate, getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Terms" };

export default async function TermsPage() {
  const [site, privacy] = await Promise.all([getSetting("site"), getSetting("privacy")]);
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Use" />
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <TextBlocks text={fillTemplate(privacy.terms, { brandName: site.brandName })} />
      </div>
    </>
  );
}
