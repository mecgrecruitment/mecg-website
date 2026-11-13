import type { Project, Row } from "./schema";
const stop = new Set(["the", "and", "what", "which", "does", "with", "from", "this", "that", "are", "can", "how", "for", "was", "our", "you", "have"]);
const words = (text: string) => text.toLowerCase().normalize("NFKC").match(/[a-z0-9]{2,}/g)?.filter(t => !stop.has(t)).map(t => t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t) ?? [];
export type Passage = { source: Row; matched: string[]; score: number };
export function retrieve(project: Project): Passage[] {
  const query = [...new Set(words(project.question))];
  if (!query.length) return [];
  const phrases = [...project.question.matchAll(/"([^"]+)"/g)].map(m => m[1].toLowerCase());
  const corpus = project.records.sources.filter(s => s.authority === "approved" && s.permission.trim() && s.text.trim());
  const documents = corpus.map(s => words(`${s.title} ${s.text}`));
  const frequencies = documents.map(doc => { const counts = new Map<string, number>(); for (const term of doc) counts.set(term, (counts.get(term) ?? 0) + 1); return counts; });
  const documentFrequency = new Map<string, number>();
  for (const counts of frequencies) for (const term of counts.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  const average = documents.reduce((sum, d) => sum + d.length, 0) / Math.max(1, documents.length);
  return corpus.flatMap((source, i) => {
    if (phrases.some(p => !`${source.title} ${source.text}`.toLowerCase().includes(p))) return [];
    const doc = documents[i]; let score = 0; const matched: string[] = [];
    for (const term of query) {
      const frequency = frequencies[i].get(term) ?? 0; if (!frequency) continue;
      const n = documentFrequency.get(term) ?? 0;
      const inverse = Math.log(1 + (corpus.length - n + 0.5) / (n + 0.5));
      score += inverse * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.length / Math.max(1, average)));
      matched.push(term);
    }
    return score ? [{ source, matched, score }] : [];
  }).sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id)).slice(0, 5);
}
