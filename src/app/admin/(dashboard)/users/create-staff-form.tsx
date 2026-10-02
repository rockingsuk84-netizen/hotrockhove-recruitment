"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Alert, Button, Input, Label, Select } from "@/components/ui";
import { createStaff, type StaffState } from "./actions";
import { CopyLink } from "./copy-link";

export function CreateStaffForm({ canCreateOwner }: { canCreateOwner: boolean }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(createStaff, {});
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-4 space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.created &&
        (state.created.delivered ? (
          <Alert tone="success">Invitation sent to {state.created.email}. They&apos;ll choose their own password from the email (link valid for 72 hours).</Alert>
        ) : (
          <Alert tone="info">
            Account created for {state.created.email}, but the invitation email couldn&apos;t be sent (email isn&apos;t set up yet). Send them this
            one-time link securely; it expires in 72 hours:
            {state.created.link && <CopyLink link={state.created.link} />}
          </Alert>
        ))}
      <div>
        <Label htmlFor="staff-name">Name</Label>
        <Input id="staff-name" name="name" required maxLength={100} />
      </div>
      <div>
        <Label htmlFor="staff-email">Email</Label>
        <Input id="staff-email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="staff-role">Role</Label>
        <Select id="staff-role" name="role" defaultValue="recruiter">
          <option value="recruiter">Recruiter</option>
          <option value="admin">Admin</option>
          {canCreateOwner && <option value="owner">Owner</option>}
        </Select>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending invitation…" : "Create and send invitation"}
      </Button>
      <p className="text-xs text-stone-500">They&apos;ll receive an email to set their own password. You never see or handle it.</p>
    </form>
  );
}
