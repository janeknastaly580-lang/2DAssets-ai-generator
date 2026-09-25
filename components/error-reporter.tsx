"use client";

import * as React from "react";
import { reportClientError, shouldIgnore } from "@/lib/client/reportError";

/** SPEC §25.4 — uncaught browser errors and unhandled promise rejections → Error Reporting. */
export function ErrorReporter() {
  React.useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const err = e.error ?? e.message;
      if (!shouldIgnore(err, e.filename)) reportClientError(err, "error");
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!shouldIgnore(e.reason)) reportClientError(e.reason, "unhandledrejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
