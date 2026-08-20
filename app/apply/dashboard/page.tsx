import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApplicant } from "@/lib/auth";
import { logout } from "../../auth/actions";
import { submitApplicantCheckin } from "../checkin/actions";
import { submitApplication } from "../application/actions";
import { SubmitButton } from "../SubmitButton";
import { ResumeField } from "../ResumeField";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import {
  GRAD_YEARS,
  ESSAY_MAX,
  labelCandidateStage,
  labelCandidateStatus,
  type ApplyQuestion,
} from "@/lib/apply/schema";

type SearchParams = {
  checkin_error?: string;
  checkin_success?: string;
  application_error?: string;
  submitted?: string;
};

function Notice({ type, children }: { type: "success" | "error" | "info"; children: React.ReactNode }) {
  const classes =
    type === "success"
      ? "border-[var(--orange)]/40 bg-[var(--orange)]/10 text-[var(--orange-soft)]"
      : type === "info"
        ? "border-white/15 bg-white/[0.04] text-white/70"
        : "border-red-400/30 bg-red-400/10 text-red-100";
  return <div className={`rounded-[1.5rem] border p-5 ${classes}`}>{children}</div>;
}

function CheckInPanel({
  checkinList,
}: {
  checkinList: { event_title: string | null; checked_in_at: string }[];
}) {
  return (
    <article className="panel rounded-[2rem] p-6 md:p-8">
      <p className="eyebrow">Event Check-In</p>
      <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
        Enter the event phrase.
      </h3>
      <p className="mt-4 text-sm leading-6 text-white/52">
        One field only — your email is already on your session. Ask the host for today&apos;s code.
      </p>

      <form action={submitApplicantCheckin} className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-bold">Event phrase</span>
          <input
            name="event_phrase"
            required
            autoComplete="off"
            placeholder="Example: GOBLUE"
            className="portal-field focus-ring uppercase"
          />
        </label>

        <SubmitButton pendingText="Checking in...">Check In</SubmitButton>
      </form>

      <div className="mt-8">
        <p className="text-sm font-bold text-white">Your open rush check-ins</p>
        {checkinList.length > 0 ? (
          <ul className="mt-3 grid gap-2 text-sm text-white/55">
            {checkinList.map((c, i) => (
              <li key={`${c.checked_in_at}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {c.event_title || "Open Rush Event"} · {new Date(c.checked_in_at).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/40">No open rush check-ins yet.</p>
        )}
      </div>
    </article>
  );
}

export default async function ApplicantDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const applicant = await requireApplicant();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: appRows }, { data: membershipRequest }, { data: checkins }, { data: events }] =
    await Promise.all([
      supabase.rpc("my_application"),
      supabase
        .from("membership_requests")
        .select("status")
        .eq("user_id", applicant.id)
        .maybeSingle(),
      supabase.rpc("my_checkins"),
      supabase
        .from("v_open_rush_events")
        .select("id, title, event_date, location")
        .order("event_date", { ascending: true }),
    ]);

  const application = Array.isArray(appRows) ? appRows[0] : null;
  const checkinList = Array.isArray(checkins) ? checkins : [];
  const attendanceCount = checkinList.length;
  const attendanceTotal = events?.length ?? 0;

  // Cycle + questions via service role (applicants cannot SELECT under RLS).
  const admin = createAdminClient();
  const { data: cycle } = await admin
    .from("recruitment_cycles")
    .select("id, name, applications_open_at, applications_close_at, is_open_rush")
    .eq("is_active", true)
    .maybeSingle();

  const now = new Date();
  const applicationsOpen = Boolean(
    cycle &&
      (!cycle.applications_open_at || new Date(cycle.applications_open_at) <= now) &&
      (!cycle.applications_close_at || new Date(cycle.applications_close_at) > now)
  );

  let questions: ApplyQuestion[] = [];
  if (cycle && applicationsOpen && !application) {
    const { data: questionRows } = await admin
      .from("application_questions")
      .select("key, prompt, required")
      .eq("cycle_id", cycle.id)
      .order("sort_order");
    questions = questionRows ?? [];
  }

  const MEMBERSHIP_STATUS_COPY: Record<string, string> = {
    pending:
      "Your board membership request is pending review. Status updates here when a board member decides — no separate notification email is guaranteed yet.",
    approved:
      "Your board membership request was approved — log out and back in to enter the member portal.",
    denied: "Your board membership request wasn't approved.",
  };

  const membershipBanner = membershipRequest ? (
    <div className="rounded-[1.5rem] border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-5 text-white/80">
      {MEMBERSHIP_STATUS_COPY[membershipRequest.status]}{" "}
      <a href="/auth/request-access" className="underline hover:text-white">
        View request status.
      </a>
    </div>
  ) : null;

  return (
    <div className="grid gap-8">
      {membershipBanner}

      <section className="panel-strong rounded-[2rem] p-7 md:p-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <p className="eyebrow">Applicant Dashboard</p>
            <h2 className="font-display mt-5 max-w-4xl text-5xl font-bold uppercase leading-[0.9] tracking-[-0.07em] md:text-7xl">
              {application
                ? "Application received."
                : `Welcome${applicant.fullName ? `, ${applicant.fullName.split(" ")[0]}` : ""}.`}
            </h2>
            <p className="mt-6 max-w-2xl text-white/58">
              {application
                ? "Status below comes from the recruitment database. Open-rush check-in stays available while events are running."
                : "Your login email is attached to check-ins and your application automatically — you won't re-enter it."}
            </p>
            <p className="mt-3 text-sm text-white/45">Logged in as {applicant.email}</p>
          </div>

          <form action={logout}>
            <button className="rounded-full border border-white/15 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--orange)] hover:text-white">
              Logout
            </button>
          </form>
        </div>
      </section>

      {params?.submitted ? (
        <Notice type="success">Application submitted. Your status is below — no confirmation email is sent yet.</Notice>
      ) : null}
      {params?.checkin_success ? <Notice type="success">{params.checkin_success}</Notice> : null}
      {params?.checkin_error ? <Notice type="error">{params.checkin_error}</Notice> : null}
      {params?.application_error ? <Notice type="error">{params.application_error}</Notice> : null}

      {/* Real DB facts only — no invented progress pipeline. */}
      <section className="grid gap-5 md:grid-cols-3">
        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Profile</p>
          <p className="mt-5 text-sm text-white/40">Name</p>
          <p className="mt-1 text-xl font-bold">{applicant.fullName || "From signup"}</p>
          <p className="mt-5 text-sm text-white/40">Email</p>
          <p className="mt-1 break-all text-xl font-bold">{applicant.email}</p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Open Rush</p>
          <p className="mt-5 text-5xl font-black">
            {attendanceCount}
            {attendanceTotal > 0 ? (
              <span className="text-2xl text-white/40">/{attendanceTotal}</span>
            ) : null}
          </p>
          <p className="mt-3 text-sm text-white/50">
            {attendanceTotal > 0
              ? "Check-ins recorded for open rush events this cycle."
              : "No open rush events are listed right now."}
          </p>
        </article>

        <article className="panel rounded-[1.5rem] p-6">
          <p className="eyebrow">Application</p>
          {application ? (
            <>
              <p className="mt-5 text-2xl font-black">{labelCandidateStatus(application.status)}</p>
              <p className="mt-2 text-sm text-white/55">
                Stage: {labelCandidateStage(application.stage)}
              </p>
              <p className="mt-1 text-sm text-white/40">
                Code {application.display_code}
                {application.submitted_at
                  ? ` · submitted ${new Date(application.submitted_at).toLocaleDateString()}`
                  : null}
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-2xl font-black">
                {applicationsOpen ? "Not submitted" : "Closed"}
              </p>
              <p className="mt-3 text-sm text-white/50">
                {applicationsOpen
                  ? "Submit once below. You can still check into events after submitting."
                  : "Applications are not open. Check-in may still work if an event is running."}
              </p>
            </>
          )}
        </article>
      </section>

      {application ? (
        <Notice type="info">
          Applicant confirmation email is not wired yet (external send is a hard stop). Treat this
          dashboard status as the source of truth — we will not email a separate receipt until that
          is enabled.
        </Notice>
      ) : null}

      <section
        className={`grid gap-5 ${!application ? "lg:grid-cols-2" : ""}`}
      >        <CheckInPanel checkinList={checkinList} />

        {!application && applicationsOpen ? (
          <article className="panel rounded-[2rem] p-6 md:p-8">
            <p className="eyebrow">Application Submission</p>
            <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
              Submit once.
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/52">
              Email is taken from your login. Optional fields can be left blank.
              {cycle?.name ? ` Cycle: ${cycle.name}.` : null}
            </p>

            {questions.length === 0 ? (
              <Notice type="info">
                Application questions are not configured for this cycle yet. Check back later or ask
                recruiting.
              </Notice>
            ) : (
              <form action={submitApplication} className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">Full name</span>
                  <input
                    name="full_name"
                    required
                    defaultValue={applicant.fullName || ""}
                    className="portal-field focus-ring"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold">Graduation year</span>
                    <select name="year" required defaultValue="" className="portal-field focus-ring">
                      <option value="" disabled>
                        Select year
                      </option>
                      {GRAD_YEARS.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold">Major</span>
                    <input
                      name="major"
                      required
                      placeholder="IOE, Data Science, etc."
                      className="portal-field focus-ring"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold">
                      Phone <span className="font-normal text-white/40">(optional)</span>
                    </span>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      className="portal-field focus-ring"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold">
                      LinkedIn <span className="font-normal text-white/40">(optional)</span>
                    </span>
                    <input
                      name="linkedin_url"
                      type="url"
                      placeholder="https://linkedin.com/in/…"
                      className="portal-field focus-ring"
                    />
                  </label>
                </div>

                <ResumeField />

                {questions.map((q) => (
                  <label key={q.key} className="grid gap-2">
                    <span className="text-sm font-bold">
                      {q.prompt}
                      {!q.required ? (
                        <span className="font-normal text-white/40"> (optional)</span>
                      ) : null}
                    </span>
                    <textarea
                      name={q.key}
                      required={q.required}
                      rows={4}
                      maxLength={ESSAY_MAX}
                      className="portal-field focus-ring"
                    />
                  </label>
                ))}

                <TurnstileWidget />

                <SubmitButton pendingText="Submitting...">Submit Application</SubmitButton>
              </form>
            )}
          </article>
        ) : null}

        {!application && !applicationsOpen ? (
          <article className="panel rounded-[2rem] p-6 md:p-8">
            <p className="eyebrow">Application</p>
            <h3 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
              Not open.
            </h3>
            <p className="mt-4 text-sm leading-6 text-white/52">
              Applications are closed or no active cycle is accepting submissions. You can still use
              check-in when an open rush event is running.{" "}
              <Link href="/prospective-members" className="underline hover:text-white">
                Recruitment info
              </Link>
            </p>
          </article>
        ) : null}
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex rounded-full border border-white/15 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-white/60 transition hover:border-[var(--orange)] hover:text-white"
        >
          ← Back to Main Website
        </Link>
      </div>
    </div>
  );
}
