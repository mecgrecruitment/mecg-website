// Explicitly synthetic inputs shared by staffing unit and actual-page SSR tests.
export const applications = [
  { id: "early", status: "SUBMITTED" }, { id: "invited", status: "INVITED" },
  { id: "group", status: "GROUP_CASE" }, { id: "process", status: "IN_PROCESS" },
  { id: "final", status: "FINAL_REVIEW" }, { id: "withdrawn", status: "WITHDRAWN" },
  { id: "rejected", status: "REJECTED" }, { id: "waitlisted", status: "WAITLISTED" }, { id: "offered", status: "OFFERED" },
];
export const groupAssignments = [
  ...["group", "early", "invited", "withdrawn"].flatMap((application_id) => [{ application_id, status: "SUBMITTED" }, { application_id, status: "SUBMITTED" }]),
  { application_id: "process", status: "RECUSED" }, { application_id: "process", status: "MISSED" },
  { application_id: "final", status: "ASSIGNED" }, { application_id: "final", status: "SUBMITTED" },
];
export const speedAssignments = [
  { application_id: "invited", status: "ASSIGNED" }, { application_id: "invited", status: "RECUSED" },
  { application_id: "group", status: "ASSIGNED" }, { application_id: "group", status: "IN_PROGRESS" },
  { application_id: "process", status: "SUBMITTED" }, { application_id: "process", status: "LOCKED" },
  { application_id: "final", status: "RECUSED" }, { application_id: "final", status: "MISSED" },
];

