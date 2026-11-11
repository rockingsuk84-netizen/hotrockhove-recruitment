/**
 * Applicant forms: the field model, validation of submitted answers, and
 * display formatting. Pure functions (no database), shared by the public form,
 * the API route, the admin views and the emails, so the future form builder
 * only has to produce a `FormDefinition`.
 */
import { z } from "zod";

export type Option = { value: string; label: string; hint?: string };

/** Show a field only when another field's answer equals (or, for multi-choice, includes) a value. */
export type ShowIf = { field: string; equals: string };

type Base = { id: string; label: string; help?: string; showIf?: ShowIf };

export type FormField =
  | (Base & { type: "heading" })
  | (Base & { type: "short_text" | "long_text"; required: boolean; maxLength: number })
  | (Base & { type: "date"; required: boolean })
  | (Base & { type: "yes_no"; required: boolean })
  /** `display: "dropdown"` shows a single-choice question as a drop-down list instead of radio buttons. */
  | (Base & { type: "choice"; required: boolean; multiple: boolean; options: Option[]; display?: "dropdown" })
  | (Base & { type: "availability_grid"; required: boolean; rows: Option[]; columns: Option[] })
  /** Asked only when the applicant has no CV on file; optional (to replace it) when they do. */
  | (Base & { type: "cv_upload" })
  /** Typed full name plus a confirmation tick-box, in place of a handwritten signature. */
  | (Base & { type: "signature" });

export type FieldType = FormField["type"];

export type FormDefinition = {
  title: string;
  /** Shown to the applicant above the fields. */
  intro: string;
  fields: FormField[];
  /** Staff-only outcome choices recorded against each response (e.g. Offer / Hold / Reject). */
  reviewOptions: string[];
};

export type AnswerValue = string | string[] | Record<string, string[]>;
export type Answers = Record<string, AnswerValue>;

/* -------------------------------------------------------------------------- */
/* Definition schema — validates stored and (later) builder-made forms         */
/* -------------------------------------------------------------------------- */

const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Field ids are lower-case letters, digits and _");
const option = z.object({ value: id, label: z.string().trim().min(1).max(80), hint: z.string().max(80).optional() });
const base = {
  id,
  label: z.string().trim().min(1).max(300),
  help: z.string().max(500).optional(),
  showIf: z.object({ field: id, equals: z.string().max(80) }).optional(),
};

export const formFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("heading") }),
  z.object({
    ...base,
    type: z.enum(["short_text", "long_text"]),
    required: z.boolean(),
    maxLength: z.number().int().min(1).max(5000),
  }),
  z.object({ ...base, type: z.literal("date"), required: z.boolean() }),
  z.object({ ...base, type: z.literal("yes_no"), required: z.boolean() }),
  z
    .object({
      ...base,
      type: z.literal("choice"),
      required: z.boolean(),
      multiple: z.boolean(),
      options: z.array(option).min(1).max(30),
      display: z.literal("dropdown").optional(),
    })
    .refine((f) => !(f.multiple && f.display === "dropdown"), { message: "A drop-down can only allow one choice" }),
  z.object({
    ...base,
    type: z.literal("availability_grid"),
    required: z.boolean(),
    rows: z.array(option).min(1).max(14),
    columns: z.array(option).min(1).max(8),
  }),
  z.object({ ...base, type: z.literal("cv_upload") }),
  z.object({ ...base, type: z.literal("signature") }),
]);

export const formDefinitionSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    intro: z.string().max(2000),
    fields: z.array(formFieldSchema).min(1).max(60),
    reviewOptions: z.array(z.string().trim().min(1).max(40)).max(8),
  })
  .superRefine((def, ctx) => {
    const seen = new Set<string>();
    for (const [i, f] of def.fields.entries()) {
      if (seen.has(f.id)) ctx.addIssue({ code: "custom", path: ["fields", i, "id"], message: `Duplicate field id "${f.id}"` });
      // A condition may only point at an earlier field, so the form reads top to bottom.
      if (f.showIf && !seen.has(f.showIf.field)) {
        ctx.addIssue({ code: "custom", path: ["fields", i, "showIf"], message: `"${f.id}" depends on an unknown or later field` });
      }
      seen.add(f.id);
    }
    if (def.fields.filter((f) => f.type === "cv_upload").length > 1) {
      ctx.addIssue({ code: "custom", path: ["fields"], message: "A form can have only one CV upload" });
    }
  });

/* -------------------------------------------------------------------------- */
/* Input names (shared by the client form and the parser)                     */
/* -------------------------------------------------------------------------- */

export const inputName = (fieldId: string) => `f_${fieldId}`;
export const gridInputName = (fieldId: string, row: string) => `f_${fieldId}__${row}`;
export const confirmInputName = (fieldId: string) => `f_${fieldId}__confirm`;
/** The CV file input. A form has at most one. */
export const CV_INPUT = "cv";

/* -------------------------------------------------------------------------- */
/* Conditional visibility                                                     */
/* -------------------------------------------------------------------------- */

