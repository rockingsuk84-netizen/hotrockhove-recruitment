import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSetting } from "@/lib/settings";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const site = await getSetting("site");
  return (
    <>
      <SiteHeader brandName={site.brandName} logoUrl={site.logoUrl || undefined} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter site={site} />
    </>
  );
}
