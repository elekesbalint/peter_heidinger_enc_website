/**
 * Egységes AdriaGo tranzakciós e-mail keret (Resend HTML).
 * A webhook és az admin ENC műveletek is ezt használják.
 */

export type EmailHtmlRow =
  | { label: string; value: string }
  | { label: string; linkHref: string; linkText: string };

export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttr(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** Csak https URL-t engedünk be href-be (saját generált linkek). */
function sanitizeHttpsHref(href: string): string {
  const t = href.trim();
  if (!t.startsWith("https://")) return "#";
  return t;
}

function rowToHtml(r: EmailHtmlRow): string {
  const labelCell = `<td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">${escapeHtml(r.label)}</td>`;
  if ("linkHref" in r && r.linkHref && r.linkText) {
    const href = sanitizeHttpsHref(r.linkHref);
    const valueCell = `<td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">
      <a href="${escapeHtmlAttr(href)}" style="color:#1d4ed8;text-decoration:underline;font-weight:700;" target="_blank" rel="noopener noreferrer">${escapeHtml(r.linkText)}</a>
    </td>`;
    return `<tr>${labelCell}${valueCell}</tr>`;
  }
  const v = "value" in r ? r.value : "";
  return `<tr>${labelCell}<td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(v)}</td></tr>`;
}

export function buildEmailHtml(params: { title: string; intro: string; rows: EmailHtmlRow[] }): string {
  const rowsHtml = params.rows.map((row) => rowToHtml(row)).join("");

  return `
  <div style="background:#f8fafc;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="padding:16px 20px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#ffffff;">
        <div style="font-size:12px;opacity:0.9;letter-spacing:.04em;text-transform:uppercase;">AdriaGo</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px;">${escapeHtml(params.title)}</div>
      </div>
      <div style="padding:18px 20px;">
        <p style="margin:0 0 12px 0;color:#334155;font-size:14px;line-height:1.5;">${escapeHtml(params.intro)}</p>
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
          ${rowsHtml}
        </table>
      </div>
      <div style="padding:12px 20px;background:#f8fafc;color:#64748b;font-size:12px;">
        Ez egy automatikus üzenet, kérjük ne válaszolj rá.
      </div>
    </div>
  </div>`;
}
