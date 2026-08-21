import { NextRequest, NextResponse } from "next/server";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { consumePasswordWork } from "@/lib/password";
import { createHash } from "crypto";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

function throttleKey(req: NextRequest, email: string) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${email}\0${address}`).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = body?.password;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (typeof password !== "string" || password.length > 1024 || !email || email.length > 254) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const key = throttleKey(req, email);
  const now = new Date();
  const throttle = await prisma.loginThrottle.findUnique({ where: { key } });
  if (throttle?.blockedUntil && throttle.blockedUntil > now) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(Math.ceil((throttle.blockedUntil.getTime() - now.getTime()) / 1000)) } });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  const userCount = await prisma.user.count();
  const ownerEmail = (process.env.OWNER_EMAIL ?? "admin@mecg.local").toLowerCase();
  if (
    !user &&
    userCount === 0 &&
    email === ownerEmail &&
    password === process.env.ADMIN_PASSWORD
  ) {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name: "MECG Owner", passwordHash: hashPassword(password) },
      });
      const cycles = await tx.rushCycle.findMany({ select: { id: true } });
      if (cycles.length) {
        await tx.membership.createMany({
          data: cycles.map((cycle) => ({ userId: created.id, cycleId: cycle.id, role: "OWNER" })),
        });
      }
      return created;
    });
  }

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    if (!user) consumePasswordWork(password);
    const withinWindow = throttle && now.getTime() - throttle.windowStartedAt.getTime() < LOGIN_WINDOW_MS;
    const failures = withinWindow ? throttle.failures + 1 : 1;
    await prisma.loginThrottle.upsert({
      where: { key },
      create: { key, failures, windowStartedAt: now, blockedUntil: failures >= MAX_LOGIN_FAILURES ? new Date(now.getTime() + LOGIN_WINDOW_MS) : null },
      update: { failures, windowStartedAt: withinWindow ? throttle!.windowStartedAt : now, blockedUntil: failures >= MAX_LOGIN_FAILURES ? new Date(now.getTime() + LOGIN_WINDOW_MS) : null },
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await prisma.loginThrottle.deleteMany({ where: { key } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(user.id, user.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
