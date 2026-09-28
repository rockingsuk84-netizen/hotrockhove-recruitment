"use client";

import { useActionState } from "react";
import { Alert, Button, Input, Label, Select } from "@/components/ui";
import { createStaff, type StaffState } from "./actions";

export function CreateStaffForm({ canCreateOwner }: { canCreateOwner: boolean }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(createStaff, {});
  return (
    <form action={action} className="mt-4 space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.created && (
        <Alert tone="success">
          Account created for {state.created.email}. Temporary password (shown once):{" "}
          <code className="select-all break-all rounded bg-white px-1 font-mono">{state.created.password}</code>
        </Alert>
      )}
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
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
