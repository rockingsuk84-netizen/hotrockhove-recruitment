"use client";

import { Button } from "@/components/ui";

export function DeleteQrButton() {
  return (
    <Button
      type="submit"
      variant="danger"
      className="w-full"
      onClick={(e) => {
        if (!window.confirm("Delete this QR code? Printed copies will send people to the homepage. Deactivating keeps its history instead.")) {
          e.preventDefault();
        }
      }}
    >
      Delete
    </Button>
  );
}
