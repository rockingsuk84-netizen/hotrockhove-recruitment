"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, Input, Label } from "@/components/ui";
import { setNewPassword, type ResetState } from "./actions";

export function ResetForm({ token, invite }: { token: string; invite: boolean }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(setNewPassword, {});
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-5 space-y-4">
      {state.error && (
        <Alert tone="error">
          {state.error}{" "}
          {state.expired && (
            <Link href="/admin/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          )}
        </Alert>
      )}
      <input type="hidden" name="token" value={token} />
      {invite && <input type="hidden" name="invite" value="1" />}
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : invite ? "Set password" : "Save new password"}
      </Button>
    </form>
  );
}
