import { randomBytes } from "crypto";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return Response.json({ ok: false, error: "Hiányzó bearer token." }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return Response.json({ ok: false, error: "Érvénytelen token." }, { status: 401 });
    }
    const user = authData.user;
    const inviterEmail = normalizeEmail(user.email ?? "");
    if (!inviterEmail) {
      return Response.json({ ok: false, error: "Hiányzó felhasználói e-mail cím." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const invitedEmail = normalizeEmail(body.email ?? "");
    if (!invitedEmail || !invitedEmail.includes("@")) {
      return Response.json({ ok: false, error: "Érvénytelen e-mail cím." }, { status: 400 });
    }
    if (invitedEmail === inviterEmail) {
      return Response.json({ ok: false, error: "Saját magadnak nem küldhetsz meghívót." }, { status: 400 });
    }

    const inviteToken = randomBytes(18).toString("base64url");
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("referral_invites").insert({
      inviter_auth_user_id: user.id,
      inviter_email: inviterEmail,
      invited_email: invitedEmail,
      token: inviteToken,
      status: "sent",
      created_at: now,
    });
    if (insertError) {
      return Response.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    const inviteLink = `${baseUrl.replace(/\/$/, "")}/register?ref=${encodeURIComponent(inviteToken)}`;
    const settings = await getSettingsMap();
    const referralBonusHuf = Math.max(0, getIntSetting(settings, "referral_device_discount_huf", 25000));
    const bonusSentence =
      referralBonusHuf > 0
        ? ` Első ENC készülékvásárlásodkor legfeljebb ${referralBonusHuf.toLocaleString("hu-HU")} Ft induló egyenleg kerül a készülékhez (útdíj / feltöltés). A készülék teljes árát fizeted.`
        : "";

    try {
      await sendAppEmail({
        to: invitedEmail,
        subject: "AdriaGo — meghívó ENC készülékvásárláshoz",
        text: `Meghívót kaptál az AdriaGo rendszerbe. Regisztrálj ezzel a linkkel:${bonusSentence} Link: ${inviteLink}`,
        html: `
      <div style="background:#f8fafc;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <div style="padding:16px 20px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#fff;">
            <div style="font-size:12px;opacity:.9;letter-spacing:.04em;text-transform:uppercase;">AdriaGo</div>
            <div style="font-size:20px;font-weight:700;margin-top:6px;">Meghívó</div>
          </div>
          <div style="padding:18px 20px;">
            <p style="margin:0 0 12px 0;color:#334155;font-size:14px;line-height:1.5;">
              Meghívót kaptál az AdriaGo rendszerbe. A linkkel regisztrálva jogosulttá válsz az első ENC készülékvásárlásra.${referralBonusHuf > 0 ? ` Első vásárlásodkor legfeljebb <strong>${referralBonusHuf.toLocaleString("hu-HU")} Ft</strong> induló egyenleg kerül a készülékhez (útdíj / feltöltés); a készülék teljes árát fizeted.` : ""}
            </p>
            <a href="${inviteLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px;">
              Regisztráció meghívóval
            </a>
            <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;word-break:break-all;">${inviteLink}</p>
          </div>
        </div>
      </div>`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ismeretlen e-mail hiba";
      await supabase.from("referral_invites").delete().eq("token", inviteToken);
      return Response.json(
        { ok: false, error: `A meghívó e-mail küldése sikertelen: ${message}` },
        { status: 502 },
      );
    }

    return Response.json({ ok: true, inviteLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

