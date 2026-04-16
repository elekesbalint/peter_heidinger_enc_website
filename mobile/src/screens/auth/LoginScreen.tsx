import React, { useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { signIn, signInWithGoogle } from '../../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
}

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const headerAnim = useFadeIn(0, 500);
  const formAnim = useFadeIn(150, 500);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email kötelező.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Érvénytelen email.';
    if (!password) e.password = 'Jelszó kötelező.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Belépés sikertelen.';
      Alert.alert('Hiba', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google bejelentkezés sikertelen.';
      Alert.alert('Hiba', msg);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <LinearGradient colors={Gradients.bg} style={styles.bg}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.container}>
            <Animated.View style={[styles.header, headerAnim]}>
              <View style={styles.logoWrap}>
                <LinearGradient
                  colors={Gradients.accent}
                  style={styles.logoGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.logoText}>A</Text>
                </LinearGradient>
              </View>
              <Text variant="h2" style={styles.title}>Üdvözöljük!</Text>
              <Text variant="caption" style={styles.subtitle}>
                Jelentkezzen be AdriaGo fiókjába
              </Text>
            </Animated.View>

            <Animated.View style={[styles.form, formAnim]}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                placeholder="nev@example.com"
                error={errors.email}
              />
              <Input
                label="Jelszó"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                placeholder="••••••••"
                error={errors.password}
                rightIcon={
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textTertiary}
                  />
                }
                onRightIconPress={() => setShowPassword((v) => !v)}
              />

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotWrap}
              >
                <Text style={styles.forgot}>Elfelejtett jelszó?</Text>
              </TouchableOpacity>

              <Button label="Belépés" onPress={handleLogin} loading={loading} disabled={googleLoading} style={styles.btn} />

              <TouchableOpacity
                onPress={() => void handleGoogleLogin()}
                disabled={loading || googleLoading}
                style={[styles.googleBtn, (loading || googleLoading) && styles.googleBtnDisabled]}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <View style={styles.googleSpinner} />
                ) : (
                  <Svg viewBox="0 0 24 24" width={20} height={20}>
                    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </Svg>
                )}
                <Text style={styles.googleBtnText}>
                  {googleLoading ? 'Google bejelentkezés…' : 'Belépés Google-fiókkal'}
                </Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.line} />
                <Text variant="caption" style={styles.orText}>vagy</Text>
                <View style={styles.line} />
              </View>

              <Button
                label="Regisztráció"
                onPress={() => navigation.navigate('Register')}
                variant="secondary"
                disabled={loading || googleLoading}
              />
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logoWrap: { marginBottom: Spacing.md },
  logoGrad: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: Fonts.weights.extrabold,
    color: Colors.white,
  },
  title: { textAlign: 'center', marginBottom: 6 },
  subtitle: { textAlign: 'center' },
  form: { gap: 0 },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: Spacing.md, marginTop: -4 },
  forgot: { color: Colors.accent, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.medium },
  btn: { marginBottom: Spacing.md },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: { marginHorizontal: Spacing.sm },
  showHide: { color: Colors.accent, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.medium },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  googleBtnDisabled: { opacity: 0.55 },
  googleBtnText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.semibold,
    color: Colors.textPrimary,
  },
  googleSpinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    borderTopColor: Colors.textSecondary,
  },
});
