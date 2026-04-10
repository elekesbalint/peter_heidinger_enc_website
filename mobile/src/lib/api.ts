import { supabase } from './supabase';
import Constants from 'expo-constants';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'https://peter-heidinger-enc-website.vercel.app';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** fetch, ami hálózati hibát egységes üzenetre cserél (kevesebb zavaró LogBox) */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new Error('Nem sikerült kapcsolódni a szerverhez. Ellenőrizze a hálózatot és az API címet (.env).');
  }
}

export async function fetchTopupConfig() {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/topup/config', { headers });
  if (!res.ok) throw new Error('Nem sikerült betölteni a feltöltési konfigurációt.');
  return res.json();
}

export async function startTopupCheckout(body: {
  deviceIdentifier: string;
  amountEur: number;
  selectedPackageEur?: number;
  travelDestination?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/stripe/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'Feltöltés indítása sikertelen.');
  return data as { ok: true; url: string };
}

export async function startDeviceOrderCheckout(body: {
  deviceIdentifier?: string;
  category: string;
  licensePlate: string;
  referralInviteId?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/mobile/stripe/checkout-device', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'Rendelés indítása sikertelen.');
  return data as { ok: true; url: string; waitlist?: boolean };
}

export async function getProfile() {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/me/profile', { headers });
  if (!res.ok) throw new Error('Profil betöltése sikertelen.');
  return res.json();
}

export async function patchProfile(profile: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/me/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Profil mentése sikertelen.');
  return res.json();
}

export async function sendContactMessage(body: {
  name: string;
  email: string;
  message: string;
}) {
  const res = await apiFetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Üzenet küldése sikertelen.');
  return res.json();
}

export async function getSettings(keys?: string[]): Promise<Record<string, string>> {
  try {
    const params = keys ? `?keys=${keys.join(',')}` : '';
    const res = await apiFetch(`/api/settings/public${params}`);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function attachReferral(code: string) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/referrals/attach', {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function sendReferralInvite(email: string) {
  const headers = await getAuthHeaders();
  const res = await apiFetch('/api/referrals/invite', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
  return res.json();
}
