import React, { useState, useCallback, useEffect } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { ScreenWrapper, Text, Button, Card, Input, Badge } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { startDeviceOrderCheckout } from '../../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OrderStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<OrderStackParamList, 'Order'>;
}

const CATEGORIES = [
  { key: 'A', label: 'A kategória', desc: 'Személyautók, furgonok ≤3.5t', icon: '🚗' },
  { key: 'B', label: 'B kategória', desc: 'Buszok, tehergépkocsik >3.5t', icon: '🚌' },
  { key: 'C', label: 'C kategória', desc: 'Motorkerékpárok', icon: '🏍️' },
];

export function OrderScreen({ navigation }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [licensePlate, setLicensePlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headerAnim = useFadeIn(0);
  const infoAnim = useFadeIn(100);
  const catAnim = useFadeIn(180);
  const plateAnim = useFadeIn(260);
  const ctaAnim = useFadeIn(330);

  function validate() {
    if (!selectedCategory) { setError('Válasszon kategóriát!'); return false; }
    if (!licensePlate.trim() || licensePlate.trim().length < 5) {
      setError('Adjon meg érvényes rendszámot (min. 5 karakter).'); return false;
    }
    setError('');
    return true;
  }

  async function handleOrder() {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await startDeviceOrderCheckout({
        category: selectedCategory!,
        licensePlate: licensePlate.trim().toUpperCase(),
      });
      if (result.waitlist) {
        Alert.alert(
          'Várólistára helyezve',
          'Jelenleg nincs elérhető eszköz. Várólistára vettük, amint eszköz szabadul, értesítjük.',
        );
        return;
      }
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url);
        navigation.navigate('OrderSuccess', {});
      }
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Rendelés sikertelen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenWrapper>
      <Animated.View style={[styles.headerWrap, headerAnim]}>
        <Text variant="h2">ENC Rendelés</Text>
        <Text variant="caption" style={styles.subtitle}>
          Rendelje meg személyre szabott ENC készülékét az elektronikus útdíj-fizetéshez.
        </Text>
      </Animated.View>

      {/* Info card */}
      <Animated.View style={infoAnim}>
        <LinearGradient colors={['#1A1A45', '#0E0E30']} style={styles.infoCard}>
          <Text style={styles.infoIcon}>📡</Text>
          <View style={{ flex: 1 }}>
            <Text semibold>Mi az ENC készülék?</Text>
            <Text variant="caption" style={{ marginTop: 4, lineHeight: 18 }}>
              Elektronikus útdíjszedő eszköz a horvát autópályákon. Egyszer regisztrál, utána automatikus áthajtás.
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Category */}
      <Animated.View style={catAnim}>
        <Text variant="title" style={styles.sectionTitle}>1. Járműkategória</Text>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            activeOpacity={0.8}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Card
              style={[styles.catCard, selectedCategory === cat.key ? styles.catCardSelected : undefined] as any}
              padding={16}
            >
              <View style={styles.catRow}>
                <View style={[
                  styles.catIconWrap,
                  selectedCategory === cat.key && { backgroundColor: Colors.accentSoft },
                ]}>
                  <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text semibold>{cat.label}</Text>
                  <Text variant="caption">{cat.desc}</Text>
                </View>
                <View style={[
                  styles.radioOuter,
                  selectedCategory === cat.key && styles.radioOuterSelected,
                ]}>
                  {selectedCategory === cat.key && <View style={styles.radioInner} />}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* License plate */}
      <Animated.View style={plateAnim}>
        <Text variant="title" style={styles.sectionTitle}>2. Rendszám</Text>
        <Input
          label="Rendszám"
          value={licensePlate}
          onChangeText={(t) => setLicensePlate(t.toUpperCase())}
          autoCapitalize="characters"
          placeholder="pl. ABC-123"
          maxLength={12}
        />
      </Animated.View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <Animated.View style={ctaAnim}>
        <Button
          label="Rendelés & Fizetés →"
          onPress={handleOrder}
          loading={loading}
          style={styles.orderBtn}
        />
        <Text variant="caption" style={styles.legal}>
          A rendelés gomb megnyomásával átirányítjuk Stripe biztonságos fizetési oldalára. Az ÁSZF-et elfogadja.
        </Text>
      </Animated.View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingTop: Spacing.md, marginBottom: Spacing.lg },
  subtitle: { marginTop: 6 },
  infoCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: { fontSize: 24, marginTop: 2 },
  sectionTitle: { marginBottom: Spacing.sm },
  catCard: { marginBottom: 10 },
  catCardSelected: { borderColor: Colors.accent },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: Colors.accent },
  radioInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  orderBtn: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  legal: { textAlign: 'center', paddingHorizontal: Spacing.sm },
  errorText: { color: Colors.danger, marginBottom: Spacing.sm, fontSize: Fonts.sizes.sm },
});
