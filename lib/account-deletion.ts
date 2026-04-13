import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const AVATAR_BUCKET = process.env.SUPABASE_STORAGE_BUCKET_AVATARS ?? "avatars";

export async function deleteUserRelatedData(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
  userEmail: string,
) {
  const { data: ownedDevices, error: ownedDevicesError } = await supabase
    .from("devices")
    .select("identifier")
    .eq("auth_user_id", authUserId);
  if (ownedDevicesError) throw new Error(`devices lookup: ${ownedDevicesError.message}`);

  const ownedDeviceIdentifiers = (ownedDevices ?? []).map((d) => d.identifier).filter(Boolean);

  if (ownedDeviceIdentifiers.length > 0) {
    const { error: routeRecordsError } = await supabase
      .from("route_records")
      .delete()
      .in("device_number_raw", ownedDeviceIdentifiers);
    if (routeRecordsError) throw new Error(`route_records delete: ${routeRecordsError.message}`);

    const { error: deviceWalletsError } = await supabase
      .from("device_wallets")
      .delete()
      .in("device_identifier", ownedDeviceIdentifiers);
    if (deviceWalletsError) throw new Error(`device_wallets delete: ${deviceWalletsError.message}`);

    const { error: walletTransactionsByDeviceError } = await supabase
      .from("wallet_transactions")
      .delete()
      .in("device_identifier", ownedDeviceIdentifiers);
    if (walletTransactionsByDeviceError) {
      throw new Error(`wallet_transactions by device delete: ${walletTransactionsByDeviceError.message}`);
    }
  }

  const { error: walletTransactionsByUserError } = await supabase
    .from("wallet_transactions")
    .delete()
    .eq("user_email", userEmail);
  if (walletTransactionsByUserError) {
    throw new Error(`wallet_transactions by user delete: ${walletTransactionsByUserError.message}`);
  }

  const { error: stripeTopupsByUserIdError } = await supabase
    .from("stripe_topups")
    .delete()
    .eq("user_id", authUserId);
  if (stripeTopupsByUserIdError) {
    throw new Error(`stripe_topups by user_id delete: ${stripeTopupsByUserIdError.message}`);
  }

  const { error: stripeTopupsByEmailError } = await supabase
    .from("stripe_topups")
    .delete()
    .eq("user_email", userEmail);
  if (stripeTopupsByEmailError) {
    throw new Error(`stripe_topups by user_email delete: ${stripeTopupsByEmailError.message}`);
  }

  const { error: waitlistAuthError } = await supabase
    .from("device_waitlist")
    .delete()
    .eq("auth_user_id", authUserId);
  if (waitlistAuthError) throw new Error(`device_waitlist by auth delete: ${waitlistAuthError.message}`);

  const { error: waitlistEmailError } = await supabase
    .from("device_waitlist")
    .delete()
    .eq("user_email", userEmail);
  if (waitlistEmailError) throw new Error(`device_waitlist by email delete: ${waitlistEmailError.message}`);

  const { error: reservationsAuthError } = await supabase
    .from("device_payment_reservations")
    .delete()
    .eq("auth_user_id", authUserId);
  if (reservationsAuthError) {
    throw new Error(`device_payment_reservations by auth delete: ${reservationsAuthError.message}`);
  }

  const { error: reservationsEmailError } = await supabase
    .from("device_payment_reservations")
    .delete()
    .eq("user_email", userEmail);
  if (reservationsEmailError) {
    throw new Error(`device_payment_reservations by email delete: ${reservationsEmailError.message}`);
  }

  const { error: ordersAuthError } = await supabase
    .from("enc_device_orders")
    .delete()
    .eq("auth_user_id", authUserId);
  if (ordersAuthError) throw new Error(`enc_device_orders by auth delete: ${ordersAuthError.message}`);

  const { error: ordersEmailError } = await supabase
    .from("enc_device_orders")
    .delete()
    .eq("user_email", userEmail);
  if (ordersEmailError) throw new Error(`enc_device_orders by email delete: ${ordersEmailError.message}`);

  const { error: contractsAuthError } = await supabase
    .from("contract_acceptances")
    .delete()
    .eq("auth_user_id", authUserId);
  if (contractsAuthError) throw new Error(`contract_acceptances by auth delete: ${contractsAuthError.message}`);

  const { error: contractsEmailError } = await supabase
    .from("contract_acceptances")
    .delete()
    .eq("user_email", userEmail);
  if (contractsEmailError) throw new Error(`contract_acceptances by email delete: ${contractsEmailError.message}`);

  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("auth_user_id", authUserId);
  if (profileError) throw new Error(`profiles delete: ${profileError.message}`);

  const { error: devicesResetError } = await supabase
    .from("devices")
    .update({
      auth_user_id: null,
      status: "available",
      sold_at: null,
      license_plate: null,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUserId);
  if (devicesResetError) throw new Error(`devices reset: ${devicesResetError.message}`);

  await supabase.storage.from(AVATAR_BUCKET).remove([
    `${authUserId}/avatar.jpg`,
    `${authUserId}/avatar.jpeg`,
    `${authUserId}/avatar.png`,
    `${authUserId}/avatar.webp`,
  ]);

  const { error: referralInviterAuthError } = await supabase
    .from("referral_invites")
    .delete()
    .eq("inviter_auth_user_id", authUserId);
  if (referralInviterAuthError) {
    throw new Error(`referral_invites by inviter auth delete: ${referralInviterAuthError.message}`);
  }

  const { error: referralInvitedAuthError } = await supabase
    .from("referral_invites")
    .delete()
    .eq("invited_auth_user_id", authUserId);
  if (referralInvitedAuthError) {
    throw new Error(`referral_invites by invited auth delete: ${referralInvitedAuthError.message}`);
  }

  const { error: referralInviterEmailError } = await supabase
    .from("referral_invites")
    .delete()
    .eq("inviter_email", userEmail);
  if (referralInviterEmailError) {
    throw new Error(`referral_invites by inviter email delete: ${referralInviterEmailError.message}`);
  }

  const { error: referralInvitedEmailError } = await supabase
    .from("referral_invites")
    .delete()
    .eq("invited_email", userEmail);
  if (referralInvitedEmailError) {
    throw new Error(`referral_invites by invited email delete: ${referralInvitedEmailError.message}`);
  }

  const { error: adminAssignmentsAuthError } = await supabase
    .from("admin_device_assignments")
    .delete()
    .eq("target_auth_user_id", authUserId);
  if (adminAssignmentsAuthError) {
    throw new Error(`admin_device_assignments by auth delete: ${adminAssignmentsAuthError.message}`);
  }

  const { error: adminAssignmentsEmailError } = await supabase
    .from("admin_device_assignments")
    .delete()
    .eq("target_user_email", userEmail);
  if (adminAssignmentsEmailError) {
    throw new Error(`admin_device_assignments by email delete: ${adminAssignmentsEmailError.message}`);
  }
}
