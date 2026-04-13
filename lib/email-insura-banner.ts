import { escapeHtml } from "@/lib/email-html";

const INSURA_TARGET_URL =
  "https://www.insura.hu/?utm_source=dpcar&utm_medium=banner&utm_campaign=lakaskampany2024";

function sanitizeHttps(url: string | null | undefined): string {
  const t = (url ?? "").trim();
  return t.startsWith("https://") ? t : "";
}

function escapeAttr(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/**
 * Közös Insura banner blokk az automatikus e-mailekhez.
 * A képet publikus URL-ről töltjük be (env), mert e-mail kliensben lokális path nem működik.
 */
export function buildInsuraBannerHtml(): string {
  const bannerImageUrl = sanitizeHttps(process.env.INSURA_EMAIL_BANNER_IMAGE_URL);
  const link = INSURA_TARGET_URL;

  if (!bannerImageUrl) {
    return `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
        <p style="margin:0 0 8px 0;color:#0f172a;font-size:14px;font-weight:700;">
          ${escapeHtml("Kötöttél már utasbiztosítást?")}
        </p>
        <a href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer" style="color:#1d4ed8;text-decoration:underline;font-size:13px;font-weight:600;">
          Insura utasbiztosítás
        </a>
      </div>
    `;
  }

  return `
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;">
      <p style="margin:0 0 8px 0;color:#0f172a;font-size:14px;font-weight:700;">
        ${escapeHtml("Kötöttél már utasbiztosítást?")}
      </p>
      <a href="${escapeAttr(link)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
        <img src="${escapeAttr(bannerImageUrl)}" alt="Insura utasbiztosítás" style="display:block;max-width:100%;height:auto;border:0;border-radius:8px;" />
      </a>
    </div>
  `;
}

export function getInsuraTargetUrl(): string {
  return INSURA_TARGET_URL;
}
