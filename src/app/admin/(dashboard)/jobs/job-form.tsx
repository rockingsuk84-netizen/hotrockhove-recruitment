"use client";

import { useActionState, useState } from "react";
import type { ApplicationQuestion } from "@/db/schema";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { saveJob, type JobFormState } from "./actions";

type Option = { id: string; name: string; active: boolean };

export type JobFormValues = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  standoutPrompt: string;
  locationId: string | null;
  departmentId: string | null;
  employmentTypeId: string | null;
  positionIds: string[];
  questions: ApplicationQuestion[];
  featured: boolean;
  imageUrl: string | null;
};

function makeQuestionId(label: string, existing: ApplicationQuestion[]) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "question";
  let id = base;
  for (let i = 2; existing.some((q) => q.id === id); i++) id = `${base}_${i}`;
  return id;
}

export function JobForm({
  initial,
  taxonomy,
}: {
  initial: JobFormValues;
  taxonomy: { locations: Option[]; departments: Option[]; employmentTypes: Option[]; positions: Option[] };
}) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(saveJob, {});
  const [questions, setQuestions] = useState<ApplicationQuestion[]>(initial.questions);
  const f = state.fields ?? {};

  const selectOptions = (opts: Option[], current: string | null) =>
    opts.filter((o) => o.active || o.id === current).map((o) => (
      <option key={o.id} value={o.id}>
        {o.name}
      </option>
    ));

  function updateQuestion(i: number, patch: Partial<ApplicationQuestion>) {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  }

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      <Card className="space-y-5 p-5">
        <h2 className="font-semibold text-stone-900">Basics</h2>
        <Field label="Job title" htmlFor="title" required error={f.title}>
          <Input id="title" name="title" defaultValue={initial.title} required maxLength={150} />
        </Field>
        <Field label="URL slug" htmlFor="slug" hint="Used in the public link /jobs/your-slug. Leave blank to generate from the title." error={f.slug}>
          <Input id="slug" name="slug" defaultValue={initial.slug} maxLength={80} />
        </Field>
        <Field
          label="Marketing summary"
          htmlFor="summary"
          hint="One sentence shown on job cards and at the top of the job page. Only restate what the job description already says: don't add duties, requirements, hours, pay or benefits here."
          error={f.summary}
        >
          <Textarea id="summary" name="summary" defaultValue={initial.summary} maxLength={400} rows={2} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Location" htmlFor="locationId">
            <Select id="locationId" name="locationId" defaultValue={initial.locationId ?? ""}>
              <option value="">—</option>
              {selectOptions(taxonomy.locations, initial.locationId)}
            </Select>
          </Field>
          <Field label="Department" htmlFor="departmentId">
            <Select id="departmentId" name="departmentId" defaultValue={initial.departmentId ?? ""}>
              <option value="">—</option>
              {selectOptions(taxonomy.departments, initial.departmentId)}
            </Select>
          </Field>
          <Field label="Employment type" htmlFor="employmentTypeId">
            <Select id="employmentTypeId" name="employmentTypeId" defaultValue={initial.employmentTypeId ?? ""}>
              <option value="">—</option>
              {selectOptions(taxonomy.employmentTypes, initial.employmentTypeId)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label="Card image"
            htmlFor="imageUrl"
            hint="/images/… from the project or an https:// image (e.g. Cloudinary). Leave blank to use the department image."
            error={f.imageUrl}
          >
            <Input id="imageUrl" name="imageUrl" defaultValue={initial.imageUrl ?? ""} placeholder="/images/bartender.jpg" />
          </Field>
          <label className="flex items-center gap-2 pb-3 text-sm font-medium text-stone-800">
            <input type="checkbox" name="featured" defaultChecked={initial.featured} className="h-4 w-4 accent-brand" />
            Feature on homepage
          </label>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-800">
            Roles applicants can choose <span className="font-normal text-stone-500">(optional)</span>
          </legend>
          <p className="mb-2 text-sm text-stone-500">If you select roles, applicants must pick one. Manage the list under Configuration → Lists.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {taxonomy.positions
              .filter((p) => p.active || initial.positionIds.includes(p.id))
              .map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-stone-800">
                  <input type="checkbox" name="positionIds" value={p.id} defaultChecked={initial.positionIds.includes(p.id)} className="h-4 w-4 accent-brand" />
                  {p.name}
                </label>
              ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-5 p-5">
        <h2 className="font-semibold text-stone-900">Job content</h2>
        <Field label="Description" htmlFor="description" hint="Separate paragraphs with a blank line." error={f.description}>
          <Textarea id="description" name="description" defaultValue={initial.description} rows={8} />
        </Field>
        <Field label="Responsibilities" htmlFor="responsibilities" hint="One per line." error={f.responsibilities}>
          <Textarea id="responsibilities" name="responsibilities" defaultValue={initial.responsibilities.join("\n")} rows={5} />
        </Field>
        <Field label="Requirements / who you are" htmlFor="requirements" hint="One per line. Use “Heading: detail” to bold the heading." error={f.requirements}>
          <Textarea id="requirements" name="requirements" defaultValue={initial.requirements.join("\n")} rows={8} />
        </Field>
        <Field label="Benefits" htmlFor="benefits" hint="One per line." error={f.benefits}>
          <Textarea id="benefits" name="benefits" defaultValue={initial.benefits.join("\n")} rows={5} />
        </Field>
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-semibold text-stone-900">Application questions</h2>
          <p className="mt-1 text-sm text-stone-600">
            Name, email, phone, CV and privacy consent are always collected. The stand-out question is always required.
          </p>
        </div>
        <Field label="Stand-out question" htmlFor="standoutPrompt" required error={f.standoutPrompt}>
          <Input id="standoutPrompt" name="standoutPrompt" defaultValue={initial.standoutPrompt} required maxLength={300} />
        </Field>

        {questions.map((q, i) => (
          <div key={q.id} className="rounded-md border border-stone-200 bg-stone-50 p-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label={`Question ${i + 1}`} htmlFor={`q-${q.id}`} required>
                <Input id={`q-${q.id}`} value={q.label} onChange={(e) => updateQuestion(i, { label: e.target.value })} maxLength={300} />
              </Field>
              <Field label="Answer type" htmlFor={`qt-${q.id}`} required>
                <Select id={`qt-${q.id}`} value={q.type} onChange={(e) => updateQuestion(i, { type: e.target.value as ApplicationQuestion["type"], maxLength: e.target.value === "long_text" ? 2000 : 200 })}>
                  <option value="short_text">Short answer</option>
                  <option value="long_text">Long answer</option>
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-stone-800">
                <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} className="h-4 w-4 accent-brand" />
                Required
              </label>
              <Button type="button" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                Remove question
              </Button>
            </div>
          </div>
        ))}
        {f.questions && <p className="text-sm font-medium text-red-700">Each question needs a label of at least 3 characters.</p>}
        {questions.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setQuestions((qs) => [...qs, { id: makeQuestionId(`question ${qs.length + 1}`, qs), label: "", type: "short_text", required: false, maxLength: 200 }])
            }
          >
            Add a question
          </Button>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create job"}
        </Button>
      </div>
    </form>
  );
}
