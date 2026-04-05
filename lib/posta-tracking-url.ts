/**
 * Magyar Posta ügyféloldali nyomkövetés URL.
 * A POSTA_TRACKING_BASE_URL opcionális (pl. ha a Posta megváltoztatja az oldalt).
 * Alap: posta.hu nyomkövetés + codes query (ha nem működik, állíts más base URL-t).
 */
export function buildPostaTrackingPageUrl(trackingNumber: string): string {
  const t = trackingNumber.trim();
  const root = (process.env.POSTA_TRACKING_BASE_URL?.trim() || "https://www.posta.hu/nyomkovetes").replace(
    /\/$/,
    "",
  );
  if (!t) return root;
  const joiner = root.includes("?") ? "&" : "?";
  return `${root}${joiner}lng=hu&codes=${encodeURIComponent(t)}`;
}
