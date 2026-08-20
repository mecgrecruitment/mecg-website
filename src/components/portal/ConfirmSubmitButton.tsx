"use client";

import React from "react";
import { useFormStatus } from "react-dom";

/**
 * Same look as SubmitButton, but requires an explicit browser confirm before
 * the form posts. Use for irreversible or hard-to-undo board actions.
 */
export function ConfirmSubmitButton({
  children,
  pendingText = "Working...",
  confirmMessage,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  confirmMessage: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "focus-ring cursor-pointer rounded-full bg-[var(--orange)] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--orange-soft)] disabled:cursor-not-allowed disabled:opacity-60"
      }
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
