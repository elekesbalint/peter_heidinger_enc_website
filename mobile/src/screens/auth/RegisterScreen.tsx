import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, Input } from '../../components/ui';
import { Colors, Gradients, Spacing } from '../../theme';
import { signUp } from '../../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
}

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email kötelező.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Érvénytelen email.';
    if (!password) e.password = 'Jelszó kötelező.';
    else if (password.length < 6) e.password = 'Legalább 6 karakter.';
    if (password !== confirmPassword) e.confirmPassword = 'A jelszavak nem egyeznek.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      Alert.alert(
        'Sikeres regisztráció!',
        'Ellenőrizze email fiókját a visszaigazoláshoz.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
      );
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Regisztráció sikertelen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={Gradients.bg} style={styles.bg}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text variant="h2" style={styles.title}>Regisztráció</Text>
              <Text variant="caption" style={styles.subtitle}>
                Hozzon létre AdriaGo fiókot
              </Text>

              <View style={styles.form}>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="nev@example.com"
                  error={errors.email}
                />
                <Input
                  label="Jelszó"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  error={errors.password}
                />
                <Input
                  label="Jelszó megerősítése"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  error={errors.confirmPassword}
                />

                <Button
                  label="Fiók létrehozása"
                  onPress={handleRegister}
                  loading={loading}
                  style={styles.btn}
                />
                <Button
                  label="Már van fiókom — Belépés"
                  onPress={() => navigation.navigate('Login')}
                  variant="ghost"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  title: { marginBottom: 6 },
  subtitle: { marginBottom: Spacing.xl },
  form: { gap: 0 },
  btn: { marginTop: Spacing.md, marginBottom: Spacing.sm },
});
