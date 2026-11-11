"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Textarea } from "@/components/ui";
import { submitWithoutReset } from "@/components/forms";
import type { DecisionState } from "../../actions";

export function DecisionForm({
  action,
  options,
  current,
  note,
  offerOption,
  offerEmailedAt,
  interviewed,
}: {
  action: (state: DecisionState, fd: FormData) => Promise<DecisionState>;
  options: string[];
  current: string | null;
  note: string | null;
  /** The option that emails the applicant ("Offer"), if this form has one. */
  offerOption: string | null;
  offerEmailedAt: string | null;
  /** Whether an interview has taken place (scheduled time has passed). */
  interviewed: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [choice, setChoice] = useState(current ?? "");
  const isOffer = offerOption !== null && choice === offerOption;

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="mt-3 space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && (
        <Alert tone={state.offerEmailed === false ? "error" : "success"}>
          Outcome saved.
          {state.offerEmailed === true && " The offer email has been sent."}
          {state.offerEmailed === false && " But the offer email failed to send. Try saving again."}
        </Alert>
      )}
      <fieldset>
        <legend className="sr-only">Outcome</legend>
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-stone-800">
              <input type="radio" name="decision" value={o} checked={choice === o} onChange={() => setChoice(o)} required className="h-4 w-4" />
              {o}
              {o === offerOption && <span className="text-xs text-stone-500">(emails the applicant)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      {isOffer && (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
          {!interviewed && <p className="text-xs font-medium text-amber-800">This applicant hasn&apos;t had an interview yet.</p>}
          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input type="checkbox" name="sendOffer" value="yes" defaultChecked={!offerEmailedAt} className="mt-0.5 h-4 w-4" />
            {offerEmailedAt ? `Send the offer email again (last sent ${offerEmailedAt})` : "Email the offer to the applicant"}
          </label>
          <div>
            <label htmlFor="offerMessage" className="mb-1 block text-sm font-medium text-stone-800">
              Offer details <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <Textarea
              id="offerMessage"
              name="offerMessage"
              rows={4}
              maxLength={3000}
              placeholder="For example: start date, hours, rate of pay, what happens next."
            />
            <p className="mt-1 text-xs text-stone-500">Added to the offer email. It isn&apos;t stored in the dashboard.</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-stone-800">
          Internal note <span className="font-normal text-stone-500">(optional, staff only)</span>
        </label>
        <Textarea id="note" name="note" rows={3} maxLength={2000} defaultValue={note ?? ""} />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !choice}>
        {pending ? "Saving…" : isOffer ? "Save outcome" : "Save outcome (no email)"}
      </Button>
    </form>
  );
}
