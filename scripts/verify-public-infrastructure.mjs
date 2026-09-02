import { resolveCname } from "node:dns/promises";

export const REQUIRED_CLERK_CNAMES = new Map([
  ["clerk.mecgmichigan.com", "frontend-api.clerk.services"],
  ["accounts.mecgmichigan.com", "accounts.clerk.services"],
  ["clkmail.mecgmichigan.com", "mail.j9fyrp9lip0l.clerk.services"],
  ["clk._domainkey.mecgmichigan.com", "dkim1.j9fyrp9lip0l.clerk.services"],
  ["clk2._domainkey.mecgmichigan.com", "dkim2.j9fyrp9lip0l.clerk.services"],
]);

export function normalizeDnsName(value) {
  return value.trim().toLowerCase().replace(/\.$/u, "");
}

export async function verifyClerkDns(resolve = resolveCname) {
  const failures = [];
  for (const [host, expected] of REQUIRED_CLERK_CNAMES) {
    let actual = [];
    try {
      actual = (await resolve(host)).map(normalizeDnsName);
    } catch (error) {
      failures.push(`${host}: ${error instanceof Error && "code" in error ? error.code : "unresolved"}`);
      continue;
    }
    if (!actual.includes(expected)) failures.push(`${host}: expected ${expected}, received ${actual.join(", ") || "nothing"}`);
  }
  if (failures.length) throw new Error(`Clerk DNS is not ready:\n- ${failures.join("\n- ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await verifyClerkDns();
  console.log(`Public infrastructure passed: ${REQUIRED_CLERK_CNAMES.size} Clerk CNAME records resolve correctly.`);
}
