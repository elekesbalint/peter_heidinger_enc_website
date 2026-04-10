import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, Input } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts } from '../../theme';
import { signIn } from '../../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
}

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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

  return (
    <LinearGradient colors={Gradients.bg} style={styles.bg}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.container}>
            <View style={styles.header}>
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
            </View>

            <View style={styles.form}>
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
                  <Text style={styles.showHide}>
                    {showPassword ? 'Elrejt' : 'Mutat'}
                  </Text>
                }
                onRightIconPress={() => setShowPassword((v) => !v)}
              />

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotWrap}
              >
                <Text style={styles.forgot}>Elfelejtett jelszó?</Text>
              </TouchableOpacity>

              <Button label="Belépés" onPress={handleLogin} loading={loading} style={styles.btn} />

              <View style={styles.dividerRow}>
                <View style={styles.line} />
                <Text variant="caption" style={styles.orText}>vagy</Text>
                <View style={styles.line} />
              </View>

              <Button
                label="Regisztráció"
                onPress={() => navigation.navigate('Register')}
                variant="secondary"
              />
            </View>
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
});
