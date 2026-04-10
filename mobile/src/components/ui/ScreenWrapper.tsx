import React from 'react';
import { ScrollView, View, StyleSheet, RefreshControl, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing } from '../../theme';

interface Props {
  children: React.ReactNode;
  scrollable?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  padBottom?: number;
}

export function ScreenWrapper({
  children,
  scrollable = true,
  onRefresh,
  refreshing = false,
  style,
  contentStyle,
  padBottom = 32,
}: Props) {
  return (
    <LinearGradient colors={Gradients.bg} style={[styles.flex, style]}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        {scrollable ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, { paddingBottom: padBottom }, contentStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={Colors.accent}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.md },
});
