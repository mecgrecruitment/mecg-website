import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function ApplicantPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const application = await prisma.application.findUnique({ where: { portalToken: token }, include: { pnm: true, cycle: true, decisions: { where: { status: "RELEASED" }, orderBy: { releasedAt: "desc" }, take: 1 } } });
  if (!application) notFound();
  const decision = application.decisions[0];
  return <main className="mx-auto flex min-h-dvh max-w-xl items-center p-6"><section className="w-full rounded-2xl border bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-medium text-orange-700">{application.cycle.name}</p><h1 className="mt-1 text-3xl font-semibold">Welcome, {application.pnm.name}</h1><div className="mt-6 rounded-xl bg-gray-50 p-4"><p className="text-sm text-gray-500">Application status</p><p className="text-lg font-semibold">{decision ? decision.outcome : application.status}</p>{decision ? <p className="mt-2 text-sm text-gray-600">This outcome has been approved and released by the MECG Board.</p> : <p className="mt-2 text-sm text-gray-600">No final outcome has been released. Keep this private link to check again later.</p>}</div><p className="mt-5 text-xs text-gray-500">This link gives access to your application status. Do not share it.</p></section></main>;
}
