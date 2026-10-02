"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, Input, Label } from "@/components/ui";
import { changeOwnPassword, type ChangePasswordState } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changeOwnPassword, {});
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-4 space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="current">Current password</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        <p className="mt-1.5 text-sm text-stone-500">At least 12 characters.</p>
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
