import { count, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { Card } from "@/components/ui";
import { getSetting, toPublicStorageSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../action-form";
import { storageFormAction } from "../actions";
import { StorageFields } from "./storage-fields";

export const metadata = { title: "File storage" };

export default async function StorageSettingsPage() {
  await requireAdmin();
  // Secrets never leave the server: the client only learns whether one is set.
  const settings = toPublicStorageSettings(await getSetting("storage"));
  const usage = await db
    .select({ provider: t.documents.storageProvider, n: count() })
    .from(t.documents)
    .where(isNull(t.documents.deletedAt))
    .groupBy(t.documents.storageProvider);

  return (
    <Card className="p-5">
      <ActionForm action={storageFormAction} submitLabel="Save storage settings" secondaryLabel="Test connection">
        <StorageFields settings={settings} allowLocal={process.env.ALLOW_LOCAL_STORAGE === "true"} />
      </ActionForm>
      {usage.length > 0 && (
        <p className="mt-6 border-t border-stone-200 pt-4 text-sm text-stone-600">
          Stored documents: {usage.map((u) => `${u.n} in ${u.provider}`).join(", ")}. Existing documents stay with the provider they were uploaded to,
          so keep the credentials of a previous provider in place until those files are no longer needed.
        </p>
      )}
    </Card>
  );
}
