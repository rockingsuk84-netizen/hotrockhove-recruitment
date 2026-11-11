"use client";

import { Button } from "@/components/ui";

/** Ticks every checkbox matching `target`; a second click clears them. */
export function SelectAll({ target, label }: { target: string; label: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="py-1.5"
      onClick={() => {
        const boxes = Array.from(document.querySelectorAll<HTMLInputElement>(target));
        const all = boxes.every((b) => b.checked);
        boxes.forEach((b) => (b.checked = !all));
      }}
    >
      {label}
    </Button>
  );
}
