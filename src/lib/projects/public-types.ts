export type PublicProjectCard = {
  readonly slug: string;
  readonly title: string;
  readonly clientLabel: string;
  readonly industry: string;
  readonly semester: string;
  readonly decision: string;
  readonly methods: readonly string[];
  readonly deliverables: readonly string[];
};

export type PublicProjectDetail = PublicProjectCard & {
  readonly context: string;
  readonly constraints: readonly string[];
  readonly handoff?: string;
  readonly memberWork: readonly string[];
};
