import Link from "next/link";
import { Icon } from "./icons";
import { SiteImage } from "./site-image";

export type JobCardData = {
  slug: string;
  title: string;
  summary: string;
  image: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
};

export function JobCard({ job, priority = false }: { job: JobCardData; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[4px] border border-line bg-paper transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(14,26,22,0.45)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-night">
        <SiteImage
          src={job.image}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <div className="relative flex flex-1 flex-col px-6 pb-6 pt-7">
        {job.department && (
          <span className="absolute -top-3 left-6 rounded-[2px] bg-[#efe3cb] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#6e5427]">
            {job.department}
          </span>
        )}
        <h3 className="font-display text-[1.45rem] leading-snug text-ink">
          {/* Whole card is clickable via the stretched link; the button below is the visible CTA. */}
          <Link href={`/jobs/${job.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {job.title}
          </Link>
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          {job.location && (
            <li className="flex items-center gap-2.5">
              <Icon name="pin" className="h-4 w-4 shrink-0 text-ink/70" />
              {job.location}
            </li>
          )}
          {job.employmentType && (
            <li className="flex items-center gap-2.5">
              <Icon name="briefcase" className="h-4 w-4 shrink-0 text-ink/70" />
              {job.employmentType}
            </li>
          )}
        </ul>
        {job.summary && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted">{job.summary}</p>}
        <span
          aria-hidden="true"
          className="mt-6 inline-flex w-fit items-center gap-2.5 rounded-[3px] bg-forest px-4 py-2.5 text-[0.8rem] font-semibold text-white transition group-hover:bg-night group-has-[a:focus-visible]:outline-2 group-has-[a:focus-visible]:outline-champagne"
        >
          View Details <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

export type DepartmentCardData = {
  slug: string;
  name: string;
  tagline: string;
  image: string | null;
  icon: string | null;
  shortName: string;
};

export function DepartmentCard({ dept, tone }: { dept: DepartmentCardData; tone: "forest" | "night" }) {
  const base = tone === "forest" ? "from-forest via-forest/90" : "from-night via-night/90";
  return (
    <Link
      href={`/jobs?department=${dept.slug}`}
      className={`group relative flex min-h-[200px] overflow-hidden rounded-[4px] sm:min-h-[210px] ${tone === "forest" ? "bg-forest" : "bg-night"}`}
    >
      {dept.image && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-[62%]">
          <SiteImage src={dept.image} alt="" fill sizes="(min-width: 1024px) 380px, 70vw" className="object-cover transition duration-700 group-hover:scale-105" />
        </div>
      )}
      <div className={`absolute inset-0 bg-gradient-to-r ${base} to-transparent sm:via-45% sm:to-75%`} />
      <div className="absolute inset-0 bg-night/35 sm:hidden" />
      <div className="relative flex flex-col justify-between p-7 text-white sm:max-w-[62%] sm:p-8">
        <div>
          {dept.icon && <Icon name={dept.icon} className="h-9 w-9 text-champagne" />}
          <h3 className="mt-4 font-display text-[1.75rem] leading-tight">{dept.name}</h3>
          {dept.tagline && <p className="mt-2 max-w-[16rem] text-[0.95rem] leading-relaxed text-white/85">{dept.tagline}</p>}
        </div>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium">
          View {dept.shortName} roles <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

/** Dark title band used by inner pages so the transparent header always sits on a dark background. */
export function PageHero({ eyebrow, title, children, image }: { eyebrow?: string; title: string; children?: React.ReactNode; image?: string }) {
  return (
    <section className="relative overflow-hidden bg-night pb-14 pt-32 text-white sm:pb-16 sm:pt-40">
      {image && (
        <>
          <SiteImage src={image} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/40" />
        </>
      )}
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.1] sm:text-5xl">{title}</h1>
        {children}
      </div>
    </section>
  );
}

/** Short label for "View FOH roles" style links: initials for multi-word names (Front of House → FOH). */
export function departmentShortName(name: string) {
  const words = name.split(/\s+/).filter((w) => w !== "&");
  return words.length > 1 ? words.map((w) => w[0]!.toUpperCase()).join("") : name;
}
