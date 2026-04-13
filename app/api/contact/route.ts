import { buildEmailHtml } from "@/lib/email-html";
import { sendAppEmail } from "@/lib/notify-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function contactNotifyRecipient(): string | null {
  const explicit = process.env.CONTACT_NOTIFY_EMAIL?.trim();
  if (explicit) return explicit;
  return (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      message?: string;
    };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const message = (body.message ?? "").trim();
    if (name.length < 2 || email.length < 5 || message.length < 10) {
      return Response.json(
        { ok: false, error: "Toltsd ki a nevet, e-mailt es legalabb 10 karakteres uzenetet." },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      message,
    });
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const notifyTo = contactNotifyRecipient();
    if (notifyTo) {
      const preview = message.length > 2000 ? `${message.slice(0, 2000)}…` : message;
      void sendAppEmail({
        to: notifyTo,
        subject: `AdriaGo — kapcsolatfelvetel: ${name}`,
        text: [
          "Uj kapcsolatfelveteli uzenet a weboldalrol.",
          `Nev: ${name}`,
          `E-mail (valasz ide): ${email}`,
          "",
          preview,
        ].join("\n"),
        html: buildEmailHtml({
          title: "Kapcsolatfelvetel",
          intro: "Uj uzenet erkezett a kapcsolat oldalrol.",
          rows: [
            { label: "Nev", value: name },
            { label: "E-mail", value: email },
            { label: "Uzenet", value: preview },
          ],
        }),
      }).catch((err) => {
        console.error("[contact] Ertesito e-mail kuldes sikertelen:", err);
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hiba";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
