"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";

export type ClientProjectProfile = {
  readonly name: string;
  readonly logo: string;
  readonly industry: string;
  readonly description: string;
  readonly website: string;
  readonly websiteLabel?: string;
};

export default function ClientProjectGrid({
  projects,
}: {
  readonly projects: readonly ClientProjectProfile[];
}) {
  const [selectedName, setSelectedName] = useState("");
  const selectedProject = useMemo(
    () => projects.find((project) => project.name === selectedName),
    [projects, selectedName],
  );
  const selectedIndex = projects.findIndex((project) => project.name === selectedName);
  // On a two-column phone grid the profile opens directly under the tapped row.
  const phoneOrder = Math.min(selectedIndex | 1, projects.length - 1) * 2 + 1;

  if (!projects.length) return null;

  return (
    <div className="mt-6">

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-mecg-navy/10 sm:grid-cols-3 lg:grid-cols-5">
        {projects.map((project, index) => {
          const selected = project.name === selectedName;

          return (
            <button
              key={project.name}
              type="button"
              aria-controls={selected ? "selected-client-profile" : undefined}
              aria-pressed={selected}
              aria-label={`View information about ${project.name}`}
              onClick={() => setSelectedName(project.name)}
              style={{ order: index * 2 }}
              className={`${projects.length % 2 === 1 && index === projects.length - 1 ? "col-span-2 sm:col-span-1 " : ""}group relative flex min-h-28 cursor-pointer sm:min-h-36 flex-col items-center justify-center overflow-hidden bg-white px-1 py-4 text-center sm:p-5 transition-colors duration-150 hover:bg-mecg-blue/[0.045] ${
                selected ? "bg-mecg-blue/[0.07] shadow-[inset_0_0_0_2px_rgba(63,99,175,0.8)]" : ""
              }`}
            >
              <span className="relative h-12 w-full max-w-40 shrink-0 transition-transform sm:h-16 duration-150 group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
                <Image
                  src={project.logo}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="(min-width: 1024px) 12vw, (min-width: 640px) 24vw, 60vw"
                />
              </span>
              <span className={`mt-3 text-[13px] leading-snug font-semibold tracking-[-0.01em] sm:absolute sm:inset-x-3 sm:bottom-3 sm:mt-0 sm:tracking-normal transition-opacity duration-150 ${selected ? "text-mecg-blue" : "text-mecg-navy/65"}`}>
                {project.name}<span aria-hidden="true" className="hidden sm:inline"> →</span>
              </span>
            </button>
          );
        })}
      {selectedProject ? (
        <article
          id="selected-client-profile"
          aria-live="polite"
          style={{ "--phone-order": phoneOrder } as CSSProperties}
          className="col-span-full order-[var(--phone-order)] grid bg-public-ground sm:order-[9999] lg:grid-cols-[0.72fr_1.28fr]"
        >
        <div className="hidden min-h-52 items-center justify-center bg-white/75 p-8 sm:flex lg:min-h-72">
          <div className="relative h-28 w-full max-w-56 sm:h-36">
            <Image
              key={selectedProject.logo}
              src={selectedProject.logo}
              alt={`${selectedProject.name} logo`}
              fill
              className="object-contain"
              sizes="(min-width: 1024px) 22rem, 70vw"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <p className="text-[13px] font-semibold text-mecg-blue">
            {selectedProject.industry}
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {selectedProject.name}
          </h3>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-mecg-navy/70">
            {selectedProject.description}
          </p>

          <div className="mt-7 border-t border-mecg-navy/10 pt-5">
            <p className="text-[13px] font-semibold text-mecg-navy/70">
              MECG engagement
            </p>
            <p className="mt-2 leading-7 text-mecg-navy/60">
              MECG has worked with {selectedProject.name}. The project scope, methods, deliverables, and outcomes are pending approval for public release.
            </p>
          </div>

          <a
            href={selectedProject.website}
            target="_blank"
            rel="noreferrer"
            className="button-secondary mt-7 self-start"
            aria-label={`${selectedProject.websiteLabel ?? `Visit ${selectedProject.name}`} in a new tab`}
          >
            {selectedProject.websiteLabel ?? `Visit ${selectedProject.name}`} <span aria-hidden="true">↗</span>
          </a>
        </div>
        </article>
      ) : null}
      </div>
      <p className="mt-4 max-w-3xl text-[15px] leading-6 text-mecg-navy/70">
        Select an organization to learn more about its work. MECG publishes engagement details only after the client and our board approve them.
      </p>
    </div>
  );
}
