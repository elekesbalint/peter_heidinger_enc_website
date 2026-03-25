import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProfileRow = {
  name: string | null;
  phone: string | null;
  billing_address: string | null;
  shipping_address: string | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export async function isProfileComplete(authUserId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("name, phone, billing_address, shipping_address")
    .eq("auth_user_id", authUserId)
    .maybeSingle<ProfileRow>();

  if (error || !data) return false;

  return (
    hasText(data.name) &&
    hasText(data.phone) &&
    hasText(data.billing_address) &&
    hasText(data.shipping_address)
  );
}

