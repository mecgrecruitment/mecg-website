"use client";

import React from "react";
import { contact } from "@/lib/site-content";

const inputClasses =
  "focus-ring w-full rounded-[0.85rem] border border-white/12 bg-white/[0.045] px-5 py-4 text-base text-white placeholder:text-white/35 outline-none transition-colors focus:border-[var(--orange)]/70";

// A form with a `mailto:` action submits as a GET and the mail client drops the
// fields — the message is silently lost. Build the mailto URL ourselves so the
// visitor's mail client opens pre-filled with everything they typed.
export function ContactForm() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const subject = String(data.get("subject") ?? "");
    const body = [
      `Name: ${data.get("name") ?? ""}`,
      `Email: ${data.get("email") ?? ""}`,
      "",
      String(data.get("message") ?? ""),
    ].join("\n");

    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel grid gap-4 rounded-[2rem] p-7 md:p-10"
      data-reveal
    >
      <p className="annotation annotation-accent">Message the board</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="annotation !text-white/45">Full name</span>
          <input name="name" required placeholder="Your name" className={inputClasses} />
        </label>
        <label className="grid gap-2">
          <span className="annotation !text-white/45">Email</span>
          <input name="email" required type="email" placeholder="you@umich.edu" className={inputClasses} />
        </label>
      </div>
      <label className="grid gap-2">
        <span className="annotation !text-white/45">Subject</span>
        <input name="subject" required placeholder="What is this about?" className={inputClasses} />
      </label>
      <label className="grid gap-2">
        <span className="annotation !text-white/45">Message</span>
        <textarea name="message" required placeholder="Tell us about it" rows={8} className={inputClasses} />
      </label>
      <button
        data-magnetic
        className="focus-ring mt-2 justify-self-start rounded-full bg-[var(--orange)] px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-[var(--navy-950)]"
      >
        Send message
      </button>
    </form>
  );
}
