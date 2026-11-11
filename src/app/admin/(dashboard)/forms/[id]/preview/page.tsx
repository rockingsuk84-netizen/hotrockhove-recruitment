import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { FormRenderer } from "@/app/(public)/forms/[token]/form-renderer";
import { CV_ACCEPT_ATTR } from "@/lib/files";
import { getSetting } from "@/lib/settings";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Preview form" };

/** The form exactly as applicants see it. Submitting does nothing. */
export default async function PreviewFormPage({ params, searchParams }: PageProps<"/admin/forms/[id]/preview">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const form = await db.query.forms.findFirst({ where: eq(t.forms.id, id) });
  if (!form) notFound();

  const cvOnFile = sp.cv === "yes";
  const hasCvField = form.definition.fields.some((f) => f.type === "cv_upload");
  const [site, uploads] = await Promise.all([getSetting("site"), getSetting("uploads")]);
  const def = form.definition;

  return (
    <>
      <Link href={`/admin/forms/${id}`} className="text-sm font-medium text-stone-600 hover:text-stone-900">
        ← {form.title}
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Preview"
          description="This is exactly what applicants see. Try the questions; submitting here saves and sends nothing."
          actions={form.status === "active" && <LinkButton href={`/admin/forms/${id}/send`}>Send to applicants</LinkButton>}
        />
      </div>

      {hasCvField && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-600">Show as an applicant who:</span>
          <Link
            href={`/admin/forms/${id}/preview`}
            aria-current={!cvOnFile ? "page" : undefined}
            className={!cvOnFile ? "rounded-full bg-stone-900 px-3 py-1.5 font-medium text-white" : "rounded-full bg-white px-3 py-1.5 font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"}
          >
            hasn&apos;t sent a CV
          </Link>
          <Link
            href={`/admin/forms/${id}/preview?cv=yes`}
            aria-current={cvOnFile ? "page" : undefined}
            className={cvOnFile ? "rounded-full bg-stone-900 px-3 py-1.5 font-medium text-white" : "rounded-full bg-white px-3 py-1.5 font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"}
          >
            already has a CV on file
          </Link>
        </div>
      )}

      {def.reviewOptions.length > 0 && (
        <div className="mb-4">
          <Alert tone="info">
            Staff-only outcome options (applicants never see these): {def.reviewOptions.join(", ")}.
          </Alert>
        </div>
      )}

      {/* Mirrors the public page's header and card so the preview looks the same. */}
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-cream shadow-sm">
        <div className="bg-night px-5 py-8 text-white sm:px-9">
          <p className="eyebrow">{site.brandName}</p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{def.title}</h2>
          <p className="mt-3 max-w-xl text-white/80">
            Hello [applicant name]. {def.intro} Fields marked <span className="text-champagne">*</span> are required.
          </p>
        </div>
        <div className="px-3 py-6 sm:px-8">
          <div className="rounded-[4px] border border-line bg-paper px-5 py-2 sm:px-9 sm:py-4">
            <FormRenderer
              key={cvOnFile ? "cv" : "no-cv"}
              token="preview"
              preview
              definition={def}
              cvOnFile={cvOnFile}
              maxCvBytes={uploads.maxCvBytes}
              allowedCvTypes={uploads.allowedCvTypes}
              accept={uploads.allowedCvTypes.map((ext) => CV_ACCEPT_ATTR[ext]).join(",")}
            />
          </div>
        </div>
      </div>
    </>
  );
}
