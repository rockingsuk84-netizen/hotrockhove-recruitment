import { Card, Field, Input } from "@/components/ui";
import { getSetting } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../action-form";
import { saveSiteSettings } from "../actions";

export const metadata = { title: "Branding" };

export default async function GeneralSettingsPage() {
  await requireAdmin();
  const site = await getSetting("site");
  return (
    <Card className="p-5">
      <ActionForm action={saveSiteSettings}>
        <Field label="Brand name" htmlFor="brandName" required>
          <Input id="brandName" name="brandName" defaultValue={site.brandName} required maxLength={80} />
        </Field>
        <Field label="Tagline" htmlFor="tagline" hint="Shown on the jobs page and in search results.">
          <Input id="tagline" name="tagline" defaultValue={site.tagline} maxLength={160} />
        </Field>
        <Field label="Logo URL" htmlFor="logoUrl" hint="An https:// image URL, e.g. uploaded to your Cloudinary media library. Leave blank to show the brand name.">
          <Input id="logoUrl" name="logoUrl" type="url" defaultValue={site.logoUrl} placeholder="https://" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Primary colour" htmlFor="primaryColour" required hint="Header and main buttons.">
            <div className="flex gap-2">
              <input type="color" aria-label="Pick primary colour" defaultValue={site.primaryColour} className="h-11 w-14 rounded border border-stone-300" name="primaryColour" id="primaryColour" />
            </div>
          </Field>
          <Field label="Accent colour" htmlFor="accentColour" required hint="Apply buttons and highlights.">
            <input type="color" aria-label="Pick accent colour" defaultValue={site.accentColour} className="h-11 w-14 rounded border border-stone-300" name="accentColour" id="accentColour" />
          </Field>
        </div>
        <Field label="Public contact email" htmlFor="contactEmail" hint="Shown in the footer and used as the reply-to address on applicant emails.">
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={site.contactEmail} />
        </Field>
        <Field label="Footer text" htmlFor="footerText" hint="E.g. company registration details.">
          <Input id="footerText" name="footerText" defaultValue={site.footerText} maxLength={300} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Instagram URL" htmlFor="instagramUrl">
            <Input id="instagramUrl" name="instagramUrl" type="url" defaultValue={site.instagramUrl} placeholder="https://" />
          </Field>
          <Field label="LinkedIn URL" htmlFor="linkedinUrl">
            <Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={site.linkedinUrl} placeholder="https://" />
          </Field>
          <Field label="Facebook URL" htmlFor="facebookUrl">
            <Input id="facebookUrl" name="facebookUrl" type="url" defaultValue={site.facebookUrl} placeholder="https://" />
          </Field>
        </div>
        <p className="-mt-2 text-sm text-stone-500">Social icons appear in the footer only for the links you fill in.</p>
      </ActionForm>
    </Card>
  );
}
