import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Hiba";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
