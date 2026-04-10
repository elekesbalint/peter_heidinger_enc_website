import React, { useEffect, useState, useCallback } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Card, Badge, ScreenWrapper, Button } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { fetchMobileSummary } from '../../lib/api';
import { assertSupabaseConfigured, supabase } from '../../lib/supabase';
import type { EncDeviceOrder, StripeTopup, DeviceWallet } from '../../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>;
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

function formatHuf(n: number) {
  return n.toLocaleString('hu-HU') + ' Ft';
}

export function DashboardScreen({ navigation }: Props) {
  const [user, setUser] = useState<{ email?: string; id?: string } | null>(null);
  const [wallets, setWallets] = useState<DeviceWallet[]>([]);
  const [orders, setOrders] = useState<EncDeviceOrder[]>([]);
  const [topups, setTopups] = useState<StripeTopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const headerAnim = useFadeIn(0);
  const balanceAnim = useFadeIn(100);
  const actionsAnim = useFadeIn(180);
  const devicesAnim = useFadeIn(260);
  const ordersAnim = useFadeIn(330);
  const topupsAnim = useFadeIn(400);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      assertSupabaseConfigured();
      const { data: session } = await supabase.auth.getSession();
      const u = session?.session?.user;
      if (!u) {
        setUser(null);
        setWallets([]);
        setOrders([]);
        setTopups([]);
        return;
      }
      setUser({ email: u.email, id: u.id });

      const summary = await fetchMobileSummary();

      setWallets(
        summary.wallets.map((w) => ({
          device_identifier: w.deviceIdentifier,
          balance_huf: w.balanceHuf,
          updated_at: w.updatedAt ?? '',
        })),
      );
      setOrders(
        summary.orders.map((o) => ({
          id: o.id,
          device_identifier: o.deviceIdentifier,
          status: o.status,
          paid_at: o.paidAt,
          amount_huf: o.amountHuf,
          license_plate: null,
          category: typeof o.category === 'string' ? o.category : String(o.category ?? ''),
          created_at: o.createdAt,
        })) as EncDeviceOrder[],
      );
      setTopups(
        summary.topups
          .filter((t) => t.status === 'paid')
          .slice(0, 15)
          .map((t) => ({
            id: t.id,
            amount_huf: t.amountHuf,
            currency: t.currency,
            status: t.status,
            paid_at: t.paidAt,
            created_at: t.paidAt ?? '',
            device_identifier: t.deviceIdentifier,
          })) as StripeTopup[],
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setLoadError(
        /network request failed/i.test(raw)
          ? 'Nem sikerült kapcsolódni a szerverhez. Ellenőrizd a netet és az EXPO_PUBLIC_API_BASE_URL értéket (.env), majd: npx expo start -c.'
          : raw,
      );
      setWallets([]);
      setOrders([]);
      setTopups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance_huf ?? 0), 0);

  if (loading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  if (loadError) {
    return (
      <ScreenWrapper>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button label="Újrapróbálás" onPress={() => { setLoading(true); load(); }} style={styles.retryBtn} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper onRefresh={onRefresh} refreshing={refreshing}>

      {/* Header */}
      <Animated.View style={[styles.headerRow, headerAnim]}>
        <View>
          <Text variant="caption">Üdvözöljük,</Text>
          <Text variant="h3">{user?.email?.split('@')[0] ?? 'Felhasználó'}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarCircle}
          onPress={() => navigation.navigate('BlogList')}
        >
          <LinearGradient colors={Gradients.accent} style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {(user?.email?.[0] ?? 'U').toUpperCase()}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Balance hero card */}
      <Animated.View style={balanceAnim}>
        <LinearGradient
          colors={['#1A1A45', '#0E0E30']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.balanceAccentLine} />
          <Text variant="label" style={{ color: Colors.textSecondary }}>
            ÖSSZES EGYENLEG
          </Text>
          <Text style={styles.balanceAmount}>{formatHuf(totalBalance)}</Text>
          <Text variant="caption">{wallets.length} eszköz</Text>
        </LinearGradient>
      </Animated.View>

      {/* Quick actions */}
      <Animated.View style={[styles.actionsRow, actionsAnim]}>
        {[
          { icon: '📦', label: 'Rendelés', screen: 'Order' },
          { icon: '💳', label: 'Feltöltés', screen: 'Topup' },
          { icon: '📰', label: 'Hírek', screen: 'Blog' },
          { icon: '✉️', label: 'Kapcsolat', screen: 'Contact' },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.actionBtn}
            onPress={() => {
              if (item.screen === 'Order') (navigation as unknown as { navigate: (s: string) => void }).navigate('OrderTab');
              else if (item.screen === 'Topup') (navigation as unknown as { navigate: (s: string) => void }).navigate('TopupTab');
              else if (item.screen === 'Blog') navigation.navigate('BlogList');
              else navigation.navigate('Contact');
            }}
          >
            <LinearGradient
              colors={Gradients.dark}
              style={styles.actionCircle}
            >
              <Text style={styles.actionIcon}>{item.icon}</Text>
            </LinearGradient>
            <Text variant="caption" style={styles.actionLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Devices */}
      {wallets.length > 0 && (
        <Animated.View style={devicesAnim}>
          <Text variant="title" style={styles.sectionTitle}>Eszközeim</Text>
          {wallets.map((w, i) => (
            <TouchableOpacity
              key={w.device_identifier}
              onPress={() => navigation.navigate('DeviceDetail', { identifier: w.device_identifier })}
              activeOpacity={0.8}
            >
              <Card style={styles.deviceCard} padding={16}>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceIconWrap}>
                    <LinearGradient colors={Gradients.teal} style={styles.deviceIcon}>
                      <Text style={styles.deviceIconText}>📡</Text>
                    </LinearGradient>
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text semibold>{w.device_identifier}</Text>
                    <Text variant="caption">{formatHuf(w.balance_huf ?? 0)}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Recent orders */}
      {orders.length > 0 && (
        <Animated.View style={ordersAnim}>
          <Text variant="title" style={styles.sectionTitle}>Rendelések</Text>
          {orders.slice(0, 3).map((o) => (
            <Card key={o.id} style={styles.rowCard} padding={14}>
              <View style={styles.txRow}>
                <View style={styles.txIconCircle}>
                  <Text style={{ fontSize: 18 }}>📦</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text semibold style={{ fontSize: Fonts.sizes.sm }}>{o.device_identifier ?? 'ENC készülék'}</Text>
                  <Text variant="caption">{o.paid_at ? new Date(o.paid_at).toLocaleDateString('hu-HU') : '-'}</Text>
                </View>
                <View style={styles.txRight}>
                  <Badge label={statusLabel(o.status)} color={statusColor(o.status)} />
                  {o.amount_huf && (
                    <Text style={styles.txAmount}>{formatHuf(o.amount_huf)}</Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </Animated.View>
      )}

      {/* Recent topups */}
      {topups.length > 0 && (
        <Animated.View style={topupsAnim}>
          <Text variant="title" style={styles.sectionTitle}>Feltöltések</Text>
          {topups.slice(0, 5).map((t) => (
            <Card key={t.id} style={styles.rowCard} padding={14}>
              <View style={styles.txRow}>
                <View style={[styles.txIconCircle, { backgroundColor: Colors.accentTealSoft }]}>
                  <Text style={{ fontSize: 18 }}>💳</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text semibold style={{ fontSize: Fonts.sizes.sm }}>{t.device_identifier ?? '-'}</Text>
                  <Text variant="caption">{t.paid_at ? new Date(t.paid_at).toLocaleDateString('hu-HU') : '-'}</Text>
                </View>
                <Text style={[styles.txAmount, { color: Colors.success }]}>
                  +{formatHuf(t.amount_huf ?? 0)}
                </Text>
              </View>
            </Card>
          ))}
        </Animated.View>
      )}

      {wallets.length === 0 && orders.length === 0 && (
        <Animated.View style={[styles.emptyBox, devicesAnim]}>
          <Text style={styles.emptyIcon}>🚀</Text>
          <Text variant="title" style={styles.emptyTitle}>Kezdje el!</Text>
          <Text variant="caption" style={styles.emptyText}>
            Rendelje meg első ENC készülékét, és töltse fel egyenlegét az útdíj-fizetéshez.
          </Text>
        </Animated.View>
      )}

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Fonts.sizes.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryBtn: { marginTop: Spacing.lg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  avatarCircle: {},
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 18, fontWeight: Fonts.weights.bold, color: Colors.white },
  balanceCard: {
    borderRadius: 24,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceAccentLine: {
    position: 'absolute', top: 0, left: 24, right: 24, height: 2,
    backgroundColor: Colors.accent, borderRadius: 1,
  },
  balanceAmount: {
    fontSize: 38,
    fontWeight: Fonts.weights.extrabold,
    color: Colors.white,
    marginVertical: 6,
    letterSpacing: -1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionCircle: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: Fonts.sizes.xs, textAlign: 'center' },
  sectionTitle: { marginBottom: Spacing.sm, marginTop: Spacing.md },
  deviceCard: { marginBottom: 8 },
  deviceRow: { flexDirection: 'row', alignItems: 'center' },
  deviceIconWrap: { marginRight: 12 },
  deviceIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  deviceIconText: { fontSize: 18 },
  deviceInfo: { flex: 1 },
  chevron: { fontSize: 22, color: Colors.textTertiary },
  rowCard: { marginBottom: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center' },
  txIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold, color: Colors.textPrimary, marginTop: 4 },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 56, marginBottom: Spacing.md },
  emptyTitle: { marginBottom: 8, textAlign: 'center' },
  emptyText: { textAlign: 'center', maxWidth: 280 },
});
