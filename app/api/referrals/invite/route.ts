import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth-server";
import { getIntSetting, getSettingsMap } from "@/lib/app-settings";
import { buildEmailHtml } from "@/lib/email-html";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 });
  }
  const inviterEmail = normalizeEmail(user.email ?? "");
  if (!inviterEmail) {
    return Response.json({ ok: false, error: "Hiányzó user e-mail." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const invitedEmail = normalizeEmail(body.email ?? "");
  if (!invitedEmail || !invitedEmail.includes("@")) {
    return Response.json({ ok: false, error: "Érvénytelen e-mail cím." }, { status: 400 });
  }
  if (invitedEmail === inviterEmail) {
    return Response.json({ ok: false, error: "Saját magadnak nem küldhetsz meghívót." }, { status: 400 });
  }

  const token = randomBytes(18).toString("base64url");
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("referral_invites").insert({
    inviter_auth_user_id: user.id,
    inviter_email: inviterEmail,
    invited_email: invitedEmail,
    token,
    status: "sent",
    created_at: now,
  });

  if (insertError) {
    return Response.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const inviteLink = `${baseUrl.replace(/\/$/, "")}/register?ref=${encodeURIComponent(token)}`;
  const settings = await getSettingsMap();
  const referralBonusHuf = Math.max(0, getIntSetting(settings, "referral_device_discount_huf", 25000));
  const bonusSentence =
    referralBonusHuf > 0
      ? ` Első ENC készülékvásárlásodkor legfeljebb ${referralBonusHuf.toLocaleString("hu-HU")} Ft induló egyenleg kerül a készülékhez (útdíj / feltöltés). A készülék teljes árát fizeted.`
      : "";

  try {
    const intro =
      `Meghívót kaptál az AdriaGo rendszerbe. A linkkel regisztrálva jogosulttá válsz az első ENC készülékvásárlásra.` +
      (referralBonusHuf > 0
        ? ` Első vásárlásodkor legfeljebb ${referralBonusHuf.toLocaleString("hu-HU")} Ft induló egyenleg kerül a készülékhez (útdíj / feltöltés); a készülék teljes árát fizeted.`
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
    const message = err instanceof Error ? err.message : "Ismeretlen email hiba";
    console.error("[referral] Invite email failed:", err);
    await supabase.from("referral_invites").delete().eq("token", token);
    return Response.json({ ok: false, error: `Meghívó email küldés sikertelen: ${message}` }, { status: 502 });
  }

  return Response.json({ ok: true, inviteLink });
}

