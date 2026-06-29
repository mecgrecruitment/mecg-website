import React from "react";
import { signInWithGoogle } from "./actions";

// "Continue with Google" — posts to the signInWithGoogle server action, which
// redirects to Google's consent screen. Requires the Google provider creds in
// supabase/config.toml; without them the action surfaces a friendly error.
export function GoogleButton({
  next,
  label = "Continue with Google",
}: {
  next?: string;
  label?: string;
}) {
  return (
    <form action={signInWithGoogle}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-6 py-4 text-xs font-extrabold uppercase tracking-[0.16em] text-white/85 transition-colors hover:border-[var(--orange)] hover:text-white"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.24 1.4-.96 2.6-2.05 3.4v2.8h3.32C20.7 18.5 21.7 15.6 21.7 12.2c0-.76-.07-1.5-.2-2.2H12z"
          />
          <path
            fill="#34A853"
            d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.32-2.8c-.92.62-2.1.98-3.3.98-2.54 0-4.7-1.72-5.47-4.03H3.1v2.9C4.76 19.84 8.13 22 12 22z"
          />
          <path
            fill="#4A90D9"
            d="M6.53 13.72A6 6 0 0 1 6.2 12c0-.6.1-1.18.27-1.72v-2.9H3.1A10 10 0 0 0 2 12c0 1.6.38 3.12 1.1 4.62l3.43-2.9z"
          />
          <path
            fill="#FBBC05"
            d="M12 6.25c1.47 0 2.78.5 3.82 1.5l2.86-2.86C16.95 3.3 14.7 2.4 12 2.4 8.13 2.4 4.76 4.56 3.1 7.88l3.43 2.9C7.3 8.47 9.46 6.25 12 6.25z"
          />
        </svg>
        {label}
      </button>
    </form>
  );
}
