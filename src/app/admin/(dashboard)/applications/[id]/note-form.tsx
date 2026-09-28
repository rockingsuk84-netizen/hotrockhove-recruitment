"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Textarea } from "@/components/ui";
import { addNote, type NoteState } from "../actions";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(addNote.bind(null, applicationId), {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="mt-3 space-y-2">
      <Textarea name="body" rows={3} maxLength={5000} placeholder="Add a note for the team…" aria-label="New note" required />
      {state.error && <p className="text-sm font-medium text-red-700">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
