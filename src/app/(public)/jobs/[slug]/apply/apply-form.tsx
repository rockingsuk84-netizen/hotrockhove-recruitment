"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import type { ApplicationQuestion } from "@/db/schema";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  nonce?: string;
  turnstileSiteKey: string;
  job: { id: string; standoutPrompt: string; questions: ApplicationQuestion[] };
  positions: { id: string; name: string }[];
  source: string;
  maxCvBytes: number;
  allowedCvTypes: string[];
  accept: string;
  consentText: string;
};

function describedBy(name: string, errors: Record<string, string>, hint = false) {
  if (errors[name]) return `${name}-error`;
  return hint ? `${name}-hint` : undefined;
}

export function ApplyForm(props: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const submissionToken = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const maxMb = (props.maxCvBytes / (1024 * 1024)).toFixed(props.maxCvBytes % (1024 * 1024) ? 1 : 0);
  const typesLabel = props.allowedCvTypes.map((t) => t.toUpperCase()).join(", ");

  useEffect(() => {
    if (!scriptReady || !window.turnstile || !widgetRef.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetRef.current, {
      sitekey: props.turnstileSiteKey,
      action: "apply",
      theme: "light",
      callback: () => setVerified(true),
      "expired-callback": () => setVerified(false),
      "error-callback": () => setVerified(false),
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [scriptReady, props.turnstileSiteKey]);

  function focusFirstError(fields: Record<string, string>) {
    const first = Object.keys(fields)[0];
    const el = first ? formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`) : null;
    el?.focus();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    // Quick client-side checks for a friendlier experience; the server re-validates everything.
    const clientErrors: Record<string, string> = {};
    const cv = data.get("cv");
    if (!(cv instanceof File) || cv.size === 0) clientErrors.cv = "Please upload your CV.";
    else if (cv.size > props.maxCvBytes) clientErrors.cv = `Your CV must be ${maxMb} MB or smaller.`;
    else if (!props.allowedCvTypes.includes(cv.name.split(".").pop()?.toLowerCase() ?? "")) {
      clientErrors.cv = `Please upload your CV as one of: ${typesLabel}.`;
    }
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      focusFirstError(clientErrors);
      return;
    }
    if (!verified) {
      setFormError("Please complete the security check above the submit button.");
      return;
    }

    // Idempotency key reused on retries so a double-click or flaky network can't create duplicates.
    submissionToken.current ??= crypto.randomUUID();
    data.set("submissionToken", submissionToken.current);

    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        redirect?: string;
        error?: string;
        fields?: Record<string, string>;
      };
      if (res.ok && body.ok && body.redirect) {
        router.push(body.redirect);
        return;
      }
      setErrors(body.fields ?? {});
      setFormError(body.error ?? "Something went wrong. Please try again.");
      if (body.fields && Object.keys(body.fields).length) focusFirstError(body.fields);
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      // Turnstile tokens are single-use: always get a fresh one for the next attempt.
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
      setVerified(false);
      setSubmitting(false);
    }
  }

  const err = (name: string) => errors[name];

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={props.nonce}
        onReady={() => setScriptReady(true)}
      />
      <form
        ref={formRef}
        onSubmit={onSubmit}
        onChange={(e) => {
          // Clear a field's error as soon as the applicant changes it.
          const name = (e.target as unknown as HTMLInputElement).name;
          if (name && errors[name]) {
            setErrors((prev) => {
              const next = { ...prev };
              delete next[name];
              return next;
            });
          }
        }}
        noValidate className="my-6 space-y-6" aria-describedby={formError ? "form-error" : undefined}>
        {formError && (
          <div id="form-error">
            <Alert tone="error">{formError}</Alert>
          </div>
        )}

        <input type="hidden" name="jobId" value={props.job.id} />
        <input type="hidden" name="source" value={props.source} />
        {/* Honeypot: invisible to people and assistive technology; bots tend to fill it. */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {props.positions.length > 1 && (
          <Field label="Which role are you applying for?" htmlFor="positionId" required error={err("positionId")}>
            <Select id="positionId" name="positionId" required defaultValue="" aria-invalid={!!err("positionId")} aria-describedby={describedBy("positionId", errors)}>
              <option value="" disabled>
                Choose a role…
              </option>
              {props.positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Full name" htmlFor="fullName" required error={err("fullName")}>
          <Input id="fullName" name="fullName" autoComplete="name" required maxLength={100} aria-invalid={!!err("fullName")} aria-describedby={describedBy("fullName", errors)} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Email address" htmlFor="email" required error={err("email")}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} aria-invalid={!!err("email")} aria-describedby={describedBy("email", errors)} />
          </Field>
          <Field label="Phone number" htmlFor="phone" required error={err("phone")} hint="UK mobile preferred, e.g. 07700 900123">
            <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} aria-invalid={!!err("phone")} aria-describedby={describedBy("phone", errors, true)} />
          </Field>
        </div>

        <Field label={props.job.standoutPrompt} htmlFor="standoutQuality" required error={err("standoutQuality")} hint="A sentence or two is perfect.">
          <Textarea id="standoutQuality" name="standoutQuality" required maxLength={500} rows={3} aria-invalid={!!err("standoutQuality")} aria-describedby={describedBy("standoutQuality", errors, true)} />
        </Field>

        {props.job.questions.map((q) => {
          const name = `q_${q.id}`;
          const Control = q.type === "long_text" ? Textarea : Input;
          return (
            <Field key={q.id} label={q.label} htmlFor={name} required={q.required} error={err(name)} hint={q.helpText}>
              <Control id={name} name={name} required={q.required} maxLength={q.maxLength} aria-invalid={!!err(name)} aria-describedby={describedBy(name, errors, !!q.helpText)} />
            </Field>
          );
        })}

        <Field label="CV" htmlFor="cv" required error={err("cv")} hint={`${typesLabel}, up to ${maxMb} MB.`}>
          <input
            id="cv"
            name="cv"
            type="file"
            accept={props.accept}
            required
            aria-invalid={!!err("cv")}
            aria-describedby={describedBy("cv", errors, true)}
            className="block w-full rounded-[4px] border border-stone-300 bg-white text-sm text-stone-700 file:mr-4 file:border-0 file:bg-cream file:px-4 file:py-3 file:font-semibold file:text-ink hover:file:bg-line aria-[invalid=true]:border-red-600"
          />
        </Field>

        <Field label="Anything else you'd like to tell us?" htmlFor="coverMessage" error={err("coverMessage")}>
          <Textarea id="coverMessage" name="coverMessage" maxLength={3000} rows={4} aria-invalid={!!err("coverMessage")} aria-describedby={describedBy("coverMessage", errors)} />
        </Field>

        <div>
          <div className="flex gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              value="yes"
              required
              aria-invalid={!!err("consent")}
              aria-describedby={describedBy("consent", errors)}
              className="mt-1 h-5 w-5 shrink-0 rounded border-stone-400 accent-forest"
            />
            <label htmlFor="consent" className="text-sm text-stone-700">
              {props.consentText}{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-forest underline">
                Read the Privacy Policy
              </Link>
              <span className="text-red-700"> *</span>
            </label>
          </div>
          {err("consent") && (
            <p id="consent-error" className="mt-1.5 text-sm font-medium text-red-700">
              {err("consent")}
            </p>
          )}
        </div>

        <div ref={widgetRef} className="min-h-[65px]" />

        <Button type="submit" variant="accent" disabled={submitting} className="w-full rounded-[4px] py-4 text-base sm:w-auto sm:px-10">
          {submitting ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </>
  );
}
