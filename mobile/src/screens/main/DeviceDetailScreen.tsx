import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFadeIn } from '../../hooks/useFadeIn';
import { ScreenWrapper, Text, Badge, Card, Button } from '../../components/ui';
import { Colors, Fonts, Gradients, Radius, Spacing } from '../../theme';
import { fetchMobileSummary, type MobileSummaryData } from '../../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'DeviceDetail'>;
  route: { params: { identifier: string } };
}

function statusColor(s: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'sold' || s === 'paid') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'cancelled') return 'danger';
  return 'neutral';
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    sold: 'Aktív', paid: 'Fizetve', pending: 'Folyamatban',
    cancelled: 'Törölve', waiting: 'Várólistán',
  };
  return map[s] ?? s;
}

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    ia: '0. kat. (IA)', i: 'I. kat.', ii: 'II. kat.', iii: 'III. kat.', iv: 'IV. kat.',
  };
  return map[c.toLowerCase()] ?? c.toUpperCase();
}

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('hu-HU');
}

function formatEur(huf: number, fx: number) {
  const eur = fx > 0 ? huf / fx : 0;
  return eur.toLocaleString('hu-HU', { maximumFractionDigits: 2 }) + ' EUR';
}

function formatHuf(n: number) {
  return n.toLocaleString('hu-HU') + ' Ft';
}

