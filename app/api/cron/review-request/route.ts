import { sendAppEmail } from "@/lib/notify-email";
import { buildReviewRequestEmailHtml } from "@/lib/review-request-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function getGoogleReviewUrl(): string {
  const url = process.env.GOOGLE_BUSINESS_REVIEW_URL?.trim() ?? "";
  return url;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";

  if (!cronSecret || bearer !== cronSecret) {
    return unauthorized();
  }

  const reviewUrl = getGoogleReviewUrl();
  if (!reviewUrl.startsWith("https://")) {
    return Response.json(
      {
        ok: false,
        error: "GOOGLE_BUSINESS_REVIEW_URL nincs beállítva, vagy nem https URL.",
      },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const cutoffIso = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await supabase
    .from("enc_device_orders")
    .select("id, user_email, device_identifier, shipped_at, cancelled_at, archived_at, review_request_sent_at")
    .not("shipped_at", "is", null)
    .is("cancelled_at", null)
    .is("review_request_sent_at", null)
    .lte("shipped_at", cutoffIso)
    .order("shipped_at", { ascending: true })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = {
    ok: true,
    scanned: orders?.length ?? 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    failedItems: [] as Array<{ id: string; reason: string }>,
  };

  for (const order of orders ?? []) {
    const email = (order.user_email ?? "").trim();
    if (!email) {
      result.skipped += 1;
      result.failedItems.push({ id: order.id, reason: "Hiányzó user_email." });
      continue;
    }

    try {
      const html = buildReviewRequestEmailHtml({
        googleReviewUrl: reviewUrl,
        deviceIdentifier: order.device_identifier,
      });

      await sendAppEmail({
        to: email,
        subject: "AdriaGo — Kérjük, értékeld a szolgáltatást ⭐",
        text:
          "Köszönjük, hogy minket választottál. Kérjük értékeld szolgáltatásunkat a Google-on: " +
          reviewUrl,
        html,
      });

      const { error: markErr } = await supabase
        .from("enc_device_orders")
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq("id", order.id);
      if (markErr) {
        result.failed += 1;
        result.failedItems.push({ id: order.id, reason: `Jelölés sikertelen: ${markErr.message}` });
        continue;
      }
      result.sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ismeretlen hiba";
      result.failed += 1;
      result.failedItems.push({ id: order.id, reason: msg });
    }
  }

  return Response.json(result);
}
