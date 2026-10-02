"use client";

import { useActionState } from "react";
import { sendStaffPasswordReset, type ResetLinkState } from "./actions";
import { CopyLink } from "./copy-link";

export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState<ResetLinkState, FormData>(sendStaffPasswordReset.bind(null, userId), {});
  return (
    <div className="text-right">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="text-sm font-medium text-brand hover:underline disabled:opacity-60"
          onClick={(e) => {
            if (!window.confirm(`Send ${name} a link to reset their password?`)) e.preventDefault();
          }}
        >
          {pending ? "Sending…" : "Send password reset"}
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
      {state.delivered && <p className="mt-1 text-xs text-emerald-700">Reset email sent (valid 60 minutes).</p>}
      {state.delivered === false && state.link && (
        <div className="mt-2 max-w-sm text-left text-xs text-stone-700">
          Email isn&apos;t set up yet, so send this one-time link securely (valid 60 minutes):
          <CopyLink link={state.link} />
        </div>
      )}
    </div>
  );
}
