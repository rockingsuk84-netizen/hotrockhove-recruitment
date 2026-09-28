import { Card, Field, Input, Textarea } from "@/components/ui";
import { CV_FILE_TYPES, getSetting, MAX_UPLOAD_CEILING_BYTES } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../action-form";
import { savePrivacySettings } from "../actions";

export const metadata = { title: "Privacy & uploads" };

export default async function PrivacySettingsPage() {
  await requireAdmin();
  const [privacy, uploads] = await Promise.all([getSetting("privacy"), getSetting("uploads")]);
  return (
    <Card className="p-5">
      <p className="mb-5 rounded-md bg-sky-50 p-3 text-sm text-sky-900">
        These settings help you apply your own data-protection policies. They do not by themselves make the site compliant with UK GDPR — please
        confirm the wording and retention period with your legal adviser.
      </p>
      <ActionForm action={savePrivacySettings}>
        <h2 className="font-semibold text-stone-900">Privacy</h2>
        <Field label="Consent text on the application form" htmlFor="consentText" required hint="{{brandName}} is replaced with your brand name.">
          <Textarea id="consentText" name="consentText" defaultValue={privacy.consentText} required rows={4} maxLength={2000} />
        </Field>
        <Field label="Privacy Policy" htmlFor="privacyPolicy" required hint="Shown at /privacy. Separate sections with a blank line; a short first line becomes the heading.">
          <Textarea id="privacyPolicy" name="privacyPolicy" defaultValue={privacy.privacyPolicy} required rows={14} />
        </Field>
        <Field label="Terms of Use" htmlFor="terms" required hint="Shown at /terms.">
          <Textarea id="terms" name="terms" defaultValue={privacy.terms} required rows={10} />
        </Field>
        <Field
          label="Retention period (days)"
          htmlFor="retentionDays"
          hint="Applicants are erased automatically this many days after their latest application (hired applicants are kept). Leave blank to disable."
        >
          <Input id="retentionDays" name="retentionDays" type="number" min={30} max={3650} defaultValue={privacy.retentionDays ?? ""} className="max-w-40" />
        </Field>

        <h2 className="border-t border-stone-200 pt-5 font-semibold text-stone-900">CV uploads</h2>
        <Field label="Maximum CV size (MB)" htmlFor="maxCvMb" required hint={`Up to ${MAX_UPLOAD_CEILING_BYTES / (1024 * 1024)} MB (hosting request-size limit).`}>
          <Input
            id="maxCvMb"
            name="maxCvMb"
            type="number"
            step="0.1"
            min={0.1}
            max={MAX_UPLOAD_CEILING_BYTES / (1024 * 1024)}
            defaultValue={(uploads.maxCvBytes / (1024 * 1024)).toFixed(1)}
            className="max-w-40"
            required
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-800">Allowed file types</legend>
          <div className="flex gap-5">
            {CV_FILE_TYPES.map((ext) => (
              <label key={ext} className="flex items-center gap-2 text-sm text-stone-800">
                <input type="checkbox" name="allowedCvTypes" value={ext} defaultChecked={uploads.allowedCvTypes.includes(ext)} className="h-4 w-4 accent-brand" />
                {ext.toUpperCase()}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-stone-500">Files are checked by content, not just by name. Macro-enabled Word files are always rejected.</p>
        </fieldset>
      </ActionForm>
    </Card>
  );
}
