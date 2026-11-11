"use client";

import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/site/icons";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  confirmInputName,
  CV_INPUT,
  gridInputName,
  inputName,
  isShown,
  type Answers,
  type FormDefinition,
  type FormField,
} from "@/lib/forms/definition";

type Props = {
  token: string;
  definition: FormDefinition;
  cvOnFile: boolean;
  maxCvBytes: number;
  allowedCvTypes: string[];
  accept: string;
  /** Staff preview: everything works except submitting, which saves and sends nothing. */
  preview?: boolean;
};

const choiceBox = "h-5 w-5 shrink-0 rounded border-stone-400 accent-forest";

function describedBy(name: string, errors: Record<string, string>, hint = false) {
  if (errors[name]) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? (
    <p id={`${name}-error`} className="mt-1.5 text-sm font-medium text-red-700">
      {errors[name]}
    </p>
  ) : null;
}

/** Group label for radio/checkbox sets, matching the shared Field style. */
function Legend({ field, required }: { field: FormField; required: boolean }) {
  return (
    <legend className="mb-1.5 block text-sm font-medium text-stone-800">
      {field.label}
      {required ? <span className="text-red-700"> *</span> : <span className="font-normal text-stone-500"> (optional)</span>}
      {field.help && <span className="mt-0.5 block font-normal text-stone-500">{field.help}</span>}
    </legend>
  );
}

