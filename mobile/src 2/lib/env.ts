function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: requiredEnv("EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  webBaseUrl: requiredEnv("EXPO_PUBLIC_WEB_BASE_URL"),
};

