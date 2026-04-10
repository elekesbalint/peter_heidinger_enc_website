import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { ScreenWrapper, Text, Button, Card, Input } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { fetchTopupConfig, startTopupCheckout } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TopupStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<TopupStackParamList, 'Topup'>;
  route: { params?: { deviceIdentifier?: string } };
}

export function TopupScreen({ navigation, route }: Props) {
  const [packages, setPackages] = useState<number[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [wallets, setWallets] = useState<{ device_identifier: string }[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(route.params?.deviceIdentifier ?? '');
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [minTopup, setMinTopup] = useState(5);
  const [fxRate, setFxRate] = useState(400);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const cfg = await fetchTopupConfig();
      setPackages(cfg.packages ?? []);
      setDestinations(cfg.destinations ?? []);
      setMinTopup(cfg.minTopupEur ?? 5);
      setFxRate(cfg.fxEurToHuf ?? 400);

      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user?.id) {
        const { data: ws } = await supabase
          .from('device_wallets')
          .select('device_identifier')
          .limit(20);
        setWallets(ws ?? []);
        if (!selectedDevice && ws?.[0]) {
          setSelectedDevice(ws[0].device_identifier);
        }
      }
    } catch {
      // config betöltési hiba tolerálva
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const finalAmountEur = selectedPackage
    ? selectedPackage
    : parseFloat(customAmount) || 0;

  async function handleTopup() {
    if (!selectedDevice) { Alert.alert('Hiba', 'Válasszon eszközt.'); return; }
    if (finalAmountEur < minTopup) { Alert.alert('Hiba', `Minimum feltöltési összeg: ${minTopup} EUR.`); return; }
    setLoading(true);
    try {
      const result = await startTopupCheckout({
        deviceIdentifier: selectedDevice,
        amountEur: finalAmountEur,
        selectedPackageEur: selectedPackage ?? undefined,
        travelDestination: selectedDestination || undefined,
      });
      if (result.url) {
        await WebBrowser.openBrowserAsync(result.url);
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

  return (
    <ScreenWrapper>
      <View style={styles.headerWrap}>
        <Text variant="h2">Feltöltés</Text>
        <Text variant="caption" style={styles.subtitle}>
          Töltse fel egyenlegét az ENC automatikus útdíj-fizetéshez.
        </Text>
      </View>

      {/* Device selector */}
      {wallets.length > 1 && (
        <View>
          <Text variant="title" style={styles.sectionTitle}>Eszköz</Text>
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.device_identifier}
              onPress={() => setSelectedDevice(w.device_identifier)}
              activeOpacity={0.8}
            >
              <Card
                style={[styles.deviceCard, selectedDevice === w.device_identifier ? styles.selectedCard : undefined] as any}
                padding={14}
              >
                <View style={styles.deviceRow}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>📡</Text>
                  <Text semibold style={{ flex: 1 }}>{w.device_identifier}</Text>
                  {selectedDevice === w.device_identifier && (
                    <Text style={{ color: Colors.accent, fontSize: 18 }}>✓</Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
          </View>
      )}

      {/* Packages */}
      {packages.length > 0 && (
        <View>
          <Text variant="title" style={styles.sectionTitle}>Csomag kiválasztása</Text>
          <View style={styles.packagesGrid}>
            {packages.map((pkg) => {
              const isSelected = selectedPackage === pkg;
              return (
                <TouchableOpacity
                  key={pkg}
                  style={[styles.pkgBtn, isSelected && styles.pkgBtnSelected]}
                  onPress={() => { setSelectedPackage(isSelected ? null : pkg); setCustomAmount(''); }}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={Gradients.accent}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[styles.pkgAmount, isSelected && { color: Colors.white }]}>
                    {pkg} EUR
                  </Text>
                  <Text style={[styles.pkgHuf, isSelected && { color: 'rgba(255,255,255,0.75)' }]}>
                    ≈ {Math.round(pkg * fxRate).toLocaleString('hu-HU')} Ft
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
      )}

      {/* Custom amount */}
      <View>
        <Text variant="title" style={styles.sectionTitle}>Egyéni összeg (EUR)</Text>
        <Input
          label="Egyéni összeg"
          value={customAmount}
          onChangeText={(t) => { setCustomAmount(t); setSelectedPackage(null); }}
          keyboardType="decimal-pad"
          placeholder={`min. ${minTopup} EUR`}
        />
      </View>

      {/* Destination */}
      {destinations.length > 0 && (
        <View>
          <Text variant="title" style={styles.sectionTitle}>Úticél (opcionális)</Text>
          <View style={styles.destWrap}>
            {destinations.slice(0, 8).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.destChip, selectedDestination === d && styles.destChipSelected]}
                onPress={() => setSelectedDestination(selectedDestination === d ? '' : d)}
              >
                <Text style={[styles.destChipText, selectedDestination === d && { color: Colors.accent }]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          </View>
      )}

      {/* Summary & CTA */}
      <View>
        {finalAmountEur > 0 && (
          <Card style={styles.summaryCard} padding={16}>
            <View style={styles.summaryRow}>
              <Text variant="caption">Feltöltési összeg</Text>
              <Text semibold>{finalAmountEur.toFixed(2)} EUR</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="caption">≈ Forintban</Text>
              <Text semibold>{Math.round(finalAmountEur * fxRate).toLocaleString('hu-HU')} Ft</Text>
            </View>
          </Card>
        )}
        <Button
          label="Feltöltés & Fizetés →"
          onPress={handleTopup}
          loading={loading}
          variant="teal"
          disabled={finalAmountEur < minTopup || !selectedDevice}
          style={styles.orderBtn}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerWrap: { paddingTop: Spacing.md, marginBottom: Spacing.lg },
  subtitle: { marginTop: 6 },
  sectionTitle: { marginBottom: Spacing.sm, marginTop: Spacing.sm },
  deviceCard: { marginBottom: 8 },
  selectedCard: { borderColor: Colors.accent },
  deviceRow: { flexDirection: 'row', alignItems: 'center' },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.md,
  },
  pkgBtn: {
    minWidth: '28%',
    flex: 1,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pkgBtnSelected: { borderColor: Colors.accent },
  pkgAmount: {
    fontSize: Fonts.sizes.md,
    fontWeight: Fonts.weights.bold,
    color: Colors.textPrimary,
  },
  pkgHuf: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginTop: 2 },
  destWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  destChip: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  destChipSelected: { borderColor: Colors.accent },
  destChipText: { fontSize: Fonts.sizes.sm, color: Colors.textSecondary },
  summaryCard: { marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  orderBtn: { marginBottom: Spacing.sm },
});
