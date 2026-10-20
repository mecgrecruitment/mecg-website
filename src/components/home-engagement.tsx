"use client";

import { useId, useState } from "react";
import { ENGAGEMENT_STEPS } from "@/lib/site-content";

type Step = (typeof ENGAGEMENT_STEPS)[number];

export default function HomeEngagement() {
  const [selected, setSelected] = useState<Step>(ENGAGEMENT_STEPS[0]);
  const id = useId();
  return <figure className="home-engagement" aria-label="Explore the four steps of a MECG engagement">
    <div className="home-step-buttons" role="group" aria-label="Engagement stations">
      {ENGAGEMENT_STEPS.map(step => <button type="button" key={step[0]} aria-pressed={selected === step} aria-controls={id} onClick={() => setSelected(step)}><span className="home-step-number">{step[0]}</span><span>{step[1]}</span></button>)}
    </div>
    <figcaption id={id} aria-live="polite" aria-atomic="true"><div key={selected[0]} className="home-step-content"><h3>{selected[1]}</h3><p>{selected[2]}</p><div className="home-step-handoff"><span>What you leave with</span><p>{selected[3]}</p></div></div></figcaption>
  </figure>;
}
