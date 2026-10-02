"use client";

import { useState } from "react";

/** One-time password link shown only when the email couldn't be delivered. */
export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 select-all break-all rounded bg-white px-2 py-1 font-mono text-xs">{link}</code>
      <button
        type="button"
        className="shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-stone-50"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          } catch {
            /* clipboard unavailable: the link is selectable */
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
