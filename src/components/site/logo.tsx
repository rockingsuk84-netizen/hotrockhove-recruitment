import Link from "next/link";
import { cx } from "@/components/ui";

/** Two-line wordmark: first word large, the rest small and widely tracked ("HOTROCK / RECRUITMENT"). */
export function Logo({ brandName, logoUrl, className }: { brandName: string; logoUrl?: string; className?: string }) {
  const [first, ...rest] = brandName.trim().split(/\s+/);
  return (
    <Link href="/" className={cx("inline-flex flex-col leading-none text-white", className)} aria-label={`${brandName} home`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-configured logo, any host
        <img src={logoUrl} alt="" className="h-9 w-auto" />
      ) : (
        <>
          <span className="font-display text-[1.45rem] font-medium uppercase tracking-[0.14em]">{first}</span>
          {rest.length > 0 && (
            <span className="mt-1.5 text-[0.58rem] font-medium uppercase tracking-[0.42em] text-white/75">{rest.join(" ")}</span>
          )}
        </>
      )}
    </Link>
  );
}
