import { randomBytes } from "crypto";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { getReferralWalletBonusCapEur } from "@/lib/referral-wallet-bonus";
import { buildEmailHtml } from "@/lib/email-html";
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
    const fxEurToHuf = Math.max(1, getIntSetting(settings, "fx_eur_to_huf", 400));
    const capEur = getReferralWalletBonusCapEur(settings, fxEurToHuf);
    const capEurLabel = capEur.toLocaleString("hu-HU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const bonusSentence =
      capEur > 0
        ? ` Első ENC készülékvásárlásodkor legfeljebb ${capEurLabel} EUR induló egyenleg kerül a készülékhez (útdíj / feltöltés). A készülék teljes árát fizeted.`
        : "";

    try {
      const intro =
        `Meghívót kaptál az AdriaGo rendszerbe. A linkkel regisztrálva jogosulttá válsz az első ENC készülékvásárlásra.` +
        (capEur > 0
          ? ` Első vásárlásodkor legfeljebb ${capEurLabel} EUR induló egyenleg kerül a készülékhez (útdíj / feltöltés); a készülék teljes árát fizeted.`
          : "");
      await sendAppEmail({
        to: invitedEmail,
        subject: "AdriaGo — meghívó ENC készülékvásárláshoz",
        text: `Meghívót kaptál az AdriaGo rendszerbe. Regisztrálj ezzel a linkkel:${bonusSentence} Link: ${inviteLink}`,
        html: buildEmailHtml({
          title: "Meghívó",
          intro,
          rows: [
            { label: "Regisztráció", linkHref: inviteLink, linkText: "Regisztráció meghívóval" },
            { label: "Meghívó link", value: inviteLink },
          ],
        }),
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

