import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenWrapper, Text, Button, Input, Card } from '../../components/ui';
import { Colors, Spacing } from '../../theme';
import { sendContactMessage } from '../../lib/api';

export function ContactScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Hiba', 'Töltse ki az összes mezőt.');
      return;
    }
    setLoading(true);
    try {
      await sendContactMessage({ name: name.trim(), email: email.trim(), message: message.trim() });
      setSent(true);
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Küldés sikertelen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScreenWrapper>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Text variant="h2">Kapcsolat</Text>
          <Text variant="caption" style={{ marginTop: 4 }}>
            Kérdése van? Írjon nekünk!
          </Text>
        </Animated.View>

        {sent ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text variant="h3" style={{ marginBottom: 8 }}>Üzenet elküldve!</Text>
            <Text variant="caption" style={{ textAlign: 'center' }}>
              Hamarosan felvesszük Önnel a kapcsolatot.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(500).delay(100)}>
            <Input label="Neve" value={name} onChangeText={setName} placeholder="Kiss János" />
            <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="nev@example.com" />
            <Input
              label="Üzenet"
              value={message}
              onChangeText={setMessage}
              placeholder="Írja meg kérdését..."
              multiline
              numberOfLines={5}
              style={styles.textarea}
            />
            <Button label="Üzenet küldése" onPress={handleSend} loading={loading} />
          </Animated.View>
        )}
      </ScreenWrapper>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.md, marginBottom: Spacing.lg },
  successBox: { alignItems: 'center', paddingTop: Spacing.xxl },
  successIcon: { fontSize: 56, marginBottom: Spacing.md },
  textarea: { height: 100, textAlignVertical: 'top', paddingTop: 8 },
});
