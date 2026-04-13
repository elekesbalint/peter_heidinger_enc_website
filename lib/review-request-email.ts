import { buildInsuraBannerHtml } from "@/lib/email-insura-banner";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function addTrackingParams(url: string, rating: number): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=adriago_email&utm_medium=transactional&utm_campaign=review_request&rating=${rating}`;
}

export function buildReviewRequestEmailHtml(params: {
  googleReviewUrl: string;
  deviceIdentifier?: string | null;
}): string {
  const reviewUrl = params.googleReviewUrl.trim();
  const safeBase = reviewUrl.startsWith("https://") ? reviewUrl : "#";
  const device = params.deviceIdentifier?.trim() || "ENC készülék";
  const stars = [1, 2, 3, 4, 5]
    .map((rating) => {
      const href = safeBase === "#" ? "#" : addTrackingParams(safeBase, rating);
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;font-size:34px;line-height:1;display:inline-block;padding:0 3px;color:#f59e0b;">★</a>`;
    })
    .join("");
  const insuraBannerHtml = buildInsuraBannerHtml();

  return `
  <div style="background:#f8fafc;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="padding:16px 20px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#ffffff;">
        <div style="font-size:12px;opacity:0.9;letter-spacing:.04em;text-transform:uppercase;">AdriaGo</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px;">Hogy tetszett az AdriaGo?</div>
      </div>
      <div style="padding:20px;">
        <p style="margin:0 0 10px 0;color:#334155;font-size:14px;line-height:1.6;">
          Köszönjük, hogy minket választottál. Reméljük, elégedett vagy a szolgáltatással.
        </p>
        <p style="margin:0 0 14px 0;color:#334155;font-size:14px;line-height:1.6;">
          Kérünk, értékeld a tapasztalatodat Google-on. Már egy kattintás is sokat segít!
        </p>
        <p style="margin:0 0 10px 0;color:#0f172a;font-size:13px;font-weight:600;">
          Készülék: ${escapeHtml(device)}
        </p>
        <div style="margin:10px 0 12px 0;text-align:center;letter-spacing:1px;">
          ${stars}
        </div>
        <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
          Kattints egy csillagra, és átirányítunk a Google értékeléshez.
        </p>
        ${insuraBannerHtml}
      </div>
      <div style="padding:12px 20px;background:#f8fafc;color:#64748b;font-size:12px;">
        Ez egy automatikus üzenet, kérjük ne válaszolj rá.
      </div>
    </div>
  </div>`;
}
