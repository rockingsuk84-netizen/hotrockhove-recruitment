import Link from "next/link";
import { DepartmentCard, departmentShortName, JobCard } from "@/components/site/cards";
import { Icon } from "@/components/site/icons";
import { SiteImage } from "@/components/site/site-image";
import { getSetting } from "@/lib/settings";
import { listFeaturedJobs, listPublicDepartments } from "@/services/jobs";

/** Renders the configured highlight word(s) in the italic champagne accent. */
function HighlightedTitle({ title, highlight }: { title: string; highlight: string }) {
  const i = highlight ? title.toLowerCase().lastIndexOf(highlight.toLowerCase()) : -1;
  if (i < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, i)}
      <em className="font-normal italic text-champagne">{title.slice(i, i + highlight.length)}</em>
      {title.slice(i + highlight.length)}
    </>
  );
}

export default async function HomePage() {
  const [home, departments, featured] = await Promise.all([getSetting("homepage"), listPublicDepartments(), listFeaturedJobs(3)]);

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative isolate flex min-h-[600px] items-end overflow-hidden bg-night text-white sm:items-center md:h-[86svh] md:max-h-[780px] md:min-h-[620px]">
        <SiteImage
          src={home.heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[68%_center] md:object-center"
        />
        {/* Readability: strong on the left (text side), lighter over the subject. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/70 to-night/30 md:bg-gradient-to-r md:from-night/95 md:via-night/65 md:to-night/10" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-night/60 to-transparent" />

        <div className="mx-auto w-full max-w-7xl px-5 pb-14 pt-36 sm:px-8 md:pb-0 md:pt-24 lg:px-12">
          <div className="max-w-[46rem]">
            {home.heroEyebrow && <p className="eyebrow">{home.heroEyebrow}</p>}
            <h1 className="mt-5 max-w-[11ch] font-display text-[2.7rem] leading-[1.06] text-balance sm:text-6xl lg:max-w-none lg:text-[4.3rem]">
              <HighlightedTitle title={home.heroTitle} highlight={home.heroHighlight} />
            </h1>
            {home.heroText && <p className="mt-6 max-w-md text-base leading-relaxed text-white/85 sm:text-[1.05rem]">{home.heroText}</p>}
            <Link
              href="#vacancies"
              className="group mt-9 inline-flex w-full items-center justify-center gap-3 rounded-[4px] bg-champagne px-7 py-4 text-[0.95rem] font-semibold text-night shadow-[0_10px_30px_-12px_rgba(216,189,138,0.6)] transition hover:brightness-105 sm:w-auto sm:py-3.5"
            >
              {home.heroCta}
              <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------- Current vacancies */}
      <section id="vacancies" className="scroll-mt-20 bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="reveal flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              {home.vacanciesEyebrow && <p className="eyebrow eyebrow-dark">{home.vacanciesEyebrow}</p>}
              <h2 className="mt-3 font-display text-[2.1rem] leading-tight text-ink sm:text-[2.6rem]">{home.vacanciesTitle}</h2>
              {home.vacanciesText && <p className="mt-3 leading-relaxed text-muted">{home.vacanciesText}</p>}
            </div>
            <Link
              href="/jobs"
              className="group inline-flex w-fit shrink-0 items-center gap-2.5 rounded-[4px] border border-ink/20 px-5 py-2.5 text-sm font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-white"
            >
              View All Jobs <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>

          {departments.length > 0 && (
            <div className="reveal mt-10 grid gap-5 lg:grid-cols-2">
              {departments
                .filter((d) => d.slug)
                .map((d, i) => (
                  <DepartmentCard
                    key={d.id}
                    tone={i % 2 === 0 ? "forest" : "night"}
                    dept={{ slug: d.slug!, name: d.name, tagline: d.tagline, image: d.imageUrl, icon: d.icon, shortName: departmentShortName(d.name) }}
                  />
                ))}
            </div>
          )}

          {/* ---------------------------------------- Featured vacancies */}
          <div className="mt-16">
            <p className="eyebrow eyebrow-dark">Featured vacancies</p>
            {featured.length === 0 ? (
              <p className="mt-6 rounded-[4px] border border-line bg-paper p-8 text-center text-muted">
                There are no open vacancies at the moment. Please check back soon.
              </p>
            ) : (
              <ul className="reveal mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((job, i) => (
                  <li key={job.id} className={i === 2 ? "sm:max-lg:hidden" : undefined}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- Why join us */}
      <section className="relative isolate overflow-hidden bg-night py-16 text-white sm:py-20">
        {home.whyImage && <SiteImage src={home.whyImage} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-30" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1f19] via-[#0b1f19]/90 to-[#0b1f19]/75" />
        <div className="reveal mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:px-12">
          <div>
            {home.whyEyebrow && <p className="eyebrow">{home.whyEyebrow}</p>}
            <h2 className="mt-3 font-display text-[2.1rem] leading-tight sm:text-[2.5rem]">{home.whyTitle}</h2>
            {home.whyText && <p className="mt-4 max-w-md leading-relaxed text-white/85">{home.whyText}</p>}
          </div>
          {home.benefits.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-y-10 lg:flex-nowrap lg:justify-between">
              {home.benefits.map((b) => (
                <li
                  key={b.label}
                  className="flex w-1/2 flex-col items-center px-3 text-center sm:w-1/3 lg:w-auto lg:flex-1 lg:border-l lg:border-white/15 lg:first:border-l-0"
                >
                  <Icon name={b.icon} className="h-9 w-9 text-champagne" />
                  <span className="mt-4 max-w-[9rem] text-[0.82rem] leading-snug text-white/90">{b.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