export function isShown(field: FormField, answers: Answers): boolean {
  if (!field.showIf) return true;
  const value = answers[field.showIf.field];
  if (typeof value === "string") return value === field.showIf.equals;
  if (Array.isArray(value)) return value.includes(field.showIf.equals);
  return false;
}

/* -------------------------------------------------------------------------- */
/* Parsing submitted answers                                                  */
/* -------------------------------------------------------------------------- */

type FormLike = { get(name: string): unknown; getAll(name: string): unknown[] };

export type ParseResult =
  | { ok: true; answers: Answers; cvRequired: boolean }
  | { ok: false; errors: Record<string, string> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(form: FormLike, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function allowed(form: FormLike, name: string, options: Option[]): string[] {
  const values = new Set(options.map((o) => o.value));
  const picked = form.getAll(name).filter((v): v is string => typeof v === "string" && values.has(v));
  // Keep the definition's order and drop duplicates.
  return options.map((o) => o.value).filter((v) => picked.includes(v));
}

/**
 * Validate a submission against the form definition. Unknown inputs are
 * ignored, option values are checked against the definition, and fields
 * hidden by a condition are neither required nor stored. The CV file itself
 * is validated by the caller; this only reports whether one is required.
 */
export function parseAnswers(def: FormDefinition, form: FormLike, opts: { cvOnFile: boolean }): ParseResult {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  let cvRequired = false;

  for (const f of def.fields) {
    if (!isShown(f, answers)) continue;
    const name = inputName(f.id);
    switch (f.type) {
      case "heading":
        break;
      case "short_text":
      case "long_text": {
        const v = text(form, name);
        if (v.length > f.maxLength) errors[name] = `Please keep this under ${f.maxLength} characters.`;
        else if (v) answers[f.id] = v;
        else if (f.required) errors[name] = "Please answer this question.";
        break;
      }
      case "date": {
        const v = text(form, name);
        if (v && (!ISO_DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)))) errors[name] = "Please enter a valid date.";
        else if (v) answers[f.id] = v;
        else if (f.required) errors[name] = "Please enter a date.";
        break;
      }
      case "yes_no": {
        const v = text(form, name);
        if (v === "yes" || v === "no") answers[f.id] = v;
        else if (f.required) errors[name] = "Please choose yes or no.";
        break;
      }
      case "choice": {
        const picked = allowed(form, name, f.options);
        const value = f.multiple ? picked : picked.slice(0, 1);
        if (value.length) answers[f.id] = f.multiple ? value : value[0];
        else if (f.required) errors[name] = f.multiple ? "Please choose at least one option." : "Please choose an option.";
        break;
      }
      case "availability_grid": {
        const grid: Record<string, string[]> = {};
        for (const row of f.rows) {
          const picked = allowed(form, gridInputName(f.id, row.value), f.columns);
          if (picked.length) grid[row.value] = picked;
        }
        if (Object.keys(grid).length) answers[f.id] = grid;
        else if (f.required) errors[name] = "Please tick at least one time you're available.";
        break;
      }
      case "cv_upload":
        cvRequired = !opts.cvOnFile;
        break;
      case "signature": {
        const v = text(form, name);
        const confirmed = form.get(confirmInputName(f.id)) === "yes";
        if (v.length < 2) errors[name] = "Please type your full name to sign.";
        else if (v.length > 100) errors[name] = "Name is too long.";
        else if (!confirmed) errors[confirmInputName(f.id)] = "Please confirm the declaration.";
        else answers[f.id] = v;
        break;
      }
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers, cvRequired };
}

/* -------------------------------------------------------------------------- */
/* Display                                                                    */
/* -------------------------------------------------------------------------- */

const label = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? value;

function formatIsoDate(v: string) {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? v
    : new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Plain-text rendering of one answer, for admin views and emails. */
export function formatAnswer(field: FormField, value: AnswerValue | undefined): string {
  if (value === undefined) return "—";
  switch (field.type) {
    case "yes_no":
      return value === "yes" ? "Yes" : value === "no" ? "No" : "—";
    case "date":
      return typeof value === "string" ? formatIsoDate(value) : "—";
    case "choice":
      return (Array.isArray(value) ? value : [String(value)]).map((v) => label(field.options, v)).join(", ") || "—";
    case "availability_grid": {
      if (typeof value !== "object" || Array.isArray(value)) return "—";
      const lines = field.rows
        .filter((r) => value[r.value]?.length)
        .map((r) => `${r.label}: ${value[r.value].map((c) => label(field.columns, c)).join(", ")}`);
      return lines.length ? lines.join("\n") : "—";
    }
    case "signature":
      return typeof value === "string" ? `Signed: ${value}` : "—";
    default:
      return typeof value === "string" ? value : "—";
  }
}

/** Question/answer pairs in form order, skipping headings, the CV upload and hidden fields. */
export function answerRows(def: FormDefinition, answers: Answers): { field: FormField; text: string }[] {
  return def.fields
    .filter((f) => f.type !== "heading" && f.type !== "cv_upload" && isShown(f, answers))
    .map((f) => ({ field: f, text: formatAnswer(f, answers[f.id]) }));
}
