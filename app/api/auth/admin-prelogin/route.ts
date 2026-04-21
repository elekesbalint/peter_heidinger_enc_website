import { isAdminLoginLocked, verifyTurnstileToken } from "@/lib/admin-login-security";
import { getRequestClientIp, normalizeEmail } from "@/lib/api-security";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    turnstileToken?: string;
  };
  const email = normalizeEmail(body.email ?? "");
  const turnstileToken = String(body.turnstileToken ?? "");
  const ip = await getRequestClientIp();

  if (!email || !email.includes("@")) {
    return Response.json({ ok: false, error: "Érvénytelen e-mail cím." }, { status: 400 });
  }

  const captcha = await verifyTurnstileToken({ token: turnstileToken, ip });
  if (!captcha.ok) {
    return Response.json({ ok: false, error: captcha.error }, { status: 400 });
  }

  const lock = await isAdminLoginLocked({ email, ip });
  if (lock.locked) {
    return Response.json(
      {
        ok: false,
        error:
          "Túl sok sikertelen próbálkozás erről az e-mailről vagy IP-ről. Próbáld újra 15 perc múlva.",
      },
      { status: 429 },
    );
  }

  return Response.json({ ok: true });
}
