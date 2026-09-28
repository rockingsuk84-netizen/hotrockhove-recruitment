import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/site/icons";

export const metadata: Metadata = { title: "Application received", robots: { index: false } };

export default function AppliedPage() {
  return (
    <section className="flex min-h-[80svh] items-center bg-night px-5 pb-16 pt-32 text-white">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-champagne/50 text-champagne">
          <Icon name="check" className="h-8 w-8" />
        </div>
        <p className="eyebrow mx-auto mt-8">Application received</p>
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">Thank you for applying</h1>
        <p className="mt-5 leading-relaxed text-white/80">
          We&apos;ve received your application and CV. A confirmation email is on its way. If you can&apos;t see it within a few minutes, please
          check your spam or junk folder.
        </p>
        <p className="mt-3 leading-relaxed text-white/80">Our team reviews every application and will be in touch if your experience is a good match.</p>
        <Link
          href="/jobs"
          className="group mt-10 inline-flex items-center gap-2 rounded-[4px] border border-white/25 px-6 py-3 text-sm font-medium transition hover:bg-white hover:text-night"
        >
          See other vacancies <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
