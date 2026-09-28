"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Input } from "@/components/ui";
import { addListItem, type SettingsState } from "../actions";

export function AddItemForm({ list }: { list: "positions" | "locations" | "departments" | "employmentTypes" }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addListItem.bind(null, list), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="mt-3">
      <div className="flex gap-2">
        <Input name="name" placeholder="Add new…" maxLength={100} aria-label="New item name" required />
        <Button type="submit" variant="secondary" disabled={pending}>
          Add
        </Button>
      </div>
      {state.error && <p className="mt-1 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
