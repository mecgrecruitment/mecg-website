"use client";

import type { FormEvent } from "react";

const BOARD_EMAIL = "mecg-board@umich.edu";

export default function ProjectInquiryForm() {
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const body = [
      `Name: ${value("name")}`,
      `Organization: ${value("organization")}`,
      `Work email: ${value("email")}`,
      `Desired timeline: ${value("timeline")}`,
      "",
      "Decision or problem:",
      value("decision"),
      "",
      "What has already been tried:",
      value("priorWork") || "Not provided",
      "",
      "Available data, stakeholders, or context:",
      value("resources") || "Not provided",
      "",
      "Confidentiality or NDA needs:",
      value("confidentiality") || "None noted",
    ].join("\n");

    window.location.href = `mailto:${BOARD_EMAIL}?subject=${encodeURIComponent(`Project inquiry from ${value("organization")}`)}&body=${encodeURIComponent(body)}`;
  }

  const inputClass = "mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-mecg-navy shadow-[inset_0_0_0_1px_rgba(7,13,31,0.16)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-mecg-blue)] focus-visible:outline-2 focus-visible:outline-mecg-orange focus-visible:outline-offset-2";

  return (
    <form onSubmit={prepareEmail} className="rounded-sm bg-mecg-blue/[0.08] p-6 shadow-[inset_0_0_0_1px_rgba(7,13,31,0.07)] sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Your name
          <input name="name" autoComplete="name" required className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Organization
          <input name="organization" autoComplete="organization" required className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Work email
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Desired timeline
          <input name="timeline" placeholder="For example, Fall 2026" required className={inputClass} />
        </label>
      </div>
      <label className="mt-5 block text-sm font-medium">
        What decision or problem should the project address?
        <textarea name="decision" required rows={4} className={`${inputClass} py-3`} />
      </label>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium">
          What has already been tried?
          <textarea name="priorWork" rows={3} className={`${inputClass} py-3`} />
        </label>
        <label className="text-sm font-medium">
          What data, stakeholders, or context are available?
          <textarea name="resources" rows={3} className={`${inputClass} py-3`} />
        </label>
      </div>
      <label className="mt-5 block text-sm font-medium">
        Confidentiality or NDA needs
        <textarea name="confidentiality" rows={2} className={`${inputClass} py-3`} />
      </label>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" className="button-primary whitespace-nowrap">Prepare inquiry email <span aria-hidden="true">→</span></button>
        <p className="text-sm leading-6 text-mecg-navy/60">This opens a complete draft in your email app. The board replies within one week.</p>
      </div>
    </form>
  );
}
