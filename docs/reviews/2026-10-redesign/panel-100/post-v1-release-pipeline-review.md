# Separate current-tree release/pipeline source QA

Coordinator source review only, not a panel vote. Inspected ReleaseAllButton in decision-form.tsx and PipelineBoard advancement review/result/failure paths in pipeline-board.tsx, including searchable/filterable review, focus and deadline use.

No actionable defect found in the targeted changes by bounded source inspection. Release filters affect only visible items; the POST still uses the complete reviewed snapshot. Pending writes disable review filters. Cancel returns focus to the review trigger; release completion moves focus to the result, and unknown/invalid results discard the stale review with a refresh instruction. Advancement captures its reviewed IDs separately, uses a full-body deadline and validated result counts, and clears pending selection/review on an uncertain outcome while directing the operator to inspect the refreshed roster. Review/result regions receive focus; cancellation restores its trigger. Large cohorts retain a bounded scrollable review list and explicit full-cohort semantics.

Limits: source only; did not reproduce the large-cohort browser case, integration effects or parent check counts. Unrelated individual decision controls and drag/drop persistence were not comprehensively audited. This source result does not establish hosted acceptance or change any frozen V1 verdict.
