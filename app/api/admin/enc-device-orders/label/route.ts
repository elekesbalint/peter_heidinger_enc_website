import { Buffer } from "buffer";
import { requireAdmin } from "@/lib/admin-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function extractLabelBase64(mplPayload: unknown): string | null {
  if (!mplPayload || typeof mplPayload !== "object") return null;
  const root = mplPayload as Record<string, unknown>;

  const labelResponse = root.labelResponse;
  if (Array.isArray(labelResponse) && labelResponse.length > 0) {
    const first = labelResponse[0];
    if (first && typeof first === "object") {
      const label = (first as Record<string, unknown>).label;
      if (typeof label === "string" && label.trim()) return label.trim();
    }
  }

  const createResponse = root.createResponse;
  if (Array.isArray(createResponse) && createResponse.length > 0) {
    const first = createResponse[0];
    if (first && typeof first === "object") {
      const label = (first as Record<string, unknown>).label;
      if (typeof label === "string" && label.trim()) return label.trim();
    }
  }

  return null;
}

export async function GET(request: Request) {
  const g = await requireAdmin();
  if (!g.ok) return g.response;

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "Hianyzo rendeles azonosito." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("enc_device_orders")
    .select("id, tracking_number, mpl_payload")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, error: "Rendeles nem talalhato." }, { status: 404 });
  }

  const labelBase64 = extractLabelBase64(data.mpl_payload);
  if (!labelBase64) {
    return Response.json({ ok: false, error: "Ehhez a rendeleshez nincs MPL cimke PDF eltárolva." }, { status: 404 });
  }

  try {
    const pdfBytes = Buffer.from(labelBase64, "base64");
    const safeTracking = (data.tracking_number ?? "no-tracking").replace(/[^a-zA-Z0-9_-]/g, "");
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mpl-label-${safeTracking}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "Hibas MPL cimke formatum." }, { status: 500 });
  }
}

