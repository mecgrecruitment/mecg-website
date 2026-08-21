import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSessionCookie, SESSION_COOKIE_NAME } from "@/lib/session";

export async function currentUser() {
  const cookieStore = await cookies();
  const session = readSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { memberships: { where: { active: true }, include: { cycle: true } } },
  });
  if (!user || !user.active || user.sessionVersion !== session.version) return null;
  return user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireBoard() {
  const user = await requireUser();
  const board = user.memberships.some((membership) =>
    ["BOARD", "OWNER"].includes(membership.role),
  );
  if (!board) redirect("/member");
  return user;
}