export function FormRenderer(props: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Answers that other fields depend on, so conditional questions appear as the applicant types.
  const [controls, setControls] = useState<Answers>({});

  const maxMb = (props.maxCvBytes / (1024 * 1024)).toFixed(props.maxCvBytes % (1024 * 1024) ? 1 : 0);
  const typesLabel = props.allowedCvTypes.map((t) => t.toUpperCase()).join(", ");
  const controlling = new Set(props.definition.fields.flatMap((f) => (f.showIf ? [f.showIf.field] : [])));

  function readControls(form: HTMLFormElement) {
    const data = new FormData(form);
    const next: Answers = {};
    for (const id of controlling) {
      const values = data.getAll(inputName(id)).filter((v): v is string => typeof v === "string");
      next[id] = values.length > 1 ? values : (values[0] ?? "");
    }
    setControls(next);
  }

  function focusFirstError(fields: Record<string, string>) {
    const first = Object.keys(fields)[0];
    formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (props.preview) {
      setFormError("This is a preview. Nothing was saved or sent.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const data = new FormData(e.currentTarget);

    // Friendly checks only; the server validates everything again.
    const cv = data.get(CV_INPUT);
    if (cv instanceof File && cv.size > 0) {
      const clientErrors: Record<string, string> = {};
      if (cv.size > props.maxCvBytes) clientErrors[CV_INPUT] = `Your CV must be ${maxMb} MB or smaller.`;
      else if (!props.allowedCvTypes.includes(cv.name.split(".").pop()?.toLowerCase() ?? "")) {
        clientErrors[CV_INPUT] = `Please upload your CV as one of: ${typesLabel}.`;
      }
      if (Object.keys(clientErrors).length) {
        setErrors(clientErrors);
        focusFirstError(clientErrors);
        return;
      }
    } else {
      data.delete(CV_INPUT);
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(props.token)}`, { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: Record<string, string> };
      if (res.ok && body.ok) {
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors(body.fields ?? {});
      setFormError(body.error ?? "Something went wrong. Please try again.");
      if (body.fields && Object.keys(body.fields).length) focusFirstError(body.fields);
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="py-10 text-center" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Icon name="check" className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-3xl text-ink">Thank you</h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          We&apos;ve received your answers and emailed you a copy. If you can&apos;t see it within a few minutes, please check your spam or junk folder.
        </p>
      </div>
    );
  }

  function render(f: FormField) {
    const name = inputName(f.id);
    const err = errors[name];
    switch (f.type) {
      case "heading":
        return (
          <div key={f.id} className="border-b border-line pb-2 pt-4">
            <h2 className="font-display text-2xl text-ink">{f.label}</h2>
            {f.help && <p className="mt-1 text-sm text-muted">{f.help}</p>}
          </div>
        );
      case "short_text":
      case "long_text":
      case "date": {
        const Control = f.type === "long_text" ? Textarea : Input;
        return (
          <Field key={f.id} label={f.label} htmlFor={name} required={f.required} error={err} hint={f.help}>
            <Control
              id={name}
              name={name}
              type={f.type === "date" ? "date" : undefined}
              required={f.required}
              maxLength={f.type === "date" ? undefined : f.maxLength}
              rows={f.type === "long_text" ? 5 : undefined}
              aria-invalid={!!err}
              aria-describedby={describedBy(name, errors, !!f.help)}
            />
          </Field>
        );
      }
      case "choice":
        if (f.display === "dropdown" && !f.multiple) {
          return (
            <Field key={f.id} label={f.label} htmlFor={name} required={f.required} error={err} hint={f.help}>
              <Select id={name} name={name} required={f.required} defaultValue="" aria-invalid={!!err} aria-describedby={describedBy(name, errors, !!f.help)}>
                <option value="" disabled={f.required}>
                  Choose…
                </option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          );
        }
      // falls through
      case "yes_no": {
        const multiple = f.type === "choice" && f.multiple;
        const options = f.type === "yes_no" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : f.options;
        return (
          <fieldset key={f.id} aria-describedby={describedBy(name, errors)}>
            <Legend field={f} required={f.required} />
            <div className={f.type === "yes_no" ? "flex gap-6" : "space-y-2"}>
              {options.map((o) => (
                <label key={o.value} className="flex items-center gap-3 text-stone-800">
                  <input type={multiple ? "checkbox" : "radio"} name={name} value={o.value} className={choiceBox} aria-invalid={!!err} />
                  {o.label}
                </label>
              ))}
            </div>
            <FieldError name={name} errors={errors} />
          </fieldset>
        );
      }
      case "availability_grid":
        return (
          <fieldset key={f.id} aria-describedby={describedBy(name, errors)}>
            <Legend field={f} required={f.required} />
            <div className="overflow-x-auto rounded-[4px] border border-line">
              <table className="w-full text-sm">
                <thead className="bg-cream text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-semibold text-ink">
                      <span className="sr-only">Day</span>
                    </th>
                    {f.columns.map((c) => (
                      <th key={c.value} scope="col" className="px-2 py-2.5 text-center font-semibold text-ink">
                        {c.label}
                        {c.hint && <span className="block text-xs font-normal text-muted">{c.hint}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {f.rows.map((r) => (
                    <tr key={r.value}>
                      <th scope="row" className="px-3 py-2.5 text-left font-medium text-stone-800">
                        {r.label}
                      </th>
                      {f.columns.map((c) => (
                        <td key={c.value} className="px-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            name={gridInputName(f.id, r.value)}
                            value={c.value}
                            aria-label={`${r.label} ${c.label}`}
                            className={`${choiceBox} inline-block`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <FieldError name={name} errors={errors} />
          </fieldset>
        );
      case "cv_upload": {
        const cvErr = errors[CV_INPUT];
        const hint = `${typesLabel}, up to ${maxMb} MB.`;
        return (
          <div key={f.id}>
            {props.cvOnFile && (
              <div className="mb-3 flex items-start gap-3 rounded-[4px] border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-stone-800">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
                <span>We already have your CV, so you don&apos;t need to upload it again. You can upload a newer one below if you like.</span>
              </div>
            )}
            <Field label={props.cvOnFile ? "Upload a newer CV" : f.label} htmlFor={CV_INPUT} required={!props.cvOnFile} error={cvErr} hint={hint}>
              <input
                id={CV_INPUT}
                name={CV_INPUT}
                type="file"
                accept={props.accept}
                required={!props.cvOnFile}
                aria-invalid={!!cvErr}
                aria-describedby={describedBy(CV_INPUT, errors, true)}
                className="block w-full rounded-[4px] border border-stone-300 bg-white text-sm text-stone-700 file:mr-4 file:border-0 file:bg-cream file:px-4 file:py-3 file:font-semibold file:text-ink hover:file:bg-line aria-[invalid=true]:border-red-600"
              />
            </Field>
          </div>
        );
      }
      case "signature": {
        const confirm = confirmInputName(f.id);
        return (
          <div key={f.id} className="space-y-4 border-t border-line pt-6">
            <div className="flex gap-3">
              <input
                id={confirm}
                name={confirm}
                type="checkbox"
                value="yes"
                required
                aria-invalid={!!errors[confirm]}
                aria-describedby={describedBy(confirm, errors)}
                className={`${choiceBox} mt-0.5`}
              />
              <label htmlFor={confirm} className="text-sm text-stone-800">
                {f.label}
                <span className="text-red-700"> *</span>
              </label>
            </div>
            <FieldError name={confirm} errors={errors} />
            <Field label="Type your full name to sign" htmlFor={name} required error={err} hint={f.help}>
              <Input id={name} name={name} autoComplete="name" required maxLength={100} aria-invalid={!!err} aria-describedby={describedBy(name, errors, !!f.help)} />
            </Field>
          </div>
        );
      }
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={(e) => {
        const name = (e.target as unknown as HTMLInputElement).name;
        if (name && errors[name]) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
        }
        if ([...controlling].some((id) => name === inputName(id))) readControls(e.currentTarget);
      }}
      noValidate
      className="my-6 space-y-6"
      aria-describedby={formError ? "form-error" : undefined}
    >
      {formError && (
        <div id="form-error">
          <Alert tone={props.preview ? "info" : "error"}>{formError}</Alert>
        </div>
      )}
      {props.definition.fields.filter((f) => isShown(f, controls)).map(render)}
      <Button type="submit" variant="accent" disabled={submitting} className="w-full rounded-[4px] py-4 text-base sm:w-auto sm:px-10">
        {submitting ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
