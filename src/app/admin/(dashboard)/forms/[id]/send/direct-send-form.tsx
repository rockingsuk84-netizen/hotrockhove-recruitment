"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import type { DirectSendState } from "../../actions";

/** Send the form to one person by email, whether or not they have applied. */
export function DirectSendForm({ action }: { action: (state: DirectSendState, fd: FormData) => Promise<DirectSendState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const err = (name: string) => state.fields?.[name];
  return (
    <Card className="mb-8 p-5">
      <h2 className="font-semibold text-stone-900">Send to someone new</h2>
      <p className="mt-1 text-sm text-stone-600">
        For people who haven&apos;t applied on the website. If the email already belongs to an applicant, it goes to them.
      </p>
      <form onSubmit={submitWithoutReset(formAction)} noValidate className="mt-4 space-y-4">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Full name" htmlFor="fullName" required error={err("fullName")}>
            <Input id="fullName" name="fullName" autoComplete="off" maxLength={100} aria-invalid={!!err("fullName")} />
          </Field>
          <Field label="Email" htmlFor="email" required error={err("email")}>
            <Input id="email" name="email" type="email" inputMode="email" autoComplete="off" maxLength={254} aria-invalid={!!err("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={err("phone")}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={30} aria-invalid={!!err("phone")} />
          </Field>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" name="includeAlreadySent" value="yes" className="mt-0.5 h-4 w-4" />
            Send again if they already have this form
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send form"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
