/**
 * Opcionalis email (Resend). Ha nincs RESEND_API_KEY, no-op, false-t ad vissza.
 * @returns true ha a Resend elfogadta a kerest, false ha kulcs nelkul kihagyva
 */
export async function sendAppEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "AdriaGo <onboarding@resend.dev>";
  if (!key) {
    console.error(
      `[email] RESEND_API_KEY hianyzik — e-mail nem kuldheto. Cimzett: ${params.to}, targy: ${params.subject}`,
    );
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend hiba (${res.status}): ${body || "ismeretlen hiba"}`);
  }
  return true;
}
