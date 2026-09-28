"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets uncontrolled fields after a form action completes, which would
 * wipe what the user typed when the server returns validation errors. This
 * submits the action manually (including the clicked button's name/value) so
 * the fields keep their values.
 */
export function submitWithoutReset(action: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
