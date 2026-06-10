"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the console for debugging; never swallow silently.
    console.error("JobPacket error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">Something broke</h1>
      <p className="text-sm text-muted">
        JobPacket hit an unexpected error. Your saved packets are safe in local storage.
      </p>
      <p className="break-words font-mono text-[11px] text-faint">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
