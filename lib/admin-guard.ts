import type { User } from "@supabase/supabase-js";
import { getCurrentUser, isAdminEmail } from "@/lib/auth-server";

export type AdminGuardOk = { ok: true; user: User };
export type AdminGuardFail = { ok: false; response: Response };

export async function requireAdmin(): Promise<AdminGuardOk | AdminGuardFail> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "Nincs bejelentkezve." }, { status: 401 }),
    };
  }
  if (!isAdminEmail(user.email)) {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "Nincs admin jogosultsag." }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
