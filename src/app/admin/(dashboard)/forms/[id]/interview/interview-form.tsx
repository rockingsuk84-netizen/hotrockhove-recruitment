"use client";

import { useActionState, useRef, useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { submitWithoutReset } from "@/components/forms";
import { DURATIONS, INTERVIEW_MODES, MODE_LABELS, type Mode } from "@/lib/interviews";
import type { InterviewFormState } from "../../actions";

export type Invitee = { requestId: string; name: string; jobTitle: string | null; phone: string; current: string | null; currentLocal: string };
export type Defaults = { mode: Mode; durationMinutes: number; location: string; meetingLink: string; contactName: string; notes: string };

export function InterviewForm({
  action,
  invitees,
  defaults,
  minLocal,
}: {
  action: (state: InterviewFormState, fd: FormData) => Promise<InterviewFormState>;
  invitees: Invitee[];
  defaults: Defaults;
  minLocal: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [mode, setMode] = useState<Mode>(defaults.mode);
  const formRef = useRef<HTMLFormElement>(null);
  const err = (name: string) => state.fields?.[name];

  function copyFirstTime() {
    const inputs = formRef.current?.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    const first = inputs?.[0]?.value;
    if (first) inputs?.forEach((i) => (i.value = first));
  }

  return (
    <form ref={formRef} onSubmit={submitWithoutReset(formAction)} noValidate className="space-y-6">
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Card className="space-y-5 p-5">
        <h2 className="font-semibold text-stone-900">Interview details</h2>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-800">
            How will it happen?<span className="text-red-700"> *</span>
          </legend>
          <div className="flex flex-wrap gap-5">
            {INTERVIEW_MODES.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-stone-800">
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="h-4 w-4" />
                {MODE_LABELS[m]}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "in_person" && (
          <Field label="Address" htmlFor="location" required error={err("location")} hint="Where the applicant should go.">
            <Textarea id="location" name="location" rows={2} maxLength={300} defaultValue={defaults.location} aria-invalid={!!err("location")} />
          </Field>
        )}
        {mode === "online" && (
          <Field label="Meeting link" htmlFor="meetingLink" required error={err("meetingLink")} hint="Teams, Zoom, Google Meet… starting with https://">
            <Input id="meetingLink" name="meetingLink" type="url" inputMode="url" maxLength={500} defaultValue={defaults.meetingLink} aria-invalid={!!err("meetingLink")} />
          </Field>
        )}
        {mode === "phone" && <p className="text-sm text-stone-600">We&apos;ll tell each applicant you will call them on the phone number they gave.</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Length" htmlFor="durationMinutes" required error={err("durationMinutes")}>
            <Select id="durationMinutes" name="durationMinutes" defaultValue={String(defaults.durationMinutes)}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label={mode === "in_person" ? "Ask for" : "Interviewer"} htmlFor="contactName" error={err("contactName")}>
            <Input id="contactName" name="contactName" maxLength={100} defaultValue={defaults.contactName} />
          </Field>
        </div>
        <Field label="Notes for the applicant" htmlFor="notes" error={err("notes")} hint="For example: what to bring, parking, dress code.">
          <Textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={defaults.notes} />
        </Field>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900">
            {invitees.length === 1 ? "Time" : `Times (${invitees.length} people)`} <span className="text-sm font-normal text-stone-500">UK time</span>
          </h2>
          {invitees.length > 1 && (
            <Button type="button" variant="secondary" onClick={copyFirstTime} className="py-1.5">
              Use the first time for everyone
            </Button>
          )}
        </div>
        <ul className="mt-3 divide-y divide-stone-100">
          {invitees.map((p) => {
            const name = `at_${p.requestId}`;
            return (
              <li key={p.requestId} className="grid gap-2 py-3 sm:grid-cols-[1fr_240px] sm:items-start">
                <input type="hidden" name="requestIds" value={p.requestId} />
                <div>
                  <label htmlFor={name} className="font-medium text-stone-900">
                    {p.name}
                  </label>
                  <p className="text-sm text-stone-500">
                    {p.jobTitle ?? "—"}
                    {mode === "phone" && ` · ${p.phone || "no phone number"}`}
                  </p>
                  {p.current && <p className="text-xs text-amber-700">Already invited for {p.current}. Saving will send updated details.</p>}
                </div>
                <div>
                  <Input
                    id={name}
                    name={name}
                    type="datetime-local"
                    min={minLocal}
                    step={300}
                    defaultValue={p.currentLocal}
                    aria-invalid={!!err(name)}
                    aria-describedby={err(name) ? `${name}-error` : undefined}
                  />
                  {err(name) && (
                    <p id={`${name}-error`} className="mt-1 text-sm font-medium text-red-700">
                      {err(name)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">Each person gets their own email with these details. Their application moves to “Interview”.</p>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : `Send ${invitees.length === 1 ? "invitation" : `${invitees.length} invitations`}`}
        </Button>
      </div>
    </form>
  );
}
