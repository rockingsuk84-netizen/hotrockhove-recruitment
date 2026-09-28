import type { Metadata } from "next";
import Link from "next/link";
import { JobCard, PageHero } from "@/components/site/cards";
import { cx } from "@/components/ui";
import { listPublicDepartments, listPublishedJobs } from "@/services/jobs";

export const metadata: Metadata = { title: "Jobs", description: "Current hospitality vacancies." };

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const sp = await searchParams;
  const departments = (await listPublicDepartments()).filter((d) => d.slug);
  const selected = typeof sp.department === "string" ? departments.find((d) => d.slug === sp.department) : undefined;
  const jobs = await listPublishedJobs({ departmentSlug: selected?.slug ?? undefined });

  const chip = (active: boolean) =>
    cx(
      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
      active ? "border-ink bg-ink text-white" : "border-ink/15 bg-paper text-ink hover:border-ink/40",
    );

  return (
    <>
      <PageHero eyebrow="Current vacancies" title={selected ? `${selected.name} roles` : "Find Your Next Opportunity"} image="/images/why-join.jpg">
        <p className="mt-4 max-w-xl leading-relaxed text-white/80">
          {selected?.tagline || "Explore our open Front of House and Back of House roles and apply in a few minutes — no account needed."}
        </p>
      </PageHero>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        {departments.length > 1 && (
          <nav aria-label="Filter by department" className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-2.5">
              <li>
                <Link href="/jobs" className={chip(!selected)} aria-current={!selected ? "page" : undefined}>
                  All roles
                </Link>
              </li>
              {departments.map((d) => (
                <li key={d.id}>
                  <Link href={`/jobs?department=${d.slug}`} className={chip(selected?.id === d.id)} aria-current={selected?.id === d.id ? "page" : undefined}>
                    {d.name}
                    <span className="text-xs opacity-60">{d.jobs}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {jobs.length === 0 ? (
          <p className="mt-8 rounded-[4px] border border-line bg-paper p-10 text-center text-muted">
            There are no open vacancies here at the moment. Please check back soon.
          </p>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job, i) => (
              <li key={job.id}>
                <JobCard job={job} priority={i < 3} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
