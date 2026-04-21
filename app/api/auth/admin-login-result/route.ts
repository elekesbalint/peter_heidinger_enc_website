import { logAdminLoginAttempt } from "@/lib/admin-login-security";
import { getRequestClientIp, getRequestUserAgent, normalizeEmail } from "@/lib/api-security";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    success?: boolean;
    reason?: string;
  };
  const email = normalizeEmail(body.email ?? "");
  const success = Boolean(body.success);
  const reason = String(body.reason ?? (success ? "ok" : "unknown_error")).slice(0, 180);
  const ip = await getRequestClientIp();
  const userAgent = await getRequestUserAgent();

  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, error: "Érvénytelen e-mail cím." }, { status: 400 });
  }

  await logAdminLoginAttempt({
    email,
    ip,
    userAgent,
    success,
    reason,
  });

  return Response.json({ ok: true });
}
