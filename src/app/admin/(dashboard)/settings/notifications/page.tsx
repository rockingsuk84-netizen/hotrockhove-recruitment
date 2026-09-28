import { Card, Field, Input, Textarea } from "@/components/ui";
import { getSetting } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../action-form";
import { saveNotificationSettings } from "../actions";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  await requireAdmin();
  const n = await getSetting("notifications");
  return (
    <Card className="p-5">
      {!process.env.RESEND_API_KEY && (
        <p className="mb-5 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          RESEND_API_KEY is not set in the environment, so emails are recorded but not delivered.
        </p>
      )}
      <ActionForm action={saveNotificationSettings}>
        <Field label="Admin notification recipients" htmlFor="adminRecipients" hint="One email address per line. Each receives an alert for every new application.">
          <Textarea id="adminRecipients" name="adminRecipients" defaultValue={n.adminRecipients.join("\n")} rows={3} />
        </Field>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" name="sendAdminNotification" defaultChecked={n.sendAdminNotification} className="h-4 w-4 accent-brand" />
            Send new-application alerts to admins
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input type="checkbox" name="sendApplicantConfirmation" defaultChecked={n.sendApplicantConfirmation} className="h-4 w-4 accent-brand" />
            Send confirmation emails to applicants
          </label>
        </div>
        <p className="text-sm text-stone-600">
          Placeholders: <code className="rounded bg-stone-100 px-1">{"{{applicantName}}"}</code>{" "}
          <code className="rounded bg-stone-100 px-1">{"{{jobTitle}}"}</code> <code className="rounded bg-stone-100 px-1">{"{{brandName}}"}</code>
        </p>
        <Field label="Applicant confirmation subject" htmlFor="applicantConfirmationSubject" required>
          <Input id="applicantConfirmationSubject" name="applicantConfirmationSubject" defaultValue={n.applicantConfirmationSubject} required maxLength={200} />
        </Field>
        <Field label="Applicant confirmation message" htmlFor="applicantConfirmationBody" required>
          <Textarea id="applicantConfirmationBody" name="applicantConfirmationBody" defaultValue={n.applicantConfirmationBody} required rows={9} maxLength={4000} />
        </Field>
        <Field label="Admin alert subject" htmlFor="adminNotificationSubject" required>
          <Input id="adminNotificationSubject" name="adminNotificationSubject" defaultValue={n.adminNotificationSubject} required maxLength={200} />
        </Field>
      </ActionForm>
    </Card>
  );
}
