# MECG website and recruitment workspace

Michigan Engineering Consulting Group is a student-led, pro-bono consulting group at the University of Michigan, open to every major. Product facts come from `src/lib/site-content.ts`, `src/lib/join-content.ts`, public recruitment RPCs, and the reviewed public-project release boundary. Do not invent clients, outcomes, testimonials, deadlines, or user-study results.

The public site serves two primary tasks: an organization decides whether to discuss a project, and a student understands membership and recruitment before applying. Clients need scope, cost, team, timing, confidentiality, evidence, and a useful next step. Students need eligibility, preparation, evaluation criteria, live dates, and application access.

The private workspace supports saved applications, materials, status and scheduling; independent member reviews; and board recruitment operations. Clerk owns identity. Supabase owns recruitment data, RPC authorization, storage, and database policies. External email delivery is separate from submission state.

The existing Precision Instrument identity in `docs/DESIGN.md` remains authoritative. Public pages persuade and explain; private workspaces prioritize task completion and evidence. Preserve role/conflict checks, blind-review boundaries, existing scoring weights and quorum, immutable submitted evaluations, and explicit decision release. `docs/policies/recruitment-policy.md` records unresolved policy decisions; current behavior is not Board approval.

A local build, AI critique, or emulated-browser pass does not establish production readiness, accessibility conformance, conversion improvement, real-user agreement, or an award. Client publication approval and real operator/user acceptance remain external evidence.
