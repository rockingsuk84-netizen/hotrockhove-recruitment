"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import type { SendFormState } from "../../actions";

const BOXES = 'input[name="applicationIds"]';

/** Wraps the applicant table: select-all, a live count and the send button. */
export function SendForm({
  action,
  total,
  max,
  children,
}: {
  action: (state: SendFormState, fd: FormData) => Promise<SendFormState>;
  total: number;
  max: number;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);

  const count = () => setSelected(formRef.current?.querySelectorAll<HTMLInputElement>(`${BOXES}:checked`).length ?? 0);
  const setAll = (checked: boolean) => {
    formRef.current?.querySelectorAll<HTMLInputElement>(BOXES).forEach((b) => (b.checked = checked));
    count();
  };

  return (
    <form ref={formRef} action={formAction} onChange={count} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => setAll(true)} disabled={total === 0}>
          Select all {total}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAll(false)} disabled={selected === 0}>
          Clear
        </Button>
        <span className="text-sm text-stone-600" aria-live="polite">
          {selected} selected
        </span>
      </div>
      {children}
      <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="includeAlreadySent" value="yes" className="mt-0.5 h-4 w-4" />
          Also send to people who already have this form (they get a second, separate request)
        </label>
        <Button type="submit" disabled={pending || selected === 0 || selected > max}>
          {pending ? "Sending…" : `Send to ${selected} applicant${selected === 1 ? "" : "s"}`}
        </Button>
      </div>
      {selected > max && <p className="text-sm font-medium text-red-700">You can send to up to {max} at a time.</p>}
      {pending && <p className="text-sm text-stone-600">Sending emails one by one. Please keep this page open.</p>}
    </form>
  );
}