export function DeviceDetailScreen({ navigation, route }: Props) {
  const { identifier } = route.params;
  const [data, setData] = useState<MobileSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const headerAnim = useFadeIn(0);
  const balanceAnim = useFadeIn(80);
  const actionsAnim = useFadeIn(150);
  const topupsAnim = useFadeIn(220);
  const ordersAnim = useFadeIn(290);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const summary = await fetchMobileSummary();
      setData(summary);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Betöltés sikertelen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  if (loadError || !data) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <Text style={styles.errorText}>{loadError ?? 'Nincs adat.'}</Text>
          <Button label="Újrapróbálás" onPress={() => { setLoading(true); load(); }} style={{ marginTop: Spacing.md }} />
        </View>
      </ScreenWrapper>
    );
  }

  const fx = data.fxEurToHuf ?? 400;
  const minBalanceWarningEur = data.minBalanceWarningEur ?? 12.5;
  const device = data.devices.find((d) => d.identifier === identifier);
  const wallet = data.wallets.find((w) => w.deviceIdentifier === identifier);
  const hasBalance = wallet !== undefined || device?.balanceHuf !== undefined;
  const balanceHuf = wallet?.balanceHuf ?? device?.balanceHuf ?? null;
  const balanceEur = balanceHuf !== null && fx > 0 ? balanceHuf / fx : null;
  const lowBalance = balanceEur !== null && balanceEur < minBalanceWarningEur;

  const deviceTopups = data.topups
    .filter((t) => t.deviceIdentifier === identifier)
    .sort((a, b) => new Date(b.paidAt ?? b.id).getTime() - new Date(a.paidAt ?? a.id).getTime());

  const deviceOrders = data.orders
    .filter((o) => o.deviceIdentifier === identifier)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const updatedAt = wallet?.updatedAt ? formatDate(wallet.updatedAt) : null;

  return (
    <ScreenWrapper
      onRefresh={() => { setLoading(true); load(); }}
      refreshing={loading}
      contentStyle={{ paddingTop: Spacing.md }}
    >

      {/* Fejléc */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text variant="caption" style={styles.headerSub}>Eszköz részletei</Text>
          <Text semibold style={styles.headerId} numberOfLines={1}>{identifier}</Text>
        </View>
      </Animated.View>

      {/* Egyenleg kártya */}
      <Animated.View style={balanceAnim}>
        <LinearGradient
          colors={['#1A1A45', '#0E0E30']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text variant="label" style={styles.balanceLabel}>
            EGYENLEG
          </Text>
          {balanceEur === null ? (
            <Text style={styles.balanceNoData}>Még nem töltötted fel ezt a készüléket.</Text>
          ) : (
            <Text style={[styles.balanceAmount, lowBalance && styles.balanceAmountLow]}>
              {balanceEur.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} EUR
            </Text>
          )}
          {/* Töltöttség badge */}
          <View style={[
            styles.topupStateBadge,
            balanceEur === null ? styles.topupStateBadgeNone
            : lowBalance ? styles.topupStateBadgeLow
            : styles.topupStateBadgeOk,
          ]}>
            <Text style={[
              styles.topupStateBadgeText,
              balanceEur === null ? styles.topupStateBadgeTextNone
              : lowBalance ? styles.topupStateBadgeTextLow
              : styles.topupStateBadgeTextOk,
            ]}>
              {balanceEur === null ? '○ Nincs felhasználható útdíj'
                : lowBalance ? '! Feltöltés szükséges'
                : '✓ Rendben, tölthető'}
            </Text>
          </View>
          {lowBalance && balanceEur !== null && (
            <Text variant="caption" style={styles.balanceLowSub}>
              Alacsony egyenleg (küszöb {minBalanceWarningEur.toLocaleString('hu-HU')} EUR), töltsd fel.
            </Text>
          )}
          {!lowBalance && balanceEur !== null && (
            <Text variant="caption" style={styles.balanceSub}>Egyenleg megfelelő.</Text>
          )}
          {updatedAt && (
            <Text variant="caption" style={styles.balanceSub}>
              Utolsó frissítés: {updatedAt}
            </Text>
          )}
          {device && (
            <View style={styles.deviceMetaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{categoryLabel(device.category)}</Text>
              </View>
              {device.licensePlate && (
                <View style={[styles.metaPill, { marginLeft: 8 }]}>
                  <Text style={styles.metaPillText}>🚗 {device.licensePlate}</Text>
                </View>
              )}
              <View style={[styles.metaPill, { marginLeft: 8 }]}>
                <Text style={styles.metaPillText}>
                  {statusLabel(device.status)}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {/* Gyors művelet */}
      <Animated.View style={actionsAnim}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.topupBtn}
          onPress={() => {
            (navigation as unknown as { navigate: (s: string, p: object) => void })
              .navigate('TopupTab', { screen: 'Topup', params: { deviceIdentifier: identifier } });
          }}
        >
          <LinearGradient colors={Gradients.accent} style={styles.topupBtnGrad}>
            <Text style={styles.topupBtnText}>💳  Feltöltés erre az eszközre</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Feltöltési előzmények */}
      <Animated.View style={topupsAnim}>
        <Text variant="title" style={styles.sectionTitle}>Feltöltési előzmények</Text>
        {deviceTopups.length === 0 ? (
          <Card style={styles.emptyCard} padding={14}>
            <Text variant="caption" style={styles.emptyText}>Még nincs feltöltés ennél az eszköznél.</Text>
          </Card>
        ) : (
          deviceTopups.map((t) => {
            const eurAmt = fx > 0 ? (t.amountHuf ?? 0) / fx : 0;
            return (
              <Card key={t.id} style={styles.rowCard} padding={14}>
                <View style={styles.txRow}>
                  <View style={[styles.txIconCircle, { backgroundColor: Colors.accentTealSoft }]}>
                    <Text style={styles.txIcon}>💳</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text semibold style={styles.txTitle}>
                      {t.travelDestination ? t.travelDestination : 'Feltöltés'}
                    </Text>
                    <Text variant="caption">{formatDate(t.paidAt)}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Badge label={statusLabel(t.status)} color={statusColor(t.status)} />
                    <Text style={[styles.txAmount, { color: Colors.success }]}>
                      +{eurAmt.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} EUR
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </Animated.View>

      {/* Rendelési előzmények */}
      <Animated.View style={ordersAnim}>
        <Text variant="title" style={styles.sectionTitle}>Rendelési előzmények</Text>
        {deviceOrders.length === 0 ? (
          <Card style={styles.emptyCard} padding={14}>
            <Text variant="caption" style={styles.emptyText}>Nincs rendelés ennél az eszköznél.</Text>
          </Card>
        ) : (
          deviceOrders.map((o) => (
            <Card key={o.id} style={styles.rowCard} padding={14}>
              <View style={styles.txRow}>
                <View style={styles.txIconCircle}>
                  <Text style={styles.txIcon}>📦</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text semibold style={styles.txTitle}>ENC készülék</Text>
                  <Text variant="caption">{formatDate(o.paidAt ?? o.createdAt)}</Text>
                </View>
                <View style={styles.txRight}>
                  <Badge label={statusLabel(o.status)} color={statusColor(o.status)} />
                  {o.amountHuf != null && (
                    <Text style={styles.txAmount}>{formatHuf(o.amountHuf)}</Text>
                  )}
                </View>
              </View>
            </Card>
          ))
        )}
      </Animated.View>

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  errorText: { color: Colors.danger, textAlign: 'center', fontSize: Fonts.sizes.sm },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: Colors.textPrimary,
    lineHeight: 28,
    marginTop: -2,
  },
  headerTitles: { flex: 1 },
  headerSub: { color: Colors.textSecondary },
  headerId: { color: Colors.textPrimary, fontSize: Fonts.sizes.md },

  balanceCard: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 3,
    borderTopColor: Colors.accent,
  },
  balanceLabel: { color: Colors.textSecondary, marginBottom: 8 },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  balanceAmountLow: { color: '#ff6b6b' },
  balanceNoData: { fontSize: Fonts.sizes.sm, color: Colors.textTertiary, marginBottom: 6 },
  balanceSub: { color: Colors.textTertiary, marginBottom: 4 },
  balanceLowSub: { color: '#ff9a9a', marginBottom: 4, fontSize: Fonts.sizes.xs },
  topupStateBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  topupStateBadgeOk: { backgroundColor: 'rgba(5,150,105,0.18)' },
  topupStateBadgeLow: { backgroundColor: 'rgba(239,68,68,0.18)' },
  topupStateBadgeNone: { backgroundColor: 'rgba(255,255,255,0.06)' },
  topupStateBadgeText: { fontSize: 12, fontWeight: '700' },
  topupStateBadgeTextOk: { color: '#6ee7b7' },
  topupStateBadgeTextLow: { color: '#fca5a5' },
  topupStateBadgeTextNone: { color: Colors.textSecondary },
  deviceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
    gap: 0,
  },
  metaPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  metaPillText: {
    fontSize: Fonts.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  topupBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  topupBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  topupBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Fonts.sizes.base,
  },

  sectionTitle: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  rowCard: { marginBottom: 8 },
  emptyCard: { marginBottom: 8 },
  emptyText: { color: Colors.textTertiary },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIcon: { fontSize: 18 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: {
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
