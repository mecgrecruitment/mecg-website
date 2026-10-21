import type { Metadata } from "next";
import { MARKETING_METADATA } from "@/lib/seo";
import PageIntro from "@/components/page-intro";
import ContactForm from "./contact-form";

export const metadata: Metadata = MARKETING_METADATA.contact;

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ subject?: string | string[]; question?: string | string[] }> }) {
  const { subject, question } = await searchParams;
  const initialSubject = typeof subject === "string" ? subject.trim().slice(0, 150) : "";
  const exampleQuestion = typeof question === "string" ? question.trim().slice(0, 200) : "";
  const initialMessage = exampleQuestion ? `Example question we started from: ${exampleQuestion}\n\n` : "";
  return (
    <main id="main-content" className="bg-white text-mecg-navy">
      <PageIntro title="Contact Us" copy="Tell us the question you’re working on, or ask about joining. The board replies by email." overlap>
        <a href="mailto:mecg-board@umich.edu" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-mecg-blue underline-offset-4 hover:underline">Or email mecg-board@umich.edu</a>
      </PageIntro>
      <section id="message" className="scroll-mt-24 px-6 pb-16 sm:px-10 sm:pb-20">
        <div className="mx-auto -mt-16 grid max-w-6xl items-start gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          <div className="rounded-xl border border-public-rule bg-white p-6 shadow-lift sm:p-8 [&_:is(input,textarea)]:bg-public-ground">
            <h2 className="sr-only">Send us a message</h2>
            {exampleQuestion ? (
              <div className="public-lit mb-6 rounded-xl p-5">
                <p className="text-[13px] text-white">Your question{initialSubject ? ` · ${initialSubject.replace(/ project inquiry$/, "")}` : ""}</p>
                <p className="display-face mt-1 text-balance text-[26px] leading-[1.05] sm:text-[32px]">{exampleQuestion}</p>
              </div>
            ) : null}
            <ContactForm initialSubject={initialSubject} initialMessage={initialMessage} />
          </div>

          <aside className="lg:pt-16">
            <div className="border-y border-line py-6">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <p className="mt-3 leading-7 text-muted">The board reviews your message and replies by email. For a project inquiry, the first conversation covers fit, timing, and what a useful answer would look like.</p>
              <p className="mt-3 text-[15px] leading-6 text-muted">No consulting fee. A semester of collaboration. Confidentiality needs can be discussed before scoping.</p>
            </div>
            <div className="border-y border-line py-6">
              <h2 className="text-lg font-semibold">Email</h2>
              <a href="mailto:mecg-board@umich.edu" className="mt-3 inline-flex min-h-11 items-center break-all text-mecg-blue">mecg-board@umich.edu</a>
            </div>
            <div id="socials" className="scroll-mt-24 border-b border-line py-6">
              <h2 className="text-lg font-semibold">Follow MECG</h2>
              <div className="mt-3 flex flex-col items-start gap-2">
                <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-mecg-blue">Instagram <span className="sr-only">opens in a new tab</span></a>
                <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-mecg-blue">LinkedIn <span className="sr-only">opens in a new tab</span></a>
              </div>
            </div>
            <address className="border-b border-line py-6 not-italic">
              <h2 className="text-lg font-semibold">University of Michigan</h2>
              <p className="mt-3 leading-7 text-muted">College of Engineering<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p>
            </address>
          </aside>
        </div>
      </section>
    </main>
  );
}
