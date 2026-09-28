"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms";
import { Button, Input, Select } from "@/components/ui";
import { updateDepartment, type SettingsState } from "../actions";

type Dept = { id: string; slug: string | null; tagline: string; imageUrl: string | null; icon: string | null };

/** Public category-card fields for a department (slug, tagline, image, icon). */
export function DepartmentForm({ dept }: { dept: Dept }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateDepartment.bind(null, dept.id), {});
  return (
    <form onSubmit={submitWithoutReset(action)} className="mt-2 space-y-2 rounded-md bg-stone-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="slug" defaultValue={dept.slug ?? ""} placeholder="url-slug" aria-label="URL slug" />
        <Select name="icon" defaultValue={dept.icon ?? ""} aria-label="Icon">
          <option value="">No icon</option>
          <option value="cloche">Cloche</option>
          <option value="chef-hat">Chef hat</option>
          <option value="glass">Wine glass</option>
          <option value="home">House</option>
          <option value="star">Star</option>
        </Select>
      </div>
      <Input name="tagline" defaultValue={dept.tagline} placeholder="Card tagline" aria-label="Tagline" maxLength={160} />
      <Input name="imageUrl" defaultValue={dept.imageUrl ?? ""} placeholder="/images/… or https://" aria-label="Card image" />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending} className="py-1.5">
          {pending ? "Saving…" : "Save card"}
        </Button>
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state.success && <span className="text-sm text-emerald-700">{state.success}</span>}
      </div>
    </form>
  );
}
