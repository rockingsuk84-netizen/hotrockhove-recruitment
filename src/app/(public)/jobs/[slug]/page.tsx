import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { Icon } from "@/components/site/icons";
import { SiteImage } from "@/components/site/site-image";
import { normaliseSource } from "@/lib/qr";
import { getPublishedJobBySlug } from "@/services/jobs";

export async function generateMetadata({ params }: PageProps<"/jobs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublishedJobBySlug(slug);
  if (!data) return { title: "Job not found" };
  return {
    title: data.job.title,
    description: data.job.summary,
    alternates: { canonical: `/jobs/${data.job.slug}` },
    openGraph: { title: data.job.title, description: data.job.summary, type: "website", images: [data.image] },
  };
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display text-[1.7rem] text-ink">{title}</h2>
      <ul className="mt-5 space-y-3.5">
        {items.map((item, i) => {
          const [lead, ...rest] = item.split(": ");
          return (
            <li key={i} className="flex gap-3.5 leading-relaxed text-ink/80">
              <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-[#9a7b45]" />
              <span>
                {rest.length ? (
                  <>
                    <strong className="font-semibold text-ink">{lead}:</strong> {rest.join(": ")}
                  </>
                ) : (
                  item
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ApplyButton({ href, className = "" }: { href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-[4px] bg-champagne px-7 py-4 text-[0.95rem] font-semibold text-night transition hover:brightness-105 ${className}`}
    >
      Apply Now <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
    </Link>
  );
}

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getPublishedJobBySlug(slug);
  if (!data) notFound();
  const { job, positions } = data;

  // Source attribution from QR codes (?source=poster). Visit counting never blocks rendering.
  const source = normaliseSource(typeof sp.source === "string" ? sp.source : "");
  if (source) {
    after(() =>
      db
        .update(t.jobQrCodes)
        .set({ scanCount: sql`${t.jobQrCodes.scanCount} + 1` })
        .where(and(eq(t.jobQrCodes.jobId, job.id), eq(t.jobQrCodes.source, source)))
        .catch(() => undefined),
    );
  }
  const applyHref = `/jobs/${job.slug}/apply${source ? `?source=${source}` : ""}`;

  const facts = [
    data.location && { icon: "pin", label: "Location", value: data.location },
    data.employmentType && { icon: "briefcase", label: "Hours", value: data.employmentType },
    data.department && { icon: "home", label: "Department", value: data.department },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  return (
    <article className="pb-24 lg:pb-0">
      {/* Hero: everything an applicant arriving from a QR code needs, above the fold. */}
      <header className="relative isolate overflow-hidden bg-night text-white">
        <SiteImage src={data.image} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/80 to-night/45 md:bg-gradient-to-r md:from-night md:via-night/80 md:to-night/30" />
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-32 sm:px-8 sm:pb-16 sm:pt-40 lg:px-12">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <Icon name="arrow" className="h-4 w-4 rotate-180" /> All jobs
          </Link>
          {data.department && <p className="eyebrow mt-6">{data.department}</p>}
          <h1 className="mt-4 max-w-3xl font-display text-[2.5rem] leading-[1.08] sm:text-6xl">{job.title}</h1>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            {facts.slice(0, 2).map((f) => (
              <li key={f.label} className="flex items-center gap-2">
                <Icon name={f.icon} className="h-4 w-4 text-champagne" />
                {f.value}
              </li>
            ))}
          </ul>
          {job.summary && <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/85">{job.summary}</p>}
          <ApplyButton href={applyHref} className="mt-8 w-full sm:w-auto" />
          <p className="mt-3 text-xs text-white/60">Takes about 3 minutes · No account needed</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-12">
        <div className="max-w-3xl">
          {job.description && (
            <div className="prose-job text-[1.05rem] leading-relaxed text-ink/80">
              {job.description.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}

          {positions.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-[1.7rem] text-ink">Roles we are hiring for</h2>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {positions.map((p) => (
                  <li key={p.id} className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm text-ink">
                    {p.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Section title="Responsibilities" items={job.responsibilities} />
          <Section title="Who you are" items={job.requirements} />
          <Section title="What we offer" items={job.benefits} />

          <section className="mt-14 rounded-[4px] bg-forest p-8 text-white sm:p-10">
            <p className="eyebrow">Ready to apply?</p>
            <h2 className="mt-3 font-display text-3xl">Join the team</h2>
            <p className="mt-3 max-w-lg leading-relaxed text-white/80">
              Upload your CV and tell us the single quality that makes you stand out in a high-pressure environment.
            </p>
            <ApplyButton href={applyHref} className="mt-7 w-full sm:w-auto" />
          </section>
        </div>

        {/* Desktop: sticky summary with the Apply CTA always in reach. */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 rounded-[4px] border border-line bg-paper p-7">
            <h2 className="font-display text-xl text-ink">{job.title}</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {facts.map((f) => (
                <div key={f.label} className="flex gap-3">
                  <Icon name={f.icon} className="mt-0.5 h-4 w-4 shrink-0 text-[#9a7b45]" />
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted">{f.label}</dt>
                    <dd className="mt-0.5 text-ink">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <ApplyButton href={applyHref} className="mt-7 w-full" />
            <p className="mt-3 text-center text-xs text-muted">No account needed</p>
          </div>
        </aside>
      </div>

      {/* Mobile: persistent Apply bar for visitors arriving from a QR code. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
        <ApplyButton href={applyHref} className="w-full !py-3.5" />
      </div>
    </article>
  );
}
