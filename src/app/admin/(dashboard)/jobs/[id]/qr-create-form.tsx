"use client";

import { useActionState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { createQrCode, type QrFormState } from "../actions";

export function QrCreateForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState<QrFormState, FormData>(createQrCode.bind(null, jobId), {});
  return (
    <form action={action} className="mt-5 space-y-3 border-t border-stone-200 pt-4">
      <p className="text-sm font-medium text-stone-900">Add a tracked QR code</p>
      <div>
        <Label htmlFor="qr-label">Name</Label>
        <Input id="qr-label" name="label" placeholder="Window poster" maxLength={60} required />
      </div>
      <div>
        <Label htmlFor="qr-source">Source tag</Label>
        <Input id="qr-source" name="source" placeholder="poster, event, instagram…" maxLength={40} />
      </div>
      {state.error && <p className="text-sm font-medium text-red-700">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add QR code"}
      </Button>
    </form>
  );
}
