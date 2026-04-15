/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Extra mező: natív buildben is elérhető (expo-constants), ha a Babel env inline elcsúszna.
 * .env betöltés: `npx expo start` / `expo run:ios` automatikusan.
 */
module.exports = () => {
  const appJson = require('./app.json');
  const existingPlugins = appJson.expo.plugins || [];
  return {
    expo: {
      ...appJson.expo,
      plugins: [
        ...existingPlugins.filter((p) => p !== 'expo-secure-store' && (Array.isArray(p) ? p[0] !== 'expo-secure-store' : true)),
        'expo-secure-store',
      ],
      extra: {
        ...(appJson.expo.extra || {}),
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
        supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
      },
    },
  };
};
