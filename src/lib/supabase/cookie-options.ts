// Shared by every createServerClient call site (server.ts, proxy.ts) so the
// auth cookie (access + refresh token) can never be read by JS. The resume
// upload flow that used to require a JS-readable cookie now goes through a
// server-issued signed upload URL instead (see api/apply/resume/start),
// which is what makes httpOnly safe to turn on here.
export const SESSION_COOKIE_OPTIONS = { httpOnly: true };
