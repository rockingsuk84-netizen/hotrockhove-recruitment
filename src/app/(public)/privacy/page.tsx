import type { Metadata } from "next";
import { PageHero } from "@/components/site/cards";
import { TextBlocks } from "@/components/site/text-blocks";
import { fillTemplate, getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const [site, privacy] = await Promise.all([getSetting("site"), getSetting("privacy")]);
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" />
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <TextBlocks text={fillTemplate(privacy.privacyPolicy, { brandName: site.brandName })} />
        {site.contactEmail && (
          <p className="mt-10 border-t border-line pt-6 text-sm text-muted">
            Questions about your data? Contact{" "}
            <a className="font-medium text-forest underline" href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
            </a>
            .
          </p>
        )}
      </div>
    </>
  );
}
