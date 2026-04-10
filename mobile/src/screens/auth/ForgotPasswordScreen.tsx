import React, { useState } from 'react';
import { Animated, View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, Input } from '../../components/ui';
import { Colors, Gradients, Spacing } from '../../theme';
import { resetPassword } from '../../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const anim = useFadeIn(0, 500);

  async function handleReset() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Hiba történt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={Gradients.bg} style={styles.bg}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <View style={styles.container}>
            <Animated.View style={anim}>
              {sent ? (
                <View style={styles.successBox}>
                  <Text style={styles.successIcon}>✉️</Text>
                  <Text variant="h3" style={styles.title}>Email elküldve!</Text>
                  <Text variant="caption" style={styles.subtitle}>
                    Ellenőrizze postaládáját és kövesse a jelszó-visszaállítási linket.
                  </Text>
                  <Button
                    label="Vissza a belépéshez"
                    onPress={() => navigation.navigate('Login')}
                    style={{ marginTop: Spacing.xl }}
                  />
                </View>
              ) : (
                <>
                  <Text variant="h2" style={styles.title}>Elfelejtett jelszó</Text>
                  <Text variant="caption" style={styles.subtitle}>
                    Adja meg email-címét, és küldünk egy visszaállítási linket.
                  </Text>
                  <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="nev@example.com"
                  />
                  <Button
                    label="Link küldése"
                    onPress={handleReset}
                    loading={loading}
                    disabled={!email.trim()}
                    style={styles.btn}
                  />
                  <Button
                    label="← Vissza"
                    onPress={() => navigation.goBack()}
                    variant="ghost"
                  />
                </>
              )}
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
  title: { marginBottom: 6 },
  subtitle: { marginBottom: Spacing.xl },
  btn: { marginBottom: Spacing.sm },
  successBox: { alignItems: 'center' },
  successIcon: { fontSize: 48, marginBottom: Spacing.md },
});
