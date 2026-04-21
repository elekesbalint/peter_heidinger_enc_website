import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const LOCK_WINDOW_MINUTES = 15;
const MAX_FAILS_BEFORE_LOCK = 5;

function cutoffIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export async function verifyTurnstileToken(params: {
  token: string;
  ip: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "Hiányzó TURNSTILE_SECRET_KEY beállítás." };
    }
    return { ok: true };
  }

  const token = params.token.trim();
  if (!token) {
    return { ok: false, error: "Captcha ellenőrzés szükséges." };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (params.ip && params.ip !== "unknown") form.set("remoteip", params.ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!res.ok || !json?.success) {
    return { ok: false, error: "Captcha ellenőrzés sikertelen." };
  }
  return { ok: true };
}

export async function isAdminLoginLocked(params: {
  email: string;
  ip: string;
}): Promise<{ locked: boolean; emailFails: number; ipFails: number }> {
  const supabase = createSupabaseAdminClient();
  const since = cutoffIso(LOCK_WINDOW_MINUTES);

  const [{ count: emailFails }, { count: ipFails }] = await Promise.all([
    supabase
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .eq("email", params.email)
      .gte("created_at", since),
    supabase
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .eq("ip", params.ip)
      .gte("created_at", since),
  ]);

  const emailCount = Number(emailFails ?? 0);
  const ipCount = Number(ipFails ?? 0);
  return {
    locked: emailCount >= MAX_FAILS_BEFORE_LOCK || ipCount >= MAX_FAILS_BEFORE_LOCK,
    emailFails: emailCount,
    ipFails: ipCount,
  };
}

export async function logAdminLoginAttempt(params: {
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  reason: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("admin_login_attempts")
    .insert({
      email: params.email,
      ip: params.ip,
      user_agent: params.userAgent,
      success: params.success,
      reason: params.reason,
      alert_sent: false,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[admin-login] attempt log insert failed:", error.message);
    return;
  }
  if (params.success) return;

  const since = cutoffIso(LOCK_WINDOW_MINUTES);
  const { count } = await supabase
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .eq("email", params.email)
    .eq("ip", params.ip)
    .gte("created_at", since);

  const failCount = Number(count ?? 0);
  if (failCount !== MAX_FAILS_BEFORE_LOCK) return;

  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;

  const subject = "AdriaGo admin riasztás - ismételt sikertelen bejelentkezés";
  const text =
    `5 sikertelen admin login próbálkozás történt 15 percen belül.\n` +
    `Email: ${params.email}\nIP: ${params.ip}\nUser-Agent: ${params.userAgent}\n` +
    `Utolsó ok: ${params.reason}`;

  try {
    for (const to of recipients) {
      await sendAppEmail({ to, subject, text });
    }
    if (data?.id) {
      await supabase.from("admin_login_attempts").update({ alert_sent: true }).eq("id", data.id);
    }
  } catch (e) {
    console.error("[admin-login] alert email failed:", e instanceof Error ? e.message : String(e));
  }
}
