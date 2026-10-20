"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SERVICES } from "@/lib/site-content";

type Service = (typeof SERVICES)[number];

export default function HomeProjectExplorer() {
  const [service, setService] = useState<Service>(SERVICES[0]);
  const panelId = useId();
  return (
    <div className="home-explorer">
      <div className="home-topic-list" role="group" aria-label="Explore a project area">
        {SERVICES.map((item, index) => (
          <button key={item.title} type="button" aria-pressed={service === item} aria-controls={panelId} onClick={() => setService(item)}>
            <span className="home-topic-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="home-topic-title">{item.title}</span>
            <span className="home-topic-question" aria-hidden="true">{item.question}</span>
          </button>
        ))}
      </div>
      <div id={panelId} className="home-question public-lit" role="region" aria-label="Project approach" aria-live="polite" aria-atomic="true">
        <div key={service.title} className="home-question-content">
          <p className="home-example-label">Example question · {service.title}</p>
          <h3>{service.question}</h3>
          <p>{service.approach}</p>
        </div>
        <div className="home-question-actions">
          <Link href={`/contact?subject=${encodeURIComponent(`${service.title} project inquiry`)}&question=${encodeURIComponent(service.question)}#message`} className="button-light">Discuss this question <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></Link>
          <p className="home-example-note">A possible starting point. We’ll define the scope together.</p>
        </div>
      </div>
    </div>
  );
}
