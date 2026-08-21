import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!verifyPassword(currentPassword, user.passwordHash)) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  if (newPassword.length < 12 || newPassword.length > 1024) return NextResponse.json({ error: "New password must be between 12 and 1024 characters" }, { status: 400 });
  if (currentPassword === newPassword) return NextResponse.json({ error: "New password must be different" }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const account = await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "PASSWORD_CHANGED", resource: "User", resourceId: user.id } });
    return account;
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(updated.id, updated.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
