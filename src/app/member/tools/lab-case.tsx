import { labDocuments, labRubric, practiceQuestions } from "@/lib/member-tools/lab-case";
export default function LabCase() {
  return <section className="border-l-2 border-mecg-orange pl-5">
    <p className="text-xs font-semibold uppercase tracking-label text-muted">Starter sprint · synthetic case v1</p>
    <h2 className="mt-2 text-2xl font-semibold text-mecg-navy">Should ExampleCo use a handbook assistant?</h2>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">ExampleCo is fictional. Compare manual search with an assistant that cites the source, handles superseded guidance and says when an answer is unknown. Use only these synthetic documents. A recommendation against adoption can be a strong result.</p>
    <details className="mt-4 rounded-xl bg-white p-5 inset-ring inset-ring-line"><summary className="cursor-pointer font-semibold text-mecg-navy">Open the case pack and submission guide</summary>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-mecg-navy"><li>Answer the practice questions manually. Record answers, sources and elapsed time.</li><li>Build a searchable handbook or AI-assisted demo. Record model/version, setup, costs and excluded actions.</li><li>Compare the same tasks with the demo, including verification time. Record wrong answers and missing citations.</li><li>Ask a separate reviewer to prepare held-out questions before final evaluation. Keep the answer key private.</li><li>Submit a reproducible demo, question-by-question report, effort assumptions and handoff. Do not claim savings from a timed practice alone.</li></ol>
      <h3 className="mt-6 text-lg font-semibold">Source documents</h3><div className="mt-3 divide-y divide-line">{labDocuments.map((doc) => <article key={doc.id} className="py-4"><h4 className="font-semibold">{doc.id} · {doc.title}</h4><p className="mt-2 text-sm leading-6 text-muted">{doc.text}</p></article>)}</div>
      <h3 className="mt-5 text-lg font-semibold">Visible practice questions</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">{practiceQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
      <h3 className="mt-5 text-lg font-semibold">Proposed review rubric</h3><p className="mt-2 text-sm leading-6 text-muted">Score each dimension from 0 (absent) to 3 (reproducible and supported, with limits explained): {labRubric.join("; ")}. The proposed acceptance threshold is 10/15 with evaluation/citations and risk/handoff each at least 2. Confirm criteria and held-out tests before a sprint begins. This workspace does not claim a scheduled event or sponsor.</p>
    </details>
  </section>;
}
