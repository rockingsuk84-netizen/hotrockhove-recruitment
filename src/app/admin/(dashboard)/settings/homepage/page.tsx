import { Card, Field, Input, Textarea } from "@/components/ui";
import { BENEFIT_ICONS, getSetting } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../action-form";
import { saveHomepageSettings } from "../actions";

export const metadata = { title: "Homepage" };

const IMAGE_HINT = "/images/… from the project, or an https:// image such as a Cloudinary URL.";

export default async function HomepageSettingsPage() {
  await requireAdmin();
  const h = await getSetting("homepage");
  return (
    <Card className="p-5">
      <p className="mb-5 text-sm text-stone-600">
        Jobs, departments and featured vacancies on the homepage come from Jobs and Configuration → Lists. This page controls the surrounding text
        and imagery.
      </p>
      <ActionForm action={saveHomepageSettings}>
        <h2 className="font-semibold text-stone-900">Hero</h2>
        <Field label="Eyebrow" htmlFor="heroEyebrow">
          <Input id="heroEyebrow" name="heroEyebrow" defaultValue={h.heroEyebrow} maxLength={80} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field label="Headline" htmlFor="heroTitle" required>
            <Input id="heroTitle" name="heroTitle" defaultValue={h.heroTitle} required maxLength={120} />
          </Field>
          <Field label="Italic highlight" htmlFor="heroHighlight" hint="Word(s) from the headline shown in gold italics.">
            <Input id="heroHighlight" name="heroHighlight" defaultValue={h.heroHighlight} maxLength={60} />
          </Field>
        </div>
        <Field label="Supporting text" htmlFor="heroText">
          <Textarea id="heroText" name="heroText" defaultValue={h.heroText} rows={3} maxLength={400} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Button label" htmlFor="heroCta" required>
            <Input id="heroCta" name="heroCta" defaultValue={h.heroCta} required maxLength={40} />
          </Field>
          <Field label="Hero image" htmlFor="heroImage" required hint={IMAGE_HINT}>
            <Input id="heroImage" name="heroImage" defaultValue={h.heroImage} required />
          </Field>
        </div>

        <h2 className="border-t border-stone-200 pt-5 font-semibold text-stone-900">Current vacancies</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Eyebrow" htmlFor="vacanciesEyebrow">
            <Input id="vacanciesEyebrow" name="vacanciesEyebrow" defaultValue={h.vacanciesEyebrow} maxLength={80} />
          </Field>
          <Field label="Title" htmlFor="vacanciesTitle" required>
            <Input id="vacanciesTitle" name="vacanciesTitle" defaultValue={h.vacanciesTitle} required maxLength={120} />
          </Field>
        </div>
        <Field label="Introduction" htmlFor="vacanciesText">
          <Textarea id="vacanciesText" name="vacanciesText" defaultValue={h.vacanciesText} rows={3} maxLength={400} />
        </Field>

        <h2 className="border-t border-stone-200 pt-5 font-semibold text-stone-900">Why join us</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Eyebrow" htmlFor="whyEyebrow">
            <Input id="whyEyebrow" name="whyEyebrow" defaultValue={h.whyEyebrow} maxLength={80} />
          </Field>
          <Field label="Title" htmlFor="whyTitle" required>
            <Input id="whyTitle" name="whyTitle" defaultValue={h.whyTitle} required maxLength={120} />
          </Field>
        </div>
        <Field label="Text" htmlFor="whyText">
          <Textarea id="whyText" name="whyText" defaultValue={h.whyText} rows={3} maxLength={400} />
        </Field>
        <Field label="Background image" htmlFor="whyImage" hint={IMAGE_HINT}>
          <Input id="whyImage" name="whyImage" defaultValue={h.whyImage} />
        </Field>
        <Field
          label="Benefits"
          htmlFor="benefits"
          hint={`One per line as "icon | label". Icons: ${BENEFIT_ICONS.join(", ")}.`}
        >
          <Textarea id="benefits" name="benefits" defaultValue={h.benefits.map((b) => `${b.icon} | ${b.label}`).join("\n")} rows={6} className="font-mono text-xs" />
        </Field>

        <h2 className="border-t border-stone-200 pt-5 font-semibold text-stone-900">About page</h2>
        <Field label="Title" htmlFor="aboutTitle" required>
          <Input id="aboutTitle" name="aboutTitle" defaultValue={h.aboutTitle} required maxLength={120} />
        </Field>
        <Field label="Text" htmlFor="aboutText" hint="Separate paragraphs with a blank line; a short first line becomes a heading.">
          <Textarea id="aboutText" name="aboutText" defaultValue={h.aboutText} rows={10} />
        </Field>
      </ActionForm>
    </Card>
  );
}
