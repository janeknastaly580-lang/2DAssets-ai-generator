"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/client/reportError";
import "./globals.css";

/** SPEC §25.4 — replaces the root layout when it crashes (app/error.tsx cannot catch layout errors). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    if (!error.digest) reportClientError(error, "global-boundary");
  }, [error]);
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-md text-sm">Veyraflow hit an unexpected error. Please try again.</p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
