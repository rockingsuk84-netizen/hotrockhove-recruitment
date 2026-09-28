"use client";

import { useActionState, useState } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, cx, Field, Input, Select } from "@/components/ui";
import { saveQrCode, type QrFormState } from "./actions";

type JobOption = { id: string; title: string; status: string };
type PageOption = { path: string; label: string };

export type QrFormValues = {
  id?: string;
  label: string;
  targetType: "job" | "page";
  jobId: string;
  path: string;
  source: string;
};

const SOURCE_SUGGESTIONS = ["poster", "flyer", "window", "event", "instagram", "facebook", "tiktok", "linkedin"];

export function QrForm({
  initial,
  jobs,
  pages,
  submitLabel,
}: {
  initial: QrFormValues;
  jobs: JobOption[];
  pages: PageOption[];
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<QrFormState, FormData>(saveQrCode, {});
  const [targetType, setTargetType] = useState(initial.targetType);
  const knownPage = pages.some((p) => p.path === initial.path);
  const [pageChoice, setPageChoice] = useState(initial.path ? (knownPage ? initial.path : "custom") : "/");
  const f = state.fields ?? {};

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <Field label="Name" htmlFor="qr-label" required hint="For your reference, e.g. “Window poster – Bartender” or “Instagram bio”." error={f.label}>
        <Input id="qr-label" name="label" defaultValue={initial.label} required maxLength={80} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-stone-800">Where should the QR code go?</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["job", "A job"],
              ["page", "A page on the website"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2.5 text-sm",
                targetType === value ? "border-brand bg-stone-50 font-semibold" : "border-stone-300",
              )}
            >
              <input type="radio" name="targetType" value={value} checked={targetType === value} onChange={() => setTargetType(value)} className="accent-brand" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {targetType === "job" ? (
        <Field label="Job" htmlFor="qr-job" required error={f.jobId} hint="If the job is closed or unpublished, the code sends people to the jobs list instead.">
          <Select id="qr-job" name="jobId" defaultValue={initial.jobId} required>
            <option value="" disabled>
              Choose a job…
            </option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
                {j.status !== "published" ? ` (${j.status})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <>
          <Field label="Page" htmlFor="qr-page" required error={pageChoice === "custom" ? undefined : f.path}>
            <Select id="qr-page" name="pageChoice" value={pageChoice} onChange={(e) => setPageChoice(e.target.value)}>
              {pages.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.label} ({p.path})
                </option>
              ))}
              <option value="custom">Another page on this site…</option>
            </Select>
          </Field>
          {pageChoice === "custom" && (
            <Field label="Page address" htmlFor="qr-path" required hint="The part after your domain, starting with /, e.g. /jobs/bartender-hove" error={f.path}>
              <Input id="qr-path" name="customPath" defaultValue={knownPage ? "" : initial.path} placeholder="/" required />
            </Field>
          )}
        </>
      )}

      <Field
        label="Source tag"
        htmlFor="qr-source"
        hint="Shows on each application as where the applicant came from. Use lowercase words, e.g. poster, event, instagram."
        error={f.source}
      >
        <Input id="qr-source" name="source" defaultValue={initial.source} list="qr-source-suggestions" maxLength={40} />
        <datalist id="qr-source-suggestions">
          {SOURCE_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
