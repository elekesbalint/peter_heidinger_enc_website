import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Egy HTTP kérésen belül deduplikálva – layout + oldal ne hívja kétszer a Supabase auth-ot. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  // Ha nincs beallitva lista, senki nem admin (ne legyen "mindenki admin" dev mod).
  if (configured.length === 0) return false;

  return configured.includes(email.toLowerCase());
}

type AAL = "aal1" | "aal2";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function getCurrentSessionAal(): Promise<AAL | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return null;
  const payload = decodeJwtPayload(accessToken);
  const aal = payload?.aal;
  return aal === "aal1" || aal === "aal2" ? aal : null;
}
