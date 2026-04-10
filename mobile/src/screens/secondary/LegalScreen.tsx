import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Text } from '../../components/ui';
import { Colors, Gradients, Spacing } from '../../theme';
import { getSettings } from '../../lib/api';

interface Props {
  type: 'aszf' | 'adatvedelem';
}

export function LegalScreen({ type }: Props) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState(type === 'aszf' ? 'ÁSZF' : 'Adatvédelmi nyilatkozat');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = type === 'aszf' ? 'aszf_content' : 'privacy_content';
    const titleKey = type === 'aszf' ? 'aszf_title' : 'privacy_title';
    getSettings([key, titleKey]).then((s) => {
      setContent(s[key] ?? 'A tartalom hamarosan elérhető.');
      if (s[titleKey]) setTitle(s[titleKey]);
    }).finally(() => setLoading(false));
  }, [type]);

  if (loading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  return (
    <ScreenWrapper>
      <Text variant="h2" style={styles.title}>{title}</Text>
      <Text variant="body" style={styles.body}>{content}</Text>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { paddingTop: Spacing.md, marginBottom: Spacing.lg },
  body: { lineHeight: 24, color: Colors.textSecondary },
});
