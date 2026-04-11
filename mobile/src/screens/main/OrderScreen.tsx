import React, { useState, useEffect } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking } from 'react-native';
import { ScreenWrapper, Text, Button, Input } from '../../components/ui';
import { Colors, Spacing, Fonts, Radius } from '../../theme';
import { startDeviceOrderCheckout, getSettings } from '../../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OrderStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<OrderStackParamList, 'Order'>;
}

const CATEGORY_VALUES = ['ia', 'i', 'ii', 'iii', 'iv'] as const;
type CategoryValue = (typeof CATEGORY_VALUES)[number];

const CATEGORY_LABELS: Record<CategoryValue, string> = {
  ia: '0. kat. (IA)',
  i: 'I. kat.',
  ii: 'II. kat.',
  iii: 'III. kat.',
  iv: 'IV. kat.',
};

const CATEGORY_ICONS: Record<CategoryValue, string> = {
  ia: '🏍️',
  i: '🚗',
  ii: '🚌',
  iii: '🚛',
  iv: '🏗️',
};

const CATEGORY_DEFAULTS: Record<CategoryValue, string> = {
  ia: 'Motorkerékpárok\nMotoros triciklik\nNégykerekű motorkerékpárok',
  i: 'Személyautó (190 cm magasságig)\nMagasság tetőbox nélkül értendő\nUtánfutó nélkül',
  ii: 'Kisbuszok (190 cm magasság felett)\nMaximum 3.5T össztömeg\nIA. és I. kat. járművek utánfutóval',
  iii: '2 vagy 3 tengelyes járművek 3.5T össztömeg felett\n2 tengelyes járművek 3.5T össztömeg felett 1 tengelyes pótkocsival',
  iv: '4, vagy több tengelyes járművek 3.5T össztömeg felett\n2 tengelyes járművek 3.5T össztömeg felett 2, vagy 3 tengelyes pótkocsival\n3 tengelyes járművek 3.5 T össztömeg felett, függetlenül a pótkocsi tengelyeinek számától',
};

interface CategoryGuide {
  title: string;
  subtitle: string;
  items: Record<CategoryValue, string>;
}

