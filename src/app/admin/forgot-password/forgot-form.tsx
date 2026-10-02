"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, Input, Label } from "@/components/ui";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});
  if (state.done) {
    return (
      <div className="mt-5">
        <Alert tone="success">
          If that email belongs to an active staff account, a reset link is on its way. It expires in 60 minutes. Check your spam folder if it
          doesn&apos;t arrive.
        </Alert>
      </div>
    );
  }
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-5 space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
