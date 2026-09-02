export type EventObservation = {
  applicationId: string;
  tags: string[];
  note: string;
};

export type EventObservationSummary = {
  count: number;
  topTags: string[];
  notes: string[];
};

export function summarizeEventObservations(observations: EventObservation[]) {
  const groups = new Map<string, { count: number; tagCounts: Map<string, number>; notes: string[] }>();

  for (const observation of observations) {
    const group = groups.get(observation.applicationId) ?? {
      count: 0,
      tagCounts: new Map<string, number>(),
      notes: [],
    };
    group.count += 1;
    for (const rawTag of observation.tags) {
      const tag = rawTag.trim();
      if (tag) group.tagCounts.set(tag, (group.tagCounts.get(tag) ?? 0) + 1);
    }
    const note = observation.note.trim();
    if (note) group.notes.push(note);
    groups.set(observation.applicationId, group);
  }

  return new Map<string, EventObservationSummary>([...groups].map(([applicationId, group]) => [
    applicationId,
    {
      count: group.count,
      topTags: [...group.tagCounts]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([tag]) => tag),
      notes: group.notes,
    },
  ]));
}
