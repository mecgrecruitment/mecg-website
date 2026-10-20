// Fictional, process-local data for inspecting actual page components. No database.
export const cycle = { id: 'preview-cycle', name: 'Fall recruitment · Sample cycle', status: 'IN_PROCESS', hash_stage: 'GROUP_CASE', hash_quorum: 2, hash_presenting_application_id: null, opens_at: '2026-09-01T12:00:00Z', closes_at: '2026-11-01T03:59:00Z', created_at: '2026-09-01T12:00:00Z' };
const names = ['Alex Chen', 'Jordan Patel', 'Sam Rivera', 'Taylor Brooks', 'Casey Nguyen', 'Riley Morgan'];
const criteria = [{ id: 'collaboration', key: 'collaboration', name: 'Team Collaboration', description: 'Build on others’ ideas and use observed evidence.', weight: 75, required: true, position: 0 }, { id: 'communication', key: 'communication', name: 'Presentation & Communication', description: 'Explain a clear, supported recommendation.', weight: 25, required: false, position: 1 }];
const rubric = { id: 'preview-rubric', version: 1, minimum_observed_criteria: 1, rubric_criteria: criteria };
const rounds = [{ id: 'preview-speed', cycle_id: cycle.id, name: 'Speed Dating', kind: 'SPEED_DATING', status: 'ACTIVE', weight: 40, closes_at: '2026-11-01T00:00:00Z', rubrics: [rubric] }, { id: 'preview-group', cycle_id: cycle.id, name: 'Group Case', kind: 'GROUP_CASE', status: 'ACTIVE', weight: 60, closes_at: '2026-11-05T00:00:00Z', rubrics: [rubric] }];
const applications = names.map((name, i) => ({ id: `preview-app-${i + 1}`, cycle_id: cycle.id, pnm_id: `preview-person-${i + 1}`, status: ['SUBMITTED', 'ELIGIBLE', 'INVITED', 'GROUP_CASE', 'GROUP_CASE', 'FINAL_REVIEW'][i], submitted_at: '2026-10-15T15:00:00Z', resume_storage_path: null, headshot_storage_path: null, answers: { motivation: 'I want to work through practical engineering problems with a thoughtful team.' }, pnms: { id: `preview-person-${i + 1}`, name, contact: `applicant${i + 1}@example.invalid`, major: ['Mechanical Engineering', 'Computer Science', 'Industrial Engineering'][i % 3], class_year: 'JUNIOR', grad_term: 'Winter 2028', college: 'Engineering', phone: '', uniqname: `sample${i + 1}` }, evaluation_assignments: [] }));
const members = ['Morgan Member', 'Bailey Board', 'Parker Panelist', 'Olivia Owner'].map((name, i) => ({ id: `preview-membership-${i}`, user_id: i === 0 ? 'preview-user' : `preview-member-${i}`, cycle_id: cycle.id, role: ['MEMBER', 'BOARD', 'PANEL', 'OWNER'][i], active: true, profiles: { display_name: name, primary_email: `member${i}@example.invalid`, major: 'Engineering', grad_term: 'Winter 2028', bio: 'Fictional member for the local walkthrough.' } }));
const event = { id: 'preview-event', cycle_id: cycle.id, name: 'Group Case evening', status: 'PUBLISHED', starts_at: '2026-10-28T22:00:00Z', ends_at: '2026-10-29T00:00:00Z', location: 'GG Brown · Sample room', kind: 'GROUP_CASE', visibility: 'INVITE', checkin_opens_at: '2026-10-28T21:45:00Z', checkin_closes_at: '2026-10-29T00:00:00Z', checkins: [{ count: 4 }], event_slots: [{ capacity: 12, slot_rsvps: [{ id: 'rsvp-1' }, { id: 'rsvp-2' }] }] };
const assignments = applications.slice(2, 5).map((a, i) => ({ id: `preview-assignment-${i}`, evaluator_id: 'preview-user', round_id: 'preview-group', status: i === 0 ? 'SUBMITTED' : 'ASSIGNED', updated_at: '2026-10-16T16:00:00Z', applications: a, rounds: rounds[1], evaluations: [], application_id: a.id }));
const response = 'In a sample design project, I compared two prototype approaches, asked the team to test the uncertain assumptions, and changed the recommendation after reviewing their observations.';
const packets = applications.map((a, i) => ({ id: `preview-packet-${i}`, code: `MECG-${101 + i}`, applicantName: a.pnms.name, status: 'APPROVED', content: { responses: [{ question: 'Tell us about a problem you worked through with a team.', answer: response }] } }));
const applicationResponses = applications.flatMap(application => [
  { application_id: application.id, question_key: 'teamwork', question_text: 'Tell us about a problem you worked through with a team.', question_word_limit: 250, response_text: response + '\n\nWe disagreed about whether to optimize the first prototype or try a simpler design. I asked everyone to write down what evidence would change their recommendation. That gave us a shared test plan and helped us separate our preferences from the actual constraints.\n\nAfter testing, we chose the simpler approach. I documented the remaining tradeoffs so the next team could understand our reasoning. This is fictional sample text for reviewing the reading layout.' },
  { application_id: application.id, question_key: 'motivation', question_text: 'What would you like to contribute to MECG?', question_word_limit: 200, response_text: 'I would bring a habit of asking precise questions, documenting decisions, and involving teammates early. I enjoy translating a complicated problem into a few testable assumptions.\n\nI also want to learn how teams turn technical work into recommendations a client can act on. In this fictional application, I am particularly interested in projects where engineering constraints and business needs affect each other.' },
]);
const tableData = { application_responses: applicationResponses, rush_cycles: [cycle], rounds, applications, memberships: members, profiles: [{ id: 'preview-user', display_name: 'Morgan Member', primary_email: 'preview@example.invalid', grad_term: 'Winter 2028', major: 'Mechanical Engineering', position_title: 'Member', bio: 'Fictional preview profile.' }], evaluation_assignments: assignments, events: [event], event_slots: [{ id: 'preview-slot', event_id: event.id, starts_at: event.starts_at, ends_at: event.ends_at, capacity: 12, slot_rsvps: [{ id: 'rsvp-1' }], events: event }], messages: [{ id: 'preview-message', application_id: 'preview-app-4', cycle_id: cycle.id, kind: 'EMAIL', recipient: 'applicant4@example.invalid', subject: 'Your Group Case invitation', delivered: true, created_at: '2026-10-16T15:00:00Z' }], referrals: [], buddy_slots: [], decisions: [], hash_votes: [], event_impressions: [], conflict_declarations: [], notification_outbox: [], calibration_acknowledgements: [] };
const context = { cycleId: cycle.id, isScreeningReviewer: false, openScreeningCount: 3, openEvaluationCount: 2, openCalibrationCount: 0, openLiveEventCount: 0, openTaskCount: 2, hasGradingEvent: false, hasSpeedDatingRound: true, hasGroupCaseWork: true };
function rpc(name) {
  switch (name) {
    case 'workspace_context': return context;
    case 'is_active_screening_reviewer': return false;
    case 'my_round_calibrations': case 'my_grading_events': case 'my_calibration_states': case 'calibration_states': case 'hash_notes': case 'cycle_member_onboarding': case 'my_member_onboarding': case 'cycle_application_questions': return [];
    case 'is_decision_ready': case 'can_start_application': return false;
    case 'my_offer_deadlines': return {};
    case 'member_applicants': return applications.map(a => ({ id: a.id, name: a.pnms.name }));
    case 'cycle_directory': return members.map(m => ({ id: m.user_id, name: m.profiles.display_name, email: m.profiles.primary_email, major: 'Engineering', gradTerm: 'Winter 2028', position: m.role === 'BOARD' ? 'Recruitment' : 'Member', bio: '', roles: [m.role] }));
    case 'my_speed_dating_roster': return { roundId: 'preview-speed', roundName: 'Speed Dating', roundStatus: 'ACTIVE', criterion: { id: 'impression', name: 'Overall impression', description: 'Rate the conversation using observed evidence.' }, rubricReady: true, progress: { scored: 2, total: names.length }, applicants: names.map((name, i) => ({ applicationId: applications[i].id, name, score: i < 2 ? 4 : null, note: i === 0 ? 'Explained their reasoning clearly.' : '', session: i < 3 ? 1 : 2, savedAt: i < 2 ? '2026-10-16T15:00:00Z' : null })) };
    case 'group_case_roster_v2': case 'group_case_roster': return { roundId: 'preview-group', roundName: 'Group Case', roundStatus: 'ACTIVE', canSeeSpeedDating: false, criteria, progress: { scored: 1, total: 4 }, groups: [{ groupId: 'preview-team', groupName: 'Team A · Sample case', applicants: names.slice(0, 4).map((name, i) => ({ revision: null, applicationId: applications[i].id, name, scores: { collaboration: i === 0 ? 4 : null, communication: i === 0 ? 3 : null }, note: i === 0 ? 'Invited quieter teammates into the discussion.' : '', savedAt: i === 0 ? '2026-10-16T15:00:00Z' : null, quality: null, speedDating: null })) }] };
    case 'my_screening_queue': return packets.slice(0, 3).map((p, i) => ({ assignment_id: `preview-reading-${i}`, candidate_code: p.code, assignment_status: 'ASSIGNED' }));
    case 'screening_reviewer_context': return { total: 5, completed: 2, publishedAt: '2026-10-15T12:00:00Z', deadline: '2026-11-01T00:00:00Z' };
    case 'screening_assignment_detail': return { assignmentId: 'preview-reading-0', candidateCode: 'MECG-101', status: 'ASSIGNED', content: packets[0].content, hasResume: false, criteria, scores: [], draft: null };
    case 'screening_admin_overview': return { batchId: 'preview-screening', status: 'PUBLISHED', releasedAt: null, reviewsPerApplication: 3, assigned: 18, submitted: 7, reviewers: members.slice(0, 2).map(m => ({ id: m.user_id, name: m.profiles.display_name, capacity: 12, assigned: 9, submitted: 3 })), packets, results: [] };
    case 'group_case_results': return { roundId: 'preview-group', roundName: 'Group Case', roundStatus: 'ACTIVE', criteria, summary: { applicants: 6, graded: 0, graders: 0, evaluations: 0, saved: 0, savedEvaluations: 0 }, applicants: applications.map(a => ({ applicationId: a.id, name: a.pnms.name, status: a.status, groupName: 'Team A', count: 0, savedCount: 0, completionStatus: 'PENDING', mean: null, criterionMeans: {}, evaluations: [] })), graders: [] };
    case 'recruitment_analytics': return { available: false, minimumCohort: 5 };
    case 'applicant_prior_cycles': return [];
    case 'speed_dating_results': return [];
    case 'hash_tally': return applications.map(a => ({ application_id: a.id, yes_count: 2, no_count: 0, unsure_count: 1, total_votes: 3, quorum: 2, outcome: 'PENDING' }));
    case 'hash_ballot': return applications.filter(a => a.status === 'GROUP_CASE').map(a => ({ id: a.id, application_id: a.id, name: a.pnms.name, major: a.pnms.major, class_year: 'JUNIOR', status: a.status }));
    case 'applicant_dashboard': return [{ application_id: 'preview-app-4', applicant_name: 'Taylor Brooks', cycle_name: cycle.name, display_status: 'GROUP_CASE', released_outcome: null, offer_response: null, has_resume: true, responses: [{ key: 'motivation', prompt: 'Why MECG?', answer: response }] }];
    case 'applicant_schedule': return { rsvps: [{ slotId: 'preview-slot', eventId: event.id, eventName: event.name, startsAt: event.starts_at, endsAt: event.ends_at, location: event.location }], slots: [], buddies: [] };
    case 'public_recruitment': return { cycle: { id: cycle.id, name: cycle.name, status: cycle.status }, events: [{ id: event.id, name: event.name, startsAt: event.starts_at, location: event.location }] };
    default: console.log(`Preview RPC without sample: ${name}`); return [];
  }
}
export function fixtureResponse(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const url = new URL(req.url, 'http://localhost');
  const rpcName = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  // POST is permitted only for known read-only RPC names in this dispatcher.
  if (rpcName && req.method === 'POST') { res.end(JSON.stringify(rpc(rpcName))); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(JSON.stringify({ message: 'Preview is read only' })); return; }
  const table = url.pathname.split('/').at(-1);
  let rows = [...(tableData[table] ?? [])];
  for (const [key, filter] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset'].includes(key) || key.includes('.')) continue;
    if (filter.startsWith('eq.')) rows = rows.filter(row => !(key in row) || String(row[key]) === filter.slice(3));
    if (filter.startsWith('neq.')) rows = rows.filter(row => !(key in row) || String(row[key]) !== filter.slice(4));
    if (filter === 'not.is.null') rows = rows.filter(row => row[key] != null);
  }
  res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
  if (req.method === 'HEAD') { res.end(); return; }
  if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')));
  const single = String(req.headers.accept).includes('application/vnd.pgrst.object+json');
  res.end(JSON.stringify(single ? rows[0] ?? null : rows));
}
