import Link from "next/link";
import { Icon } from "@/components/site/icons";

export default function NotFound() {
  return (
    <section className="flex min-h-[70svh] items-center bg-night px-5 pb-16 pt-32 text-white">
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow mx-auto">Page not found</p>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">This role may have closed</h1>
        <p className="mt-4 text-white/75">The link may be out of date, or the vacancy has been filled.</p>
        <Link href="/jobs" className="group mt-9 inline-flex items-center gap-2 rounded-[4px] bg-champagne px-6 py-3.5 text-sm font-semibold text-night">
          View current vacancies <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
