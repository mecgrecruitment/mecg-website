import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HomePhoto from "@/components/home-photo";
import HomeHeroMotion from "@/components/home-hero-motion";
import HomeProjectExplorer from "@/components/home-project-explorer";
import HomeEngagement from "@/components/home-engagement";
import { marketingMetadata } from "@/lib/seo";
import { getFeaturedPublicProject } from "@/lib/projects/public-projects";
import { fetchPublicRecruitment, recruitmentAction } from "@/lib/public-recruitment";
import { CLIENT_FAQS, PAST_PROJECTS, SEMESTER_FACTS, STATS } from "@/lib/site-content";
import "./home.css";

export const revalidate = 60;
export const metadata: Metadata = marketingMetadata({
  title: "Michigan Engineering Consulting Group",
  description: "Student-led, pro-bono consulting at the University of Michigan. Research, analysis, and practical recommendations for your next decision. Open to all majors.",
  path: "/home",
});

function Arrow() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}

export default async function HomePage() {
  const [recruitment, featured] = await Promise.all([fetchPublicRecruitment(), getFeaturedPublicProject()]);
  const studentAction = recruitmentAction(recruitment.cycle);
  return (
    <main id="main-content" className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <HomePhoto />
        <HomeHeroMotion />
        <div className="home-container">
          <div className="home-hero-stage">
            <h1 id="home-title" aria-label="MECG: pro bono consulting, led by Michigan students."><span className="poster-word home-poster-word">{["M", "E", "C", "G"].map(letter => <span key={letter} className="home-letter">{letter}</span>)}</span> <span className="home-hero-rest">Pro bono consulting, led by Michigan students.</span></h1>
            <div className="home-hero-actions"><Link href="/contact#message" className="button-primary">Discuss a project <Arrow /></Link><Link href={studentAction.href} className="home-text-link">{studentAction.label} <Arrow /></Link></div>
          </div>
          <div className="home-facts">
            <h2 className="sr-only">MECG at a glance</h2>
            <dl>{STATS.map(stat => <div key={stat.label}><dt>{stat.label}<span>{stat.context}</span></dt><dd>{stat.value}</dd></div>)}</dl>
          </div>
        </div>
      </section>

      <section className="home-partners home-container" aria-labelledby="partners-title">
        <h2 id="partners-title" className="sr-only">Organizations we’ve worked with</h2>
        <ul className="home-partner-list">{PAST_PROJECTS.slice(0, 6).map(client => <li key={client.name}><div className="home-partner-logo"><Image src={client.logo} alt="" fill sizes="56px" className="object-contain" /></div><p>{client.name}<span>{client.industry}</span></p></li>)}</ul>
        <p className="home-small-note">Six of the 30+ organizations we’ve worked with. Case studies are published with client approval. <Link href="/work" className="home-text-link">See them all <Arrow /></Link></p>
        {featured && <article className="home-featured"><div><h3>{featured.decision || featured.title}</h3><p>{featured.clientLabel} · {featured.semester}</p></div><p>{featured.context}</p><Link href={`/work/${featured.slug}`} className="home-text-link">Read the engagement <Arrow /></Link></article>}
      </section>

      <section className="home-questions home-container" id="project-questions" aria-labelledby="questions-title">
        <h2 id="questions-title">What are you working through?</h2>
        <p className="home-questions-intro">Five areas, five example questions. Choose one to see where a project could start.</p>
        <HomeProjectExplorer />
      </section>

      <section className="home-process" aria-labelledby="process-title">
        <div className="home-container">
          <div className="home-process-grid"><div><h2 id="process-title">How a semester works.</h2><p>You bring the context. We bring a student team and a structured research process. Here’s how a question becomes a recommendation.</p><dl className="home-semester-facts">{SEMESTER_FACTS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div><HomeEngagement /></div>
          <div className="home-faqs">{[CLIENT_FAQS[2], CLIENT_FAQS[3], CLIENT_FAQS[6]].map(([question, answer]) => <details key={question}><summary>{question}<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className="home-community home-container" aria-labelledby="people-title">
        <figure className="home-community-figure"><div className="home-community-photo"><Image src="/mecg/chicago-community-2026.jpeg" alt="MECG members together by the Chicago River" fill sizes="(min-width: 768px) 50vw, 100vw" /></div><figcaption>The chapter in Chicago.</figcaption></figure>
        <div><h2 id="people-title">You’ll know the people<br />you work with.</h2><p>Teams mix majors, so you work beside people who think differently. Members learn through education sessions, mentorship and client work.</p><p>There’s also a chapter to be part of, from professional trips to time together around Ann Arbor.</p><Link href="/team" className="home-text-link">Meet the chapter <Arrow /></Link><Link href={studentAction.href} className="home-text-link">{studentAction.label} <Arrow /></Link></div>
      </section>

      <section className="home-next" aria-labelledby="next-title"><div className="home-container home-next-grid"><div><h2 id="next-title">Tell us the decision you’re facing.</h2><p>We’ll talk through fit, timing and what a useful answer would look like.</p><Link href="/contact#message" className="button-primary">Discuss a project <Arrow /></Link></div><div className="home-student-next"><h3>Students: every major, no experience needed.</h3><p>See recruitment dates, how we evaluate applications and how to prepare.</p><Link href={studentAction.href} className="home-next-student-link">{studentAction.label} <Arrow /></Link></div></div></section>
    </main>
  );
}
