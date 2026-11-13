import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
        <div className="home-container home-cover">
          <div className="home-cover-heading">
            <p className="home-kicker">Michigan Engineering Consulting Group</p>
            <h1 id="home-title">Pro bono consulting, <br />from Michigan.</h1>
          </div>
          <div className="home-cover-note">
            <p>We’re a student-led consulting group at the University of Michigan. Our teams spend a semester researching your business question and developing practical recommendations.</p>
            <Link href="/contact#message" className="button-primary">Discuss a project <Arrow /></Link>
            <Link href={studentAction.href} className="home-text-link">For students: {studentAction.label} <Arrow /></Link>
          </div>
          <figure className="home-cover-photo">
            <Image src="/mecg/members-professional.jpeg" alt="MECG members visiting PwC in Chicago" fill sizes="(min-width: 1200px) 720px, (min-width: 768px) 60vw, 100vw" preload className="object-cover" />
            <figcaption>MECG at PwC, Chicago</figcaption>
          </figure>

        </div>
      </section>
      <section className="home-facts home-container" aria-labelledby="home-facts-title">
        <h2 id="home-facts-title" className="sr-only">MECG at a glance</h2>
        <dl>{STATS.map(stat => <div key={stat.label}><dt>{stat.label}<span>{stat.context}</span></dt><dd>{stat.value}</dd></div>)}</dl>
      </section>

      <section className="home-partners home-container" aria-labelledby="partners-title">
        <h2 id="partners-title" className="sr-only">Organizations we’ve worked with</h2>
        <ul className="home-partner-list">{PAST_PROJECTS.slice(0, 6).map(client => <li key={client.name}><div className="home-partner-logo"><Image src={client.logo} alt="" fill loading="eager" sizes="56px" className="object-contain" /></div><p>{client.name}<span>{client.industry}</span></p></li>)}</ul>
        <p className="home-small-note">Some of the 30+ organizations we’ve worked with. Case studies are published with client approval. <Link href="/work" className="home-text-link">See our work <Arrow /></Link></p>
        {featured && <article className="home-featured"><div><h3>{featured.decision || featured.title}</h3><p>{featured.clientLabel} · {featured.semester}</p></div><p>{featured.context}</p><Link href={`/work/${featured.slug}`} className="home-text-link">Read the engagement <Arrow /></Link></article>}
      </section>

      <section className="home-questions home-container" id="project-questions" aria-labelledby="questions-title">
        <div className="home-section-heading"><p className="home-kicker">Where we can help</p><h2 id="questions-title">How we can help</h2></div>
        <p className="home-questions-intro">Explore the kinds of questions a student team can help you work through.</p>
        <HomeProjectExplorer />
      </section>

      <section className="home-process" aria-labelledby="process-title">
        <div className="home-container">
          <div className="home-process-grid"><div><p className="home-kicker">The engagement</p><h2 id="process-title">How a project works</h2><p>You bring the context. We bring a student team and a structured research process. Here’s how a question becomes a recommendation.</p><dl className="home-semester-facts">{SEMESTER_FACTS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div><HomeEngagement /></div>
          <div className="home-faqs">{[CLIENT_FAQS[2], CLIENT_FAQS[3], CLIENT_FAQS[6]].map(([question, answer]) => <details key={question}><summary>{question}<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 9 6 6 6-6" /></svg></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      <section className="home-community home-container" aria-labelledby="people-title">
        <figure className="home-community-figure"><div className="home-community-photo"><Image src="/mecg/chicago-community-2026.jpeg" alt="MECG members together by the Chicago River" fill loading="eager" sizes="(min-width: 768px) 50vw, 100vw" /></div><figcaption>The chapter in Chicago.</figcaption></figure>
        <div><h2 id="people-title">The people on your team</h2><p>Teams mix majors, so you work beside people who think differently. Members learn through education sessions, mentorship and client work.</p><p>There’s also a chapter to be part of, from professional trips to time together around Ann Arbor.</p><Link href="/team" className="home-text-link">Meet the chapter <Arrow /></Link><Link href={studentAction.href} className="home-text-link">{studentAction.label} <Arrow /></Link></div>
      </section>


    </main>
  );
}
