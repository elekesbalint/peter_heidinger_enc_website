import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ProfileRow = {
  name: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

/** Egy kérésen belül egy DB-lekérés a profilra (layout név + oldal teljesség ellenőrzés). */
export const getProfileByAuthUserId = cache(async (authUserId: string): Promise<ProfileRow | null> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("name, phone, billing_address, shipping_address")
    .eq("auth_user_id", authUserId)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;
  return data;
});

export async function isProfileComplete(authUserId: string): Promise<boolean> {
  const data = await getProfileByAuthUserId(authUserId);
  if (!data) return false;

  return (
    hasText(data.name) &&
    hasText(data.phone) &&
    hasText(data.billing_address) &&
    hasText(data.shipping_address)
  );
}

