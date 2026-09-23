"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** SPEC §17.3 — digit boxes with auto-focus and paste support (6 or 8 digits). */
export function OtpInput({ length, value, onChange, disabled, autoFocus = true }: { length: 6 | 8; value: string; onChange: (v: string) => void; disabled?: boolean; autoFocus?: boolean }) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setAt = (i: number, ch: string) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join("").slice(0, length));
  };

  return (
    <div className="flex justify-center gap-2" onPaste={(e) => {
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (text) {
        e.preventDefault();
        onChange(text);
        refs.current[Math.min(text.length, length - 1)]?.focus();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          value={d}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-12 w-10 rounded-md border text-center text-lg font-semibold outline-none focus-visible:ring-[3px] disabled:opacity-50",
            length === 8 && "w-9",
          )}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, ch);
            if (ch && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setAt(i - 1, "");
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
