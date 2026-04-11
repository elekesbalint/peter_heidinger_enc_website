import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Text, Button } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { fetchTopupConfig, startTopupCheckout } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TopupStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<TopupStackParamList, 'Topup'>;
  route: { params?: { deviceIdentifier?: string } };
}

type ConfigDevice = {
  id: string;
  identifier: string;
  category: string;
  status: string;
  balance_eur: number;
  smallestPackageBlocked: boolean;
};

type ConfigDestination = {
  id: string;
  name: string;
  price_ia: number;
  price_i: number;
  price_ii: number;
  price_iii: number;
  price_iv: number;
};

type TopupConfig = {
  ok: boolean;
  packages: number[];
  discountPercent: number;
  customDestinationMinEur: number;
  minBalanceWarningEur: number;
  fxEurToHuf: number;
  blockedCategoriesForSmallestPackage: string[];
  devices: ConfigDevice[];
  destinations: ConfigDestination[];
};

export function TopupScreen({ navigation, route }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [config, setConfig] = useState<TopupConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deviceIdentifier, setDeviceIdentifier] = useState(
    route.params?.deviceIdentifier ?? '',
  );
  const [travelDestination, setTravelDestination] = useState('');
  const [destinationMode, setDestinationMode] = useState<'list' | 'custom'>('list');
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPackageAmount, setSelectedPackageAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const prevMinimumRef = useRef<number | null>(null);

  const headerAnim = useFadeIn(0);
  const cardAnim = useFadeIn(100);
  const amountAnim = useFadeIn(200);
  const ctaAnim = useFadeIn(280);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setLoadError(null);
    try {
      await supabase.auth.getSession();
      const cfg = (await fetchTopupConfig()) as TopupConfig;
      if (!cfg.ok) {
        setLoadError('Nem sikerült betölteni a konfigurációt.');
        return;
      }
      setConfig(cfg);
      setDeviceIdentifier((prev) => {
        if (prev) return prev;
        return cfg.devices?.[0]?.identifier ?? '';
      });
      if ((cfg.destinations?.length ?? 0) === 0) {
        setDestinationMode('custom');
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Hálózati hiba a konfiguráció betöltésekor.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const packages = config?.packages ?? [];
  const destinations = config?.destinations ?? [];
  const devices = config?.devices ?? [];
  const discountPercent = Math.max(0, config?.discountPercent ?? 0);
  const customDestinationMinEur = Math.max(0, config?.customDestinationMinEur ?? 30);
  const fxEurToHuf = config?.fxEurToHuf ?? 400;

  const selectedDevice = useMemo(
    () => devices.find((d) => d.identifier === deviceIdentifier) ?? null,
    [devices, deviceIdentifier],
  );

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.name === travelDestination) ?? null,
    [destinations, travelDestination],
  );

  const filteredDestinations = useMemo(() => {
    const q = travelDestination.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter((d) => d.name.toLowerCase().includes(q));
  }, [destinations, travelDestination]);

  const destinationRequiredEur = useMemo(() => {
    if (!selectedDestination || !selectedDevice) return 0;
    const cat = selectedDevice.category.toLowerCase();
    const byCat: Record<string, number> = {
      ia: selectedDestination.price_ia ?? 0,
      i: selectedDestination.price_i ?? 0,
      ii: selectedDestination.price_ii ?? 0,
      iii: selectedDestination.price_iii ?? 0,
      iv: selectedDestination.price_iv ?? 0,
    };
    return Number(byCat[cat] ?? 0);
  }, [selectedDestination, selectedDevice]);

  const currentBalanceEur = Number(selectedDevice?.balance_eur ?? 0);
  const hasPricedListDestination = Boolean(selectedDestination && destinationRequiredEur > 0);
  const gapToDestinationEur = Math.max(0, destinationRequiredEur - currentBalanceEur);
  let minimumRequiredTopup = hasPricedListDestination ? gapToDestinationEur : 0;
  if (
    !hasPricedListDestination &&
    customDestinationMinEur > 0 &&
    selectedDevice &&
    travelDestination.trim().length >= 2
  ) {
    minimumRequiredTopup = Math.max(gapToDestinationEur, customDestinationMinEur);
  }

  useEffect(() => {
    setSelectedPackageAmount(null);
    const prevStored = prevMinimumRef.current;
    const prevMinSafe = prevStored ?? 0;

    if (minimumRequiredTopup <= 0) {
      prevMinimumRef.current = minimumRequiredTopup;
      return;
    }

    setCustomAmount((prev) => {
      const trimmed = String(prev).trim();
      if (trimmed === '') {
        if (minimumRequiredTopup > prevMinSafe && prevMinSafe === 0) {
          return minimumRequiredTopup.toFixed(2);
        }
        return prev;
      }
      const current = Number.parseFloat(trimmed.replace(',', '.'));
      if (!Number.isFinite(current)) return prev;
      if (minimumRequiredTopup > prevMinSafe && current < minimumRequiredTopup) {
        return minimumRequiredTopup.toFixed(2);
      }
      return prev;
    });
    prevMinimumRef.current = minimumRequiredTopup;
  }, [minimumRequiredTopup]);

  const parsedCustomAmount = Number.parseFloat(String(customAmount || '0').replace(',', '.'));
  const charged = Math.max(
    minimumRequiredTopup,
    Number.isFinite(parsedCustomAmount) ? parsedCustomAmount : 0,
  );
  const payable =
    selectedPackageAmount != null && discountPercent > 0
      ? Number(((charged * (100 - Math.min(100, discountPercent))) / 100).toFixed(2))
      : charged;

  async function handleTopup() {
    setError(null);
    const effectiveAmount = Number.parseFloat(customAmount.trim().replace(',', '.'));
    if (!effectiveAmount || !Number.isFinite(effectiveAmount)) {
      setError('Add meg a feltöltés összegét.');
      return;
    }
    if (!deviceIdentifier.trim()) {
      setError('Válassz készüléket a listából.');
      return;
    }
    if (travelDestination.trim().length < 2) {
      setError('Add meg az úticélt.');
      return;
    }
    if (effectiveAmount < minimumRequiredTopup) {
      setError(
        hasPricedListDestination
          ? `Ehhez az úticélhoz legalább ${minimumRequiredTopup.toLocaleString('hu-HU')} EUR feltöltés szükséges.`
          : `Egyéni úticél esetén legalább ${minimumRequiredTopup.toLocaleString('hu-HU')} EUR feltöltés szükséges.`,
      );
      return;
    }

    setLoading(true);
    try {
      const result = await startTopupCheckout({
        deviceIdentifier: deviceIdentifier.trim(),
        amountEur: effectiveAmount,
        selectedPackageEur: selectedPackageAmount ?? undefined,
        travelDestination: travelDestination.trim(),
      });
      if (result.url) {
        await Linking.openURL(result.url);
        navigation.navigate('TopupSuccess', {});
      }
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Feltöltés sikertelen.');
    } finally {
      setLoading(false);
    }
  }

  if (configLoading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  if (loadError) {
    return (
      <ScreenWrapper>
        <View style={styles.errorScreen}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button label="Újrapróbálás" onPress={loadConfig} style={styles.retryBtn} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!config) {
    return null;
  }

  const showInfoBox =
    selectedDevice &&
    travelDestination.trim().length >= 2 &&
    (hasPricedListDestination || destinationMode === 'custom' || Boolean(selectedDestination));

  return (
    <ScreenWrapper>
      {/* Header */}
      <Animated.View style={[styles.headerWrap, headerAnim]}>
        <Text variant="h2">Egyenlegfeltöltés</Text>
        <Text variant="caption" style={styles.subtitle}>
          Válaszd ki a készülékedet, az úticélt és a feltöltési csomagot, majd fizess
          Stripe-on keresztül.
        </Text>
      </Animated.View>

      {/* Section 1: Csomag és úticél */}
      <Animated.View style={cardAnim}>
        <View style={styles.sectionCard}>
          <Text semibold style={styles.sectionHeading}>
            Csomag és úticél
          </Text>
          <Text variant="caption" style={styles.sectionDesc}>
            Csak a fiókodhoz rendelt készülékre tölthetsz fel egyenleget. A legkisebb csomag
            egyes járműkategóriáknál nem elérhető (beállítás:{' '}
            {(config?.blockedCategoriesForSmallestPackage ?? []).join(', ') || 'ii, iii, iv'}).
          </Text>
          {config?.minBalanceWarningEur != null && (
            <Text variant="caption" style={styles.warningHint}>
              Figyelmeztetési küszöb alacsony egyenleghez:{' '}
              {config.minBalanceWarningEur.toLocaleString('hu-HU')} EUR (e-mail értesítés).
            </Text>
          )}

          {/* Device picker */}
          <Text style={styles.fieldLabel}>Készülék *</Text>
          {devices.length === 0 ? (
            <View style={styles.warnBox}>
              <Text variant="caption" style={styles.warnBoxText}>
                Nincs a fiókodhoz kötött készülék. Vásárolj ENC-t a Rendelés menüben, vagy
                várd meg a hozzárendelést.
              </Text>
            </View>
          ) : (
            <View style={styles.deviceList}>
              {devices.map((d) => {
                const active = d.identifier === deviceIdentifier;
                return (
                  <TouchableOpacity
                    key={d.id}
                    activeOpacity={0.8}
                    onPress={() => setDeviceIdentifier(d.identifier)}
                    style={[styles.deviceRow, active && styles.deviceRowActive]}
                  >
                    <Text style={styles.deviceEmoji}>📡</Text>
                    <View style={{ flex: 1 }}>
                      <Text semibold style={styles.deviceId}>
                        {d.identifier}
                      </Text>
                      <Text variant="caption" style={styles.deviceMeta}>
                        {String(d.category).toUpperCase()} — egyenleg:{' '}
                        {Number(d.balance_eur ?? 0).toLocaleString('hu-HU')} EUR
                      </Text>
                    </View>
                    {active && <Text style={styles.checkIcon}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Destination */}
          <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Úticél *</Text>
          {destinations.length > 0 && destinationMode === 'list' ? (
            <>
              <TextInput
                value={travelDestination}
                onChangeText={(t) => {
                  setTravelDestination(t);
                  setDestDropdownOpen(true);
                }}
                onFocus={() => setDestDropdownOpen(true)}
                placeholder="Kezdj el gépelni, majd válassz a listából…"
                placeholderTextColor={Colors.textTertiary}
                style={styles.textInput}
              />
              {destDropdownOpen && filteredDestinations.length > 0 && (
                <View style={styles.dropdown}>
                  <ScrollView
                    style={{ maxHeight: 180 }}
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                  >
                    {filteredDestinations.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        onPress={() => {
                          setTravelDestination(d.name);
                          setDestDropdownOpen(false);
                        }}
                        style={styles.dropdownItem}
                      >
                        <Text style={styles.dropdownItemText}>{d.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <TouchableOpacity onPress={() => setDestinationMode('custom')}>
                <Text style={styles.toggleLink}>Egyéb (saját megnevezés)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={travelDestination}
                onChangeText={setTravelDestination}
                placeholder="pl. Horvátország, Szlovénia…"
                placeholderTextColor={Colors.textTertiary}
                style={styles.textInput}
              />
              {destinations.length > 0 && (
                <TouchableOpacity onPress={() => setDestinationMode('list')}>
                  <Text style={styles.toggleLink}>Lista választása</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Info box */}
          {showInfoBox && (
            <>
              <View style={styles.infoBox}>
                {hasPricedListDestination ? (
                  <Text variant="caption" style={styles.infoBoxText}>
                    Jelenlegi egyenleg:{' '}
                    <Text semibold style={styles.infoBoxBold}>
                      {currentBalanceEur.toLocaleString('hu-HU')} EUR
                    </Text>{' '}
                    | Úticélhoz ajánlott:{' '}
                    <Text semibold style={styles.infoBoxBold}>
                      {destinationRequiredEur.toLocaleString('hu-HU')} EUR
                    </Text>
                  </Text>
                ) : selectedDestination ? (
                  <Text variant="caption" style={styles.infoBoxText}>
                    Úticél: <Text semibold style={styles.infoBoxBold}>{selectedDestination.name}</Text>
                    {'\n'}
                    <Text style={styles.infoBoxSmall}>
                      Ehhez a járműkategóriához nincs tárolt listaár; minimum feltöltés az admin
                      által beállított érték szerint.
                    </Text>
                  </Text>
                ) : (
                  <Text variant="caption" style={styles.infoBoxText}>
                    <Text semibold style={styles.infoBoxBold}>Egyéni úticél: </Text>
                    {travelDestination.trim()}
                    {'\n'}
                    <Text style={styles.infoBoxSmall}>
                      Listaáras ajánlott összeg ehhez a megnevezéshez nem elérhető.
                    </Text>
                  </Text>
                )}
                {minimumRequiredTopup > 0 ? (
                  <Text variant="caption" style={[styles.infoBoxText, { marginTop: 4 }]}>
                    Minimum szükséges feltöltés:{' '}
                    <Text semibold style={styles.infoBoxBold}>
                      {minimumRequiredTopup.toLocaleString('hu-HU')} EUR
                    </Text>
                  </Text>
                ) : (
                  <Text variant="caption" style={[styles.infoBoxText, { marginTop: 4 }]}>
                    A jelenlegi egyenleg elegendő, egyedi feltöltés opcionális.
                  </Text>
                )}
              </View>
              <Text variant="caption" style={styles.infoFootnote}>
                A hozzávetőlegesen kalkulált útdíj Letenye határátkelővel értendő. Ha más
                határátkelőt választasz, érdemes magasabb összeggel feltölteni a készülékedet.
              </Text>
            </>
          )}
        </View>
      </Animated.View>

      {/* Section 2: Feltöltés összege */}
      <Animated.View style={amountAnim}>
        <View style={styles.sectionCard}>
          <Text semibold style={styles.sectionHeading}>
            Feltöltés összege
          </Text>

          <TextInput
            value={customAmount}
            onChangeText={(t) => {
              setCustomAmount(t);
              setSelectedPackageAmount(null);
            }}
            onBlur={() => {
              const raw = customAmount.trim().replace(',', '.');
              if (!raw) return;
              const n = Number.parseFloat(raw);
              if (!Number.isFinite(n)) return;
              if (minimumRequiredTopup > 0 && n < minimumRequiredTopup) {
                setCustomAmount(minimumRequiredTopup.toFixed(2));
                return;
              }
              if (n > 0) setCustomAmount(n.toFixed(2));
            }}
            keyboardType="decimal-pad"
            placeholder={`${minimumRequiredTopup.toLocaleString('hu-HU')} vagy több`}
            placeholderTextColor={Colors.textTertiary}
            style={styles.textInput}
          />
          {selectedPackageAmount == null ? (
            <Text variant="caption" style={styles.amountHint}>
              Ennél a feltöltésnél a topup kedvezmény nem érvényes; minimum:{' '}
              {minimumRequiredTopup.toLocaleString('hu-HU')} EUR.
            </Text>
          ) : (
            <Text variant="caption" style={styles.amountHint}>
              Csomag kedvezmény: {discountPercent}%.
            </Text>
          )}
          <Text variant="caption" style={styles.payableRow}>
            Fizetendő:{' '}
            <Text semibold style={{ color: Colors.textPrimary }}>
              {payable.toLocaleString('hu-HU')} EUR
            </Text>
          </Text>

          {/* Package cards */}
          {packages.length > 0 && (
            <>
              <Text variant="caption" style={styles.packagesHint}>
                Gyors választás:
              </Text>
              <View style={styles.packagesGrid}>
                {packages.map((amount) => {
                  const selectedVal = Number.parseFloat(
                    String(customAmount || '0').replace(',', '.'),
                  );
                  const active = Math.abs(selectedVal - amount) < 0.001;
                  const disabled = amount < minimumRequiredTopup;
                  const hasDiscount = discountPercent > 0;
                  const discounted = hasDiscount
                    ? Number(
                        ((amount * (100 - Math.min(100, discountPercent))) / 100).toFixed(2),
                      )
                    : amount;
                  // Kártyaszélesség: (rendelkezésre álló szélesség - 2 gap) / 3
                  const cardGap = 8;
                  const horizontalPad = Spacing.md * 2 + 2; // sectionCard padding kb.
                  const cardW = Math.floor((screenWidth - horizontalPad - cardGap * 2) / 3);
                  return (
                    <TouchableOpacity
                      key={amount}
                      disabled={disabled}
                      activeOpacity={0.8}
                      onPress={() => {
                        setCustomAmount(String(amount));
                        setSelectedPackageAmount(amount);
                      }}
                      style={[
                        styles.pkgCard,
                        { width: cardW },
                        active && styles.pkgCardActive,
                        disabled && styles.pkgCardDisabled,
                      ]}
                    >
                      {active && (
                        <LinearGradient
                          colors={['rgba(108,99,255,0.22)', 'rgba(108,99,255,0.06)']}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      {/* Ár */}
                      <View style={styles.pkgAmountRow}>
                        <Text semibold style={[styles.pkgAmountNum, disabled && styles.pkgAmountDisabled]}>
                          {amount.toLocaleString('hu-HU')}
                        </Text>
                        <Text style={[styles.pkgAmountCurrency, disabled && styles.pkgAmountDisabled]}>
                          {' '}EUR
                        </Text>
                      </View>
                      {/* Kedvezmény pill — két sor: % fölül, ár alul */}
                      {hasDiscount ? (
                        <View style={[styles.pkgDiscountPill, disabled && styles.pkgDiscountPillDisabled]}>
                          <Text style={[styles.pkgDiscountPillPct, disabled && { color: Colors.textTertiary }]}>
                            -{Math.min(100, discountPercent)}%
                          </Text>
                          <Text style={[styles.pkgDiscountPillPrice, disabled && { color: Colors.textTertiary }]}>
                            {discounted.toLocaleString('hu-HU')} EUR
                          </Text>
                        </View>
                      ) : null}
                      {/* Disabled üzenet */}
                      {disabled && (
                        <Text style={styles.pkgDisabledNote} numberOfLines={2}>
                          Min. {minimumRequiredTopup.toLocaleString('hu-HU')} EUR
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      ) : null}

      {/* CTA */}
      <Animated.View style={ctaAnim}>
        <Button
          label={loading ? 'Átirányítás…' : 'Fizetés Stripe-pal'}
          onPress={handleTopup}
          loading={loading}
          disabled={devices.length === 0}
          style={styles.orderBtn}
        />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  retryBtn: { marginTop: Spacing.lg },
  headerWrap: { paddingTop: Spacing.md, marginBottom: Spacing.lg },
  subtitle: { marginTop: 6 },
  sectionCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionDesc: {
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  warningHint: {
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  warnBox: {
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
    padding: Spacing.sm,
  },
  warnBoxText: { color: Colors.warning },
  deviceList: { gap: 8 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  deviceRowActive: { borderColor: Colors.accent },
  deviceEmoji: { fontSize: 20 },
  deviceId: { color: Colors.textPrimary, fontSize: Fonts.sizes.sm },
  deviceMeta: { color: Colors.textSecondary, marginTop: 2 },
  checkIcon: { color: Colors.accent, fontSize: 16, fontWeight: '700' },
  textInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdown: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 99,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: { color: Colors.textPrimary, fontSize: Fonts.sizes.sm },
  toggleLink: {
    color: Colors.accent,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    marginTop: 8,
  },
  infoBox: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    backgroundColor: 'rgba(99,102,241,0.1)',
    padding: 12,
  },
  infoBoxText: { color: Colors.textPrimary, lineHeight: 20 },
  infoBoxBold: { color: Colors.textPrimary, fontWeight: '700' },
  infoBoxSmall: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs },
  infoFootnote: {
    marginTop: 8,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  amountHint: { color: Colors.textTertiary, marginTop: 6 },
  payableRow: { color: Colors.textSecondary, marginTop: 4 },
  packagesHint: { color: Colors.textTertiary, marginTop: Spacing.md, marginBottom: 8 },
  packagesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  pkgCard: {
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
    alignItems: 'center',
  },
  pkgCardActive: { borderColor: Colors.accent },
  pkgCardDisabled: { opacity: 0.42 },
  pkgAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  pkgAmountNum: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: Fonts.sizes.xl + 2,
  },
  pkgAmountCurrency: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: Fonts.sizes.xl + 2,
  },
  pkgAmountDisabled: { color: Colors.textTertiary },
  pkgDiscountPill: {
    backgroundColor: Colors.successSoft,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,196,140,0.3)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  pkgDiscountPillDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: Colors.border,
  },
  pkgDiscountPillPct: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
    textAlign: 'center',
    lineHeight: 15,
  },
  pkgDiscountPillPrice: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success,
    textAlign: 'center',
    lineHeight: 14,
  },
  pkgDisabledNote: {
    fontSize: 10,
    color: Colors.warning,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
  },
  errorBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerSoft,
    padding: 12,
    marginBottom: Spacing.sm,
  },
  errorBoxText: { color: Colors.danger, fontSize: Fonts.sizes.sm },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
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
