import React from "react";
import { createDemoAdminClient } from "@/lib/supabase/demo-admin";
import { requireRole } from "@/lib/internal-portal/session";

const templates = [
  {
    status: "progress_to_round_2",
    label: "Progress to Round 2",
    subject: "MECG Recruitment Update",
    body:
      "Hi,\n\nThank you again for your interest in MECG. We enjoyed getting to know you and are excited to invite you to the next round of our recruitment process.\n\nMore details will follow soon.\n\nBest,\nMECG Recruitment",
  },
  {
    status: "progress_to_final_approval",
    label: "Progress to Final Approval",
    subject: "MECG Recruitment Update",
    body:
      "Hi,\n\nThank you for participating in our recruitment process. We are excited to move you forward to the final stage of consideration.\n\nMore details will follow soon.\n\nBest,\nMECG Recruitment",
  },
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
  await requireRole(["board"]);

  const supabase = createDemoAdminClient();

  const { data: candidates } = await supabase
    .from("demo_applications")
    .select("email,full_name,recruitment_status,status")
    .order("full_name", { ascending: true });

  const candidateList = candidates ?? [];

  return (
    <div className="grid gap-8">
      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <p className="eyebrow">Board Email Center</p>
        <h2 className="font-display mt-5 text-5xl font-bold uppercase tracking-[-0.07em] md:text-7xl">
          Ready-to-send emails.
        </h2>
        <p className="mt-5 max-w-2xl text-white/58">
          Choose a decision group, open the email draft, review it, then press send from your email app.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const recipients = candidateList.filter((candidate) => {
            const status = candidate.recruitment_status || candidate.status;
            return status === template.status;
          });

          return (
            <article key={template.status} className="panel rounded-[2rem] p-6">
              <p className="eyebrow">{template.label}</p>
              <h3 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
              </h3>

              <div className="mt-5 max-h-40 overflow-auto rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/55">
                {recipients.length > 0 ? (
                  recipients.map((candidate) => (
                    <p key={candidate.email}>
                      {candidate.full_name} · {candidate.email}
                    </p>
                 ))
                ) : (
                  <p>No candidates currently have this status.</p>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
                  Subject
                </p>
                <p className="mt-2 text-sm text-white/70">{template.subject}</p>
              </div>

              <a
                href={mailtoLink(
                  recipients.map((recipient) => recipient.email),
                  template.subject,
                  template.body
                )}
                className={`mt-5 inline-block rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.14em] ${
                  recipients.length > 0
                    ? "bg-[var(--orange)] text-white"
                    : "pointer-events-none bg-white/10 text-white/30"
                }`}
              >
                Open Email Draft
              </a>
            </article>
          );
        })}
      </section>
    </div>
  );
}
