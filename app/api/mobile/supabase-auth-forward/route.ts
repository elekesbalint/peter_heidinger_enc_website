/**
 * iOS Simulator 18.4 + RN fetch gyakran elhasal a *.supabase.co auth végpontok felé
 * (Apple szimulátor hiba — lásd supabase/supabase#35224).
 * A kliens csak a saját API-t hívja; a szerver továbbítja a GoTrue kéréseket.
 */

function getAllowedSupabaseOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.endsWith("/") ? raw.slice(0, -1) : raw);
    return u.origin;
  } catch {
    return null;
  }
}

function isAllowedAuthUrl(urlString: string, allowedOrigin: string): boolean {
  try {
    const u = new URL(urlString);
    return u.origin === allowedOrigin && u.pathname.startsWith("/auth/v1");
  } catch {
    return false;
  }
}

type ForwardBody = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body: string | null;
};

export async function POST(request: Request) {
  const allowedOrigin = getAllowedSupabaseOrigin();
  if (!allowedOrigin) {
    return Response.json({ ok: false, error: "Server missing NEXT_PUBLIC_SUPABASE_URL." }, { status: 500 });
  }

  let payload: ForwardBody;
  try {
    payload = (await request.json()) as ForwardBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const method = (typeof payload.method === "string" ? payload.method : "GET").toUpperCase();

  if (!url || !isAllowedAuthUrl(url, allowedOrigin)) {
    return Response.json({ ok: false, error: "URL not allowed." }, { status: 403 });
  }

  const hopHeaders = new Headers();
  if (payload.headers && typeof payload.headers === "object") {
    for (const [k, v] of Object.entries(payload.headers)) {
      if (typeof v !== "string") continue;
      const key = k.toLowerCase();
      if (key === "host" || key === "connection" || key === "content-length") continue;
      hopHeaders.set(k, v);
    }
  }

  const hasBody = payload.body != null && payload.body !== "" && method !== "GET" && method !== "HEAD";

  const upstream = await fetch(url, {
    method,
    headers: hopHeaders,
    body: hasBody ? payload.body : undefined,
  });

  const text = await upstream.text();
  const outHeaders: Record<string, string> = {};
  upstream.headers.forEach((value, key) => {
    outHeaders[key] = value;
  });

  return Response.json({
    ok: true,
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
    body: text,
  });
}
