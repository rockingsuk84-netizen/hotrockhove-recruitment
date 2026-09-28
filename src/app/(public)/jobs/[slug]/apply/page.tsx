import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CV_ACCEPT_ATTR } from "@/lib/files";
import { fillTemplate, getSetting } from "@/lib/settings";
import { normaliseSource } from "@/lib/qr";
import { getPublishedJobBySlug } from "@/services/jobs";
import { PageHero } from "@/components/site/cards";
import { Icon } from "@/components/site/icons";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply", robots: { index: false } };

export default async function ApplyPage({ params, searchParams }: PageProps<"/jobs/[slug]/apply">) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getPublishedJobBySlug(slug);
  if (!data) notFound();

  const [site, uploads, privacy] = await Promise.all([getSetting("site"), getSetting("uploads"), getSetting("privacy")]);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <PageHero eyebrow={data.department ?? "Application"} title={`Apply: ${data.job.title}`}>
        <p className="mt-4 max-w-xl text-white/80">
          It takes about 3 minutes and you don&apos;t need an account. Fields marked <span className="text-champagne">*</span> are required.
        </p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <Link href={`/jobs/${data.job.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to job details
        </Link>
        <div className="mt-5 rounded-[4px] border border-line bg-paper px-5 py-2 sm:px-9 sm:py-4">
          <ApplyForm
            nonce={nonce}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
            job={{ id: data.job.id, standoutPrompt: data.job.standoutPrompt, questions: data.job.questions }}
            positions={data.positions}
            source={normaliseSource(typeof sp.source === "string" ? sp.source : "")}
            maxCvBytes={uploads.maxCvBytes}
            allowedCvTypes={uploads.allowedCvTypes}
            accept={uploads.allowedCvTypes.map((ext) => CV_ACCEPT_ATTR[ext]).join(",")}
            consentText={fillTemplate(privacy.consentText, { brandName: site.brandName })}
          />
        </div>
      </div>
    </>
  );
}
