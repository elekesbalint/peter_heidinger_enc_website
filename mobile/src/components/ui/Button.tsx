import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Radius, Gradients } from '../../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'teal';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  textStyle,
  size = 'lg',
  icon,
}: Props) {
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.base, styles[size], { opacity: isDisabled ? 0.5 : 1 }, style]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={Gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <View style={styles.row}>
            {icon && <View style={styles.iconLeft}>{icon}</View>}
            <Text style={[styles.btnText, styles[`text_${size}`], textStyle]}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'teal') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.base, styles[size], { opacity: isDisabled ? 0.5 : 1 }, style]}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={Gradients.teal}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]}
        />
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <View style={styles.row}>
            {icon && <View style={styles.iconLeft}>{icon}</View>}
            <Text style={[styles.btnText, styles[`text_${size}`], textStyle]}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  const variantStyle: ViewStyle =
    variant === 'secondary'
      ? styles.secondary
      : variant === 'danger'
      ? styles.dangerBtn
      : styles.ghost;

  const variantTextColor =
    variant === 'secondary'
      ? Colors.textPrimary
      : variant === 'danger'
      ? Colors.danger
      : Colors.accent;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.base, styles[size], variantStyle, { opacity: isDisabled ? 0.5 : 1 }, style]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variantTextColor} />
      ) : (
        <View style={styles.row}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[styles.btnText, styles[`text_${size}`], { color: variantTextColor }, textStyle]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sm: { height: 40, paddingHorizontal: 16 },
  md: { height: 48, paddingHorizontal: 20 },
  lg: { height: 56, paddingHorizontal: 24 },
  secondary: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dangerBtn: {
    backgroundColor: Colors.dangerSoft,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  ghost: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: 8 },
  btnText: {
    fontWeight: Fonts.weights.semibold,
    color: Colors.white,
  },
  text_sm: { fontSize: Fonts.sizes.sm },
  text_md: { fontSize: Fonts.sizes.base },
  text_lg: { fontSize: Fonts.sizes.md },
});
