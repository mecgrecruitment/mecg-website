import Link from "next/link";

export default function PortalPage() {
  return (
    <main className="min-h-screen px-5 py-16 text-white md:px-8">
      <section className="mx-auto grid max-w-5xl gap-8">
        <div>
          <p className="eyebrow">MECG Portal</p>
          <h1 className="font-display mt-4 text-5xl font-bold uppercase tracking-[-0.06em] md:text-7xl">
            Choose your path.
          </h1>
          <p className="mt-4 max-w-2xl text-white/58">
            Applicants can create an account and submit materials. Members can
            log in to access the internal portal.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/apply/create"
            className="panel card-hover rounded-[2rem] p-7"
          >
            <p className="eyebrow">Applicant</p>
            <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
              Apply / Create Account
            </h2>
            <p className="mt-4 text-white/52">
              Start an applicant account and continue to the applicant portal.
            </p>
          </Link>

          <Link
            href="/member-login"
            className="panel card-hover rounded-[2rem] p-7"
          >
            <p className="eyebrow">Members</p>
            <h2 className="font-display mt-4 text-4xl font-bold uppercase tracking-[-0.05em]">
              Member Login
            </h2>
            <p className="mt-4 text-white/52">
              Log in as a member, recruitment chair, or board member.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
