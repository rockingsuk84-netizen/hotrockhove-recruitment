"use client";

import { useActionState, type ReactNode } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button } from "@/components/ui";
import type { SettingsState } from "./actions";

type Action = (state: SettingsState, fd: FormData) => Promise<SettingsState>;

/**
 * Generic settings form: server-rendered fields, client-side pending/result
 * state. An optional secondary button submits with intent="test".
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  secondaryLabel,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  secondaryLabel?: string;
}) {
  const [state, run, pending] = useActionState<SettingsState, FormData>(action, {});
  const fields = Object.entries(state.fields ?? {});

  return (
    <form onSubmit={submitWithoutReset(run)} className="space-y-5">
      {state.error && (
        <Alert tone="error">
          {state.error}
          {fields.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {fields.map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono text-xs">{k}</span>: {v}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {children}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="save" disabled={pending}>
          {pending ? "Working…" : submitLabel}
        </Button>
        {secondaryLabel && (
          <Button type="submit" name="intent" value="test" variant="secondary" disabled={pending}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
