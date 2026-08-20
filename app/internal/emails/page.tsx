import React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireBoard } from "@/lib/auth";

// Keyed by real candidate_status decision outcomes (set by board in Hash).
const templates = [
  {
    status: "accepted",
    label: "Accepted",
    subject: "MECG Recruitment Decision",
    body:
      "Hi,\n\nCongratulations! We are excited to offer you a spot in MECG.\n\nWe will follow up soon with next steps.\n\nBest,\nMECG Recruitment",
  },
  {
    status: "waitlisted",
    label: "Waitlisted",
    subject: "MECG Recruitment Decision",
    body:
      "Hi,\n\nThank you for taking the time to go through MECG recruitment. At this time, we are placing you on our waitlist and will follow up if a spot becomes available.\n\nBest,\nMECG Recruitment",
  },
  {
    status: "rejected",
    label: "Rejected",
    subject: "MECG Recruitment Decision",
    body:
      "Hi,\n\nThank you for taking the time to participate in MECG recruitment. We truly appreciate your interest and the effort you put into the process. Unfortunately, we are not able to offer you a spot at this time.\n\nWe wish you the best and encourage you to stay connected with MECG in the future.\n\nBest,\nMECG Recruitment",
  },
];

function mailtoLink(emails: string[], subject: string, body: string) {
  const bcc = emails.join(",");
  return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function EmailCenterPage() {
  await requireBoard();
  const supabase = await createClient();

  const { data: candidates, error } = await supabase
    .from("candidates")
    .select("email, full_name, status")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  const candidateList = candidates ?? [];

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Board Email Center</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Mailto drafts only.
        </h2>
        <p className="mt-5 max-w-2xl text-white/58">
          This page does <strong className="font-bold text-white/80">not</strong> send email.
          It opens a draft in your mail app via{" "}
          <code className="font-mono text-[var(--orange-soft)]">mailto:</code>. Review the BCC
          list and message there, then send from your client if you choose.
        </p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-100">
          Could not load recipients: {error.message}
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const recipients = candidateList.filter((c) => c.status === template.status);
          const emails = recipients.map((r) => r.email).filter(Boolean) as string[];

          return (
            <article key={template.status} className="panel rounded-[2rem] p-6">
              <p className="eyebrow">{template.label}</p>
              <h3 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              </h3>
              <p className="mt-2 text-xs text-white/40">
                From Hash decisions with status &ldquo;{template.status}&rdquo;.
              </p>

              <div className="mt-5 max-h-40 overflow-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/55">
                {recipients.length > 0 ? (
                  recipients.map((c) => (
                    <p key={c.email}>
                      {c.full_name} · {c.email}
                    </p>
                  ))
                ) : (
                  <p>No candidates currently have this status — draft button stays disabled.</p>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
                  Draft subject
                </p>
                <p className="mt-2 text-sm text-white/70">{template.subject}</p>
              </div>

              {recipients.length > 0 ? (
                <a
                  href={mailtoLink(emails, template.subject, template.body)}
                  className="mt-5 inline-block rounded-full border border-[var(--orange)]/40 bg-[var(--orange)]/15 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--orange-soft)] transition hover:bg-[var(--orange)]/25"
                >
                  Open mailto draft
                </a>
              ) : (
                <span
                  className="mt-5 inline-block rounded-full bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/30"
                  aria-disabled="true"
                >
                  No recipients — cannot open draft
                </span>
              )}
              <p className="mt-3 text-xs text-white/35">
                Opens your email app. Nothing is marked sent in this portal.
              </p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
