import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../theme';

type Variant = 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'caption' | 'label';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  semibold?: boolean;
  bold?: boolean;
}

export function Text({ variant = 'body', color, semibold, bold, style, ...props }: Props) {
  return (
    <RNText
      style={[
        styles[variant],
        color ? { color } : undefined,
        semibold ? { fontWeight: Fonts.weights.semibold } : undefined,
        bold ? { fontWeight: Fonts.weights.bold } : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: Fonts.sizes.xxxl,
    fontWeight: Fonts.weights.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  h2: {
    fontSize: Fonts.sizes.xxl,
    fontWeight: Fonts.weights.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: Fonts.sizes.xl,
    fontWeight: Fonts.weights.bold,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: Fonts.sizes.lg,
    fontWeight: Fonts.weights.semibold,
    color: Colors.textPrimary,
  },
  body: {
    fontSize: Fonts.sizes.base,
    fontWeight: Fonts.weights.regular,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  caption: {
    fontSize: Fonts.sizes.sm,
    fontWeight: Fonts.weights.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  label: {
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.semibold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
