import React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Text, Button } from '../../components/ui';
import { Gradients, Spacing } from '../../theme';

interface SuccessProps {
  title?: string;
  subtitle?: string;
  onContinue?: () => void;
  continueLabel?: string;
}

export function SuccessScreen({ title = 'Sikeres!', subtitle, onContinue, continueLabel = 'Tovább' }: SuccessProps) {
  const anim = useFadeIn(0, 500);
  return (
    <ScreenWrapper scrollable={false} contentStyle={styles.center}>
      <Animated.View style={[styles.box, anim]}>
        <Text style={styles.icon}>✅</Text>
        <Text variant="h2" style={styles.title}>{title}</Text>
        {subtitle && <Text variant="caption" style={styles.subtitle}>{subtitle}</Text>}
        {onContinue && (
          <Button label={continueLabel} onPress={onContinue} style={styles.btn} />
        )}
      </Animated.View>
    </ScreenWrapper>
  );
}

export function CancelScreen({ onBack }: { onBack?: () => void }) {
  const anim = useFadeIn(0, 500);
  return (
    <ScreenWrapper scrollable={false} contentStyle={styles.center}>
      <Animated.View style={[styles.box, anim]}>
        <Text style={styles.icon}>❌</Text>
        <Text variant="h2" style={styles.title}>Fizetés megszakítva</Text>
        <Text variant="caption" style={styles.subtitle}>A fizetési folyamat megszakadt. Kérjük, próbálja újra.</Text>
        {onBack && <Button label="Vissza" onPress={onBack} variant="secondary" style={styles.btn} />}
      </Animated.View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  icon: { fontSize: 64, marginBottom: Spacing.lg },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: Spacing.xl },
  btn: { width: '100%' },
});
