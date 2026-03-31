import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ProfileRow = {
  user_type: string | null;
  name: string | null;
  phone: string | null;
  company_name: string | null;
  tax_number: string | null;
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
    .select("user_type, name, phone, company_name, tax_number, billing_address, shipping_address")
    .eq("auth_user_id", authUserId)
    .maybeSingle<ProfileRow>();

  if (error || !data) return null;
  return data;
});

export async function isProfileComplete(authUserId: string): Promise<boolean> {
  const data = await getProfileByAuthUserId(authUserId);
  if (!data) return false;

  const companyRequired = (data.user_type ?? "private") === "company";
  return (
    hasText(data.name) &&
    hasText(data.phone) &&
    (!companyRequired || (hasText(data.company_name) && hasText(data.tax_number))) &&
    hasText(data.billing_address) &&
    hasText(data.shipping_address)
  );
}

