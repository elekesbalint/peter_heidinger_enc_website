import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './ui';
import { Colors, Gradients, Fonts, Spacing, Radius } from '../theme';
import type { BiometricType } from '../hooks/useBiometricAuth';

interface Props {
  biometricType: BiometricType;
  onAuthenticate: () => Promise<boolean>;
  onFallback: () => void;
}

export function BiometricLockScreen({ biometricType, onAuthenticate, onFallback }: Props) {
  const insets = useSafeAreaInsets();
  const iconScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    // Auto-trigger biometric prompt on mount
    setTimeout(() => void handleAuthenticate(), 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseIcon = useCallback(() => {
    Animated.sequence([
      Animated.timing(iconScale, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.timing(iconScale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [iconScale]);

  const handleAuthenticate = useCallback(async () => {
    pulseIcon();
    await onAuthenticate();
  }, [onAuthenticate, pulseIcon]);

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    biometricType === 'face' ? 'scan' : 'finger-print';

  const label = biometricType === 'face' ? 'Face ID' : 'Touch ID / ujjlenyomat';

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={Gradients.bg} style={StyleSheet.absoluteFill} />

      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        {/* App logo area */}
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={Gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoCircle}
          >
            <Text style={styles.logoText}>ENC</Text>
          </LinearGradient>
          <Text variant="title" style={styles.appName}>ENC Vásárlás</Text>
          <Text style={styles.subtitle}>Az app zárolva van</Text>
        </View>

        {/* Biometric button */}
        <TouchableOpacity onPress={() => void handleAuthenticate()} activeOpacity={0.75} style={styles.biometricBtn}>
          <Animated.View style={[styles.biometricIconWrap, { transform: [{ scale: iconScale }] }]}>
            <LinearGradient
              colors={Gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.biometricGradient}
            >
              <Ionicons name={iconName} size={44} color={Colors.white} />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.biometricLabel}>Azonosítás {label} segítségével</Text>
        </TouchableOpacity>

        {/* Fallback */}
        <TouchableOpacity onPress={onFallback} style={styles.fallbackBtn} activeOpacity={0.7}>
          <Text style={styles.fallbackText}>Belépés e-mail fiókkal</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  logoWrap: {
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoText: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.extrabold,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  appName: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.base,
  },
  biometricBtn: {
    alignItems: 'center',
    gap: 16,
  },
  biometricIconWrap: {
    borderRadius: 36,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  biometricGradient: {
    width: 96,
    height: 96,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLabel: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    textAlign: 'center',
  },
  fallbackBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  fallbackText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.medium,
  },
});
