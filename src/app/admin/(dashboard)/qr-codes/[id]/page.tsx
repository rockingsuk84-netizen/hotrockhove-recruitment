import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { Button, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { qrDataUrl, qrShortUrl } from "@/lib/qr";
import { requireStaff } from "@/lib/session";
import { getQrCode, pageTargetOptions } from "@/services/qr-codes";
import { deleteQrCode, setQrActive } from "../actions";
import { DeleteQrButton } from "./delete-button";
import { QrForm } from "../qr-form";

export const metadata = { title: "Edit QR code" };

export default async function EditQrPage({ params }: PageProps<"/admin/qr-codes/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const row = await getQrCode(id);
  if (!row) notFound();
  const { qr } = row;

  const [jobs, pages, preview] = await Promise.all([
    db.select({ id: t.jobs.id, title: t.jobs.title, status: t.jobs.status }).from(t.jobs).orderBy(asc(t.jobs.title)),
    pageTargetOptions(),
    qrDataUrl(qrShortUrl(qr.code)),
  ]);

  return (
    <>
      <Link href="/admin/qr-codes" className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← All QR codes
      </Link>
      <div className="mt-3">
        <PageHeader title={qr.label} description="Changing the destination keeps the same code, so posters you've already printed follow the change." />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-5">
          <QrForm
            submitLabel="Save changes"
            jobs={jobs}
            pages={pages}
            initial={{ id: qr.id, label: qr.label, targetType: qr.targetType, jobId: qr.jobId ?? "", path: qr.path ?? "", source: qr.source ?? "" }}
          />
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img src={preview} alt={`QR code: ${qr.label}`} width={220} height={220} className="mx-auto rounded border border-stone-200" />
            <p className="mt-3 break-all text-xs text-stone-500">{qrShortUrl(qr.code)}</p>
            <p className="mt-1 text-xs text-stone-500">
              {qr.scanCount} scans{qr.lastScannedAt ? ` · last ${formatDateTime(qr.lastScannedAt)}` : ""}
            </p>
            <div className="mt-4 flex justify-center gap-4 text-sm font-semibold">
              <a className="text-brand hover:underline" href={`/api/admin/qr/${qr.id}?format=png`}>
                Download PNG
              </a>
              <a className="text-brand hover:underline" href={`/api/admin/qr/${qr.id}?format=svg`}>
                Download SVG
              </a>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-semibold text-stone-900">Status</h2>
            <p className="text-sm text-stone-600">
              {qr.active ? "Active: scans go to the destination above." : "Inactive: scans go to the homepage."}
            </p>
            <form action={setQrActive.bind(null, qr.id, !qr.active)}>
              <Button type="submit" variant="secondary" className="w-full">
                {qr.active ? "Deactivate" : "Reactivate"}
              </Button>
            </form>
            <form action={deleteQrCode.bind(null, qr.id)}>
              <DeleteQrButton />
            </form>
          </Card>
        </aside>
      </div>
    </>
  );
}
