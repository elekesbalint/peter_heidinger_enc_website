import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const supabaseUrl =
  extra.supabaseUrl?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  '';
const supabaseAnonKey =
  extra.supabaseAnonKey?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function assertSupabaseConfigured(): void {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase nincs beállítva: EXPO_PUBLIC_SUPABASE_URL és EXPO_PUBLIC_SUPABASE_ANON_KEY kell a .env-ben, majd indítsd újra a Metro-t (expo start -c).',
    );
  }
}

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  tax_number: string | null;
  company_name: string | null;
  is_company: boolean | null;
};

export type DeviceWallet = {
  device_identifier: string;
  balance_huf: number;
  updated_at: string;
};

export type EncDeviceOrder = {
  id: string;
  device_identifier: string | null;
  status: string;
  paid_at: string | null;
  amount_huf: number | null;
  license_plate: string | null;
  category: string | null;
  created_at: string;
};

export type StripeTopup = {
  id: string;
  device_identifier: string | null;
  amount_huf: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  payload?: Record<string, unknown>;
};
