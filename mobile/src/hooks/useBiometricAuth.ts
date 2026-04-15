import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export type BiometricType = 'fingerprint' | 'face' | 'none';

export interface UseBiometricAuthReturn {
  /** Támogatja-e a készülék a biometrikus azonosítást */
  isSupported: boolean;
  /** Be van-e kapcsolva a biometrikus belépés */
  isEnabled: boolean;
  /** Face ID vagy ujjlenyomat */
  biometricType: BiometricType;
  /** Bekapcsolás / kikapcsolás */
  setEnabled: (enabled: boolean) => Promise<void>;
  /** Biometrikus prompt megjelenítése – true ha sikeres */
  authenticate: () => Promise<boolean>;
  /** Betöltés alatt */
  loading: boolean;
}

export function useBiometricAuth(): UseBiometricAuthReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supported = hasHardware && isEnrolled;
        setIsSupported(supported);

        if (supported) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('face');
          } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
            setBiometricType('fingerprint');
          }
        }

        const stored = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        setIsEnabled(supported && stored === '1');
      } catch {
        setIsEnabled(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? '1' : '0');
    setIsEnabled(enabled);
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Azonosítás az ENC apphoz',
        cancelLabel: 'Mégsem',
        fallbackLabel: 'Jelszó használata',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  return { isSupported, isEnabled, biometricType, setEnabled, authenticate, loading };
}
