import type { Metadata } from "next";
import MarketingSection from "@/components/marketing-section";
import PageIntro from "@/components/page-intro";
import SectionHeading from "@/components/section-heading";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact MECG about membership, a client project, or a general question.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="bg-white text-mecg-navy">
      <PageIntro title="Contact Us" />
      <MarketingSection id="message" className="scroll-mt-24" innerClassName="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <SectionHeading>Send us a message</SectionHeading>
            <p className="mt-4 max-w-2xl leading-7 text-mecg-navy/65">Ask about recruitment, membership, or a possible client project. Your message goes directly to the MECG board.</p>
            <div className="mt-8"><ContactForm /></div>
          </div>

          <aside className="lg:pt-14">
            <div className="border-y border-mecg-navy/10 py-6">
              <h2 className="text-lg font-semibold">Email</h2>
              <a href="mailto:mecg-board@umich.edu" className="mt-3 inline-block break-all text-mecg-blue">mecg-board@umich.edu</a>
            </div>
            <div id="socials" className="scroll-mt-24 border-b border-mecg-navy/10 py-6">
              <h2 className="text-lg font-semibold">Follow MECG</h2>
              <div className="mt-3 flex flex-col items-start gap-2">
                <a href="https://www.instagram.com/mecgmichigan" target="_blank" rel="noreferrer" className="flex min-h-10 items-center text-mecg-blue">Instagram <span className="sr-only">opens in a new tab</span></a>
                <a href="https://www.linkedin.com/company/michigan-engineering-consulting-group" target="_blank" rel="noreferrer" className="flex min-h-10 items-center text-mecg-blue">LinkedIn <span className="sr-only">opens in a new tab</span></a>
              </div>
            </div>
            <address className="border-b border-mecg-navy/10 py-6 not-italic">
              <h2 className="text-lg font-semibold">University of Michigan</h2>
              <p className="mt-3 leading-7 text-mecg-navy/65">College of Engineering<br />1221 Beal Ave<br />Ann Arbor, MI 48109</p>
            </address>
          </aside>
      </MarketingSection>
    </main>
  );
}
