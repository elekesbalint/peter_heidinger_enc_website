import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Fonts, Radius } from '../../theme';
import { Text } from './Text';

type Color = 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'teal';

interface Props {
  label: string;
  color?: Color;
  style?: ViewStyle;
}

const palette: Record<Color, { bg: string; text: string }> = {
  success: { bg: Colors.successSoft, text: Colors.success },
  warning: { bg: Colors.warningSoft, text: Colors.warning },
  danger: { bg: Colors.dangerSoft, text: Colors.danger },
  accent: { bg: Colors.accentSoft, text: Colors.accent },
  teal: { bg: Colors.accentTealSoft, text: Colors.accentTeal },
  neutral: { bg: Colors.bgSurface, text: Colors.textSecondary },
};

export function Badge({ label, color = 'neutral', style }: Props) {
  const { bg, text } = palette[color];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={{ fontSize: Fonts.sizes.xs, fontWeight: Fonts.weights.semibold, color: text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
