import type { Metadata } from "next";
import { Icon } from "@/components/site/icons";
import { PageHero } from "@/components/site/cards";
import { CV_ACCEPT_ATTR } from "@/lib/files";
import { formatDate } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { findFormRequestByToken } from "@/services/forms";
import { FormRenderer } from "./form-renderer";

export const metadata: Metadata = { title: "Your form", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[80svh] items-center bg-night px-5 pb-16 pt-32 text-white">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-champagne/50 text-champagne">
          <Icon name="mail" className="h-8 w-8" />
        </div>
        <h1 className="mt-8 font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
        <div className="mt-5 leading-relaxed text-white/80">{children}</div>
      </div>
    </section>
  );
}

export default async function ApplicantFormPage({ params }: PageProps<"/forms/[token]">) {
  const { token } = await params;
  const [req, site] = await Promise.all([findFormRequestByToken(token), getSetting("site")]);
  const contact = site.contactEmail ? (
    <>
      {" "}
      You can reach us at{" "}
      <a href={`mailto:${site.contactEmail}`} className="text-champagne underline">
        {site.contactEmail}
      </a>
      .
    </>
  ) : null;

  if (!req) {
    return (
      <Notice title="This link isn't valid">
        <p>Please use the link in the most recent email we sent you. Links stop working when a new one is sent.{contact}</p>
      </Notice>
    );
  }
  if (req.state === "completed") {
    return (
      <Notice title="Thank you, it's done">
        <p>You&apos;ve already completed this form, so there&apos;s nothing more to do. We&apos;ve emailed you a copy of your answers.</p>
      </Notice>
    );
  }
  if (req.state !== "open") {
    return (
      <Notice title="This link has expired">
        <p>Please get in touch and we&apos;ll send you a new one.{contact}</p>
      </Notice>
    );
  }

  const uploads = await getSetting("uploads");
  return (
    <>
      <PageHero eyebrow={site.brandName} title={req.definition.title}>
        <p className="mt-4 max-w-xl text-white/80">
          Hello {req.applicantName}. {req.definition.intro} Fields marked <span className="text-champagne">*</span> are required.
        </p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="rounded-[4px] border border-line bg-paper px-5 py-2 sm:px-9 sm:py-4">
          <FormRenderer
            token={token}
            definition={req.definition}
            cvOnFile={req.cvOnFile}
            maxCvBytes={uploads.maxCvBytes}
            allowedCvTypes={uploads.allowedCvTypes}
            accept={uploads.allowedCvTypes.map((ext) => CV_ACCEPT_ATTR[ext]).join(",")}
          />
        </div>
        <p className="mt-4 text-sm text-muted">This link is personal to you and works until {formatDate(req.expiresAt)}.</p>
      </div>
    </>
  );
}