function parseGuideItems(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function OrderScreen({ navigation }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue>('i');
  const [licensePlate, setLicensePlate] = useState('');
  const [contractAccepted, setContractAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guide, setGuide] = useState<CategoryGuide>({
    title: 'Kategória magyarázó',
    subtitle: 'Válaszd ki a kategóriát, és ellenőrizd a fő szempontokat!',
    items: CATEGORY_DEFAULTS,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  const headerAnim = useFadeIn(0);
  const infoAnim = useFadeIn(100);
  const catAnim = useFadeIn(180);
  const plateAnim = useFadeIn(260);
  const ctaAnim = useFadeIn(330);

  useEffect(() => {
    getSettings([
      'order_category_guide_title',
      'order_category_guide_subtitle',
      'order_category_guide_ia_items',
      'order_category_guide_i_items',
      'order_category_guide_ii_items',
      'order_category_guide_iii_items',
      'order_category_guide_iv_items',
    ])
      .then((s) => {
        setGuide({
          title: s.order_category_guide_title || 'Kategória magyarázó',
          subtitle:
            s.order_category_guide_subtitle ||
            'Válaszd ki a kategóriát, és ellenőrizd a fő szempontokat!',
          items: {
            ia: s.order_category_guide_ia_items || CATEGORY_DEFAULTS.ia,
            i: s.order_category_guide_i_items || CATEGORY_DEFAULTS.i,
            ii: s.order_category_guide_ii_items || CATEGORY_DEFAULTS.ii,
            iii: s.order_category_guide_iii_items || CATEGORY_DEFAULTS.iii,
            iv: s.order_category_guide_iv_items || CATEGORY_DEFAULTS.iv,
          },
        });
      })
      .finally(() => setSettingsLoading(false));
  }, []);

  function validate() {
    if (!contractAccepted) {
      setError('Fogadd el a vásárlási feltételeket a folytatáshoz.');
      return false;
    }
    const plate = licensePlate.trim().toUpperCase().replace(/\s+/g, '');
    if (plate.length < 5 || plate.length > 12) {
      setError('Adj meg érvényes rendszámot (5–12 karakter).');
      return false;
    }
    setError('');
    return true;
  }

  async function handleOrder() {
    if (!validate()) return;
    setLoading(true);
    try {
      const plate = licensePlate.trim().toUpperCase().replace(/\s+/g, '');
      const result = await startDeviceOrderCheckout({
        category: selectedCategory,
        licensePlate: plate,
      });
      if (result.waitlist) {
        Alert.alert(
          'Várólistára helyezve',
          'Jelenleg nincs elérhető eszköz. Várólistára vettük, amint eszköz szabadul, értesítjük.',
        );
        return;
      }
      if (result.url) {
        await Linking.openURL(result.url);
        Alert.alert(
          'Fizetési oldal megnyílt',
          'Ha sikeresen teljesítettéd a fizetést, hamarosan feldolgozzuk a rendelésed. Ellenőrizd a fiókodat.',
          [{ text: 'Rendben' }],
        );
      }
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Rendelés sikertelen.');
    } finally {
      setLoading(false);
    }
  }

  const currentItems = parseGuideItems(guide.items[selectedCategory]);

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
              Elektronikus útdíjszedő eszköz a horvát autópályákon. Egyszer regisztrál, utána
              automatikus áthajtás.
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Category section */}
      <Animated.View style={catAnim}>
        <Text variant="title" style={styles.sectionTitle}>
          1. Járműkategória
        </Text>

        {settingsLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.md }} />
        ) : (
          <>
            {/* Category pill buttons */}
            <View style={styles.pillRow}>
              {CATEGORY_VALUES.map((val) => (
                <TouchableOpacity
                  key={val}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCategory(val)}
                  style={[
                    styles.pill,
                    selectedCategory === val ? styles.pillActive : styles.pillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedCategory === val ? styles.pillTextActive : styles.pillTextInactive,
                    ]}
                  >
                    {CATEGORY_LABELS[val]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Guide card for selected category */}
            <View style={styles.guideCard}>
              <View style={styles.guideHeader}>
                <Text style={styles.guideIcon}>{CATEGORY_ICONS[selectedCategory]}</Text>
                <View style={{ flex: 1 }}>
                  <Text semibold style={styles.guideCategoryLabel}>
                    {CATEGORY_LABELS[selectedCategory]}
                  </Text>
                  <Text variant="caption" style={styles.guideTitle}>
                    {guide.title}
                  </Text>
                  <Text variant="caption" style={styles.guideSubtitle}>
                    {guide.subtitle}
                  </Text>
                </View>
              </View>
              <View style={styles.guideDivider} />
              {currentItems.map((item, idx) => (
                <View key={`${selectedCategory}-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text variant="caption" style={styles.bulletText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Animated.View>

      {/* License plate */}
      <Animated.View style={plateAnim}>
        <Text variant="title" style={styles.sectionTitle}>
          2. Rendszám
        </Text>
        <Input
          label="Rendszám"
          value={licensePlate}
          onChangeText={(t) => setLicensePlate(t.toUpperCase())}
          autoCapitalize="characters"
          placeholder="pl. ABC-123"
          maxLength={12}
        />
        <Text variant="caption" style={styles.inputHint}>
          A rendszám a készülékhez és a számlához kapcsolódik; Stripe fizetés után rögzítjük.
        </Text>
      </Animated.View>

      {/* Terms */}
      <Animated.View style={[plateAnim, styles.termsCard]}>
        <Text semibold style={styles.termsTitle}>
          Vásárlási feltételek
        </Text>
        {[
          'A megrendelés Stripe-on keresztüli fizetést követ.',
          'Sikeres fizetés után a készülék a fiókodhoz kapcsolódik.',
          'Ha nincs szabad készülék, várólistára kerülsz — értesítünk.',
        ].map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text variant="caption" style={styles.bulletText}>
              {item}
            </Text>
          </View>
        ))}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setContractAccepted((v) => !v)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, contractAccepted && styles.checkboxChecked]}>
            {contractAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text variant="caption" style={styles.checkLabel}>
            Elfogadom a vásárlási feltételeket és az adatkezelést.
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Animated.View style={ctaAnim}>
        <Button
          label="Tovább a fizetéshez"
          onPress={handleOrder}
          loading={loading}
          style={styles.orderBtn}
        />
        {/* Stripe badge */}
        <View style={styles.stripeBadge}>
          <Text style={styles.shieldIcon}>🔒</Text>
          <Text variant="caption" style={styles.stripeText}>
            Titkos és biztonságos fizetés{' '}
            <Text semibold style={styles.stripeBrand}>
              stripe
            </Text>
          </Text>
        </View>
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  pillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pillInactive: {
    backgroundColor: Colors.bgSurface,
    borderColor: Colors.border,
  },
  pillText: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillTextInactive: {
    color: Colors.textSecondary,
  },
  guideCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  guideIcon: { fontSize: 28, marginTop: 2 },
  guideCategoryLabel: {
    fontSize: Fonts.sizes.base,
    color: Colors.textPrimary,
  },
  guideTitle: {
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  guideSubtitle: {
    color: Colors.textSecondary,
    marginTop: 2,
  },
  guideDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  bulletDot: {
    color: Colors.accent,
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  inputHint: {
    marginTop: 6,
    color: Colors.textSecondary,
  },
  termsCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  termsTitle: {
    fontSize: Fonts.sizes.base,
    marginBottom: Spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  checkLabel: {
    flex: 1,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  errorText: {
    color: Colors.danger,
    marginBottom: Spacing.sm,
    fontSize: Fonts.sizes.sm,
  },
  orderBtn: { marginBottom: Spacing.sm },
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: Spacing.md,
  },
  shieldIcon: { fontSize: 18 },
  stripeText: { color: '#1e293b' },
  stripeBrand: { color: '#635BFF' },
});
