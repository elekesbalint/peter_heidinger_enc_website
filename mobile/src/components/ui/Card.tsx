import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadow, Gradients } from '../../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  gradient?: boolean;
  variant?: 'default' | 'surface' | 'accent';
  padding?: number;
}

export function Card({ children, style, gradient, variant = 'default', padding = 20 }: Props) {
  if (gradient) {
    return (
      <LinearGradient
        colors={variant === 'accent' ? Gradients.accent : Gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, Shadow.card, { padding }, style]}
      >
        {children}
      </LinearGradient>
    );
  }

  const bg =
    variant === 'surface' ? Colors.bgSurface : Colors.bgCard;

  return (
    <View style={[styles.card, Shadow.card, { backgroundColor: bg, padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
});
