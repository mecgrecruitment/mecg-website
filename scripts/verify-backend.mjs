import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3001";
const ownerEmail = (process.env.OWNER_EMAIL ?? "admin@mecg.local").toLowerCase();
const ownerPassword = process.env.ADMIN_PASSWORD;
if (!ownerPassword) throw new Error("ADMIN_PASSWORD is required");

const stamp = Date.now();
const cycleName = `Backend verification ${stamp}`;
const applicantContact = `backend-applicant-${stamp}@example.test`;
const memberOneEmail = `backend-member-one-${stamp}@example.test`;
const memberTwoEmail = `backend-member-two-${stamp}@example.test`;
const badLoginEmail = `backend-bad-login-${stamp}@example.test`;
const memberPassword = "BackendVerify!123";
const changedMemberPassword = "BackendVerify!456";
const initialUserCount = await prisma.user.count();
const initialThrottleKeys = (await prisma.loginThrottle.findMany({ select: { key: true } })).map((record) => record.key);
let cycleId;

async function request(path, options = {}, expected = [200]) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!expected.includes(response.status)) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return { response, body };
}

async function login(email, password) {
  const result = await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = result.response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Login did not issue a session cookie");
  return cookie;
}

const json = (cookie, body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

try {
  const ownerCookie = await login(ownerEmail, ownerPassword);
  const setup = await request("/api/admin/setup", json(ownerCookie, { name: cycleName }), [201]);
  cycleId = setup.body.id;

  await request("/api/admin/rush", json(ownerCookie, { action: "SET_CYCLE_STATUS", cycleId, status: "OPEN" }));
  const applicationResult = await request("/api/apply", json(null, { name: "Backend Applicant", contact: applicantContact, consent: true }), [201]);
  if (!applicationResult.body.portalToken) throw new Error("Initial application did not return its portal token");
  const duplicate = await request("/api/apply", json(null, { name: "Backend Applicant", contact: applicantContact, consent: true }), [202]);
  if (duplicate.body.portalToken) throw new Error("Duplicate application leaked the existing portal token");

  await request("/api/admin/rush", json(ownerCookie, { action: "SET_CYCLE_STATUS", cycleId, status: "IN_PROCESS" }));
  for (const [name, email, roles] of [
    ["Backend Member One", memberOneEmail, ["MEMBER"]],
    ["Backend Member Two", memberTwoEmail, ["MEMBER", "PANEL"]],
  ]) {
    for (const role of roles) {
      await request("/api/admin/rush", json(ownerCookie, { action: "ADD_USER", cycleId, name, email, password: memberPassword, role }), [201]);
    }
  }

  const [application, rounds, memberOne, memberTwo] = await Promise.all([
    prisma.application.findFirstOrThrow({ where: { cycleId, pnm: { contact: applicantContact } } }),
    prisma.round.findMany({ where: { cycleId }, include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } }),
    prisma.user.findUniqueOrThrow({ where: { email: memberOneEmail } }),
    prisma.user.findUniqueOrThrow({ where: { email: memberTwoEmail } }),
  ]);

  for (const round of rounds) {
    for (const evaluator of [memberOne, memberTwo]) {
      await request("/api/admin/rush", json(ownerCookie, { action: "ASSIGN", cycleId, roundId: round.id, applicationId: application.id, evaluatorId: evaluator.id }), [201]);
    }
    await request("/api/admin/rush", json(ownerCookie, { action: "SET_ROUND_STATUS", cycleId, roundId: round.id, status: "ACTIVE" }), [409]);
    await request("/api/admin/rush", json(ownerCookie, { action: "SET_ROUND_STATUS", cycleId, roundId: round.id, status: "PUBLISHED" }));
    await request("/api/admin/rush", json(ownerCookie, { action: "SET_ROUND_STATUS", cycleId, roundId: round.id, status: "ACTIVE" }));
  }

  const memberOneCookie = await login(memberOneEmail, memberPassword);
  const memberTwoCookie = await login(memberTwoEmail, memberPassword);
  for (const evaluator of [
    { user: memberOne, cookie: memberOneCookie },
    { user: memberTwo, cookie: memberTwoCookie },
  ]) {
    const assignments = await prisma.evaluationAssignment.findMany({ where: { evaluatorId: evaluator.user.id, round: { cycleId } }, include: { round: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } } } });
    for (const assignment of assignments) {
      const criteria = assignment.round.rubric.criteria;
      const validRatings = criteria.map((criterion) => ({ criterionId: criterion.id, score: 4, note: "" }));
      if (evaluator.user.id === memberOne.id && assignment.id === assignments[0].id) {
        const malformed = validRatings.map((rating, index) => index === validRatings.length - 1 ? { ...rating, criterionId: validRatings[0].criterionId } : rating);
        await request(`/api/member/evaluations/${assignment.id}`, json(evaluator.cookie, { ratings: malformed }), [400]);
      }
      await request(`/api/member/evaluations/${assignment.id}`, json(evaluator.cookie, { ratings: validRatings, evidence: "Observed during backend verification" }), [201]);
    }
  }

  await request("/api/admin/decisions", json(memberOneCookie, { action: "CREATE", cycleId, applicationId: application.id, outcome: "OFFER", reason: "Should be forbidden" }), [403]);
  for (const round of rounds) {
    await request("/api/admin/rush", json(ownerCookie, { action: "SET_ROUND_STATUS", cycleId, roundId: round.id, status: "FROZEN" }));
  }
  const lockedEvaluations = await prisma.evaluation.count({ where: { assignment: { round: { cycleId } }, status: "LOCKED" } });
  if (lockedEvaluations !== 4) throw new Error(`Expected 4 locked evaluations, found ${lockedEvaluations}`);

  await request("/api/admin/rush", json(ownerCookie, { action: "SET_CYCLE_STATUS", cycleId, status: "DECISION_LOCK" }));
  const decisionResult = await request("/api/admin/decisions", json(ownerCookie, { action: "CREATE", cycleId, applicationId: application.id, outcome: "OFFER", reason: "Complete evidence from both structured rounds" }), [201]);
  const decisionId = decisionResult.body.id;
  const firstApproval = await request("/api/admin/decisions", json(ownerCookie, { action: "APPROVE", decisionId }));
  if (firstApproval.body.locked) throw new Error("One approval locked a decision");
  const secondApproval = await request("/api/admin/decisions", json(memberTwoCookie, { action: "APPROVE", decisionId }));
  if (!secondApproval.body.locked) throw new Error("Two valid approvals did not lock the decision");
  await request("/api/admin/decisions", json(ownerCookie, { action: "RELEASE", decisionId }));

  const portal = await request(`/applicant/${applicationResult.body.portalToken}`);
  if (!String(portal.body).includes("OFFER")) throw new Error("Released outcome did not appear in the applicant portal");

  await request("/api/account/password", json(memberOneCookie, { currentPassword: memberPassword, newPassword: changedMemberPassword }));
  await request("/member", { headers: { Cookie: memberOneCookie }, redirect: "manual" }, [307]);
  await request("/api/admin/login", json(null, { email: memberOneEmail, password: memberPassword }), [401]);
  await login(memberOneEmail, changedMemberPassword);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await request("/api/admin/login", json(null, { email: badLoginEmail, password: "incorrect-password" }), [401]);
  }
  await request("/api/admin/login", json(null, { email: badLoginEmail, password: "incorrect-password" }), [429]);

  console.log("backend verification passed: duplicate privacy, state guards, role isolation, 4 evaluations, 2 approvals, release, session revocation, and throttle");
} finally {
  if (cycleId) {
    const testUsers = await prisma.user.findMany({ where: { email: { in: [memberOneEmail, memberTwoEmail] } }, select: { id: true } });
    const testUserIds = testUsers.map((user) => user.id);
    await prisma.decisionApproval.deleteMany({ where: { decision: { cycleId } } });
    await prisma.decision.deleteMany({ where: { cycleId } });
    await prisma.auditEvent.deleteMany({ where: { cycleId } });
    await prisma.application.deleteMany({ where: { cycleId } });
    await prisma.round.deleteMany({ where: { cycleId } });
    await prisma.membership.deleteMany({ where: { cycleId } });
    await prisma.event.deleteMany({ where: { cycleId } });
    await prisma.rushCycle.deleteMany({ where: { id: cycleId } });
    await prisma.pnm.deleteMany({ where: { contact: applicantContact, applications: { none: {} }, checkins: { none: {} } } });
    if (testUserIds.length) await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  }
  const throttleKey = createHash("sha256").update(`${badLoginEmail}\0unknown`).digest("hex");
  if (initialThrottleKeys.length) {
    await prisma.loginThrottle.deleteMany({ where: { OR: [{ key: throttleKey }, { key: { notIn: initialThrottleKeys } }] } });
  } else {
    await prisma.loginThrottle.deleteMany();
  }
  if (initialUserCount === 0) {
    await prisma.user.deleteMany({ where: { email: ownerEmail, memberships: { none: {} } } });
  }
  await prisma.$disconnect();
}
