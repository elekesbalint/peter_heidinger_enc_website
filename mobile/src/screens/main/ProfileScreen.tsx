import React, { useEffect, useState, useCallback } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ScreenWrapper, Text, Button, Input, Card, Divider } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { getProfile, patchProfile, uploadProfileAvatar, sendReferralInvite } from '../../lib/api';
import { signOut } from '../../lib/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;
}

export function ProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [referralEmail, setReferralEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const avatarAnim = useFadeIn(0);
  const formAnim = useFadeIn(100);
  const referralAnim = useFadeIn(200);
  const legalAnim = useFadeIn(280);
  const logoutAnim = useFadeIn(340);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setRefreshing(!!opts?.silent);
    setLoadError(null);
    try {
      const data = await getProfile();
      setProfile(data);
      setForm(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Betöltés sikertelen.';
      setLoadError(msg);
      if (!opts?.silent) {
        setProfile({});
        setForm({});
      }
    } finally {
      if (!opts?.silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (form.user_type === 'company') {
      if (!form.company_name?.trim()) {
        Alert.alert('Hiányzó adat', 'Céges fióknál a cégnév kötelező.');
        return;
      }
      if (!form.tax_number?.trim()) {
        Alert.alert('Hiányzó adat', 'Céges fióknál az adószám kötelező.');
        return;
      }
    }
    setSaving(true);
    try {
      await patchProfile(form);
      await load({ silent: true });
      setEditing(false);
      Alert.alert('Sikeres', 'Profil mentve!');
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Mentés sikertelen.');
    } finally {
      setSaving(false);
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Engedély szükséges', 'A galériához való hozzáférést a beállításokban engedélyezheted.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const b64 = asset.base64;
    if (!b64) {
      Alert.alert('Hiba', 'A kép nem olvasható be. Próbálj másik fájlt.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const { avatarUrl } = await uploadProfileAvatar(b64, asset.mimeType ?? 'image/jpeg');
      setAvatarLoadError(false);
      setProfile((p) => ({ ...p, avatar_url: avatarUrl, updated_at: String(Date.now()) }));
      setForm((p) => ({ ...p, avatar_url: avatarUrl }));
      Alert.alert('Kész', 'Profilkép frissítve.');
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Feltöltés sikertelen.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Kilépés', 'Biztosan ki szeretne lépni?', [
      { text: 'Mégse', style: 'cancel' },
      {
        text: 'Kilépés', style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch { /* ignore */ }
        },
      },
    ]);
  }

  async function handleInvite() {
    if (!referralEmail.trim()) return;
    setInviting(true);
    try {
      await sendReferralInvite(referralEmail.trim());
      setInviteSuccess(true);
      setReferralEmail('');
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Meghívó küldése sikertelen.');
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Felhasználó';
  const rawAvatarUrl = profile.avatar_url?.trim() || '';
  // Cache-bust: ha ugyanolyan fájlnévvel töltünk fel újat, a RN Image cache-elheti a régit
  const avatarUri = rawAvatarUrl
    ? rawAvatarUrl.includes('?') ? rawAvatarUrl : `${rawAvatarUrl}?v=${profile.updated_at || '0'}`
    : '';
  const isCompany = profile.user_type === 'company';

  return (
    <ScreenWrapper
      onRefresh={() => void load({ silent: true })}
      refreshing={refreshing}
    >
      {loadError ? (
        <Card padding={14} style={{ marginBottom: Spacing.md }}>
          <Text style={{ color: Colors.danger, marginBottom: 8 }}>{loadError}</Text>
          <Button label="Újrapróbálás" onPress={() => void load()} size="md" />
        </Card>
      ) : null}

      {/* Avatar + name */}
      <Animated.View style={[styles.avatarSection, avatarAnim]}>
        <TouchableOpacity
          onPress={() => void pickAvatar()}
          disabled={uploadingAvatar}
          activeOpacity={0.85}
          style={styles.avatarTouch}
        >
          {avatarUri && !avatarLoadError ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatarImage}
              onError={() => setAvatarLoadError(true)}
            />
          ) : (
            <LinearGradient colors={Gradients.accent} style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {(profile.first_name?.[0] ?? profile.email?.[0] ?? 'U').toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          {uploadingAvatar ? (
            <View style={styles.avatarBadge}>
              <ActivityIndicator color={Colors.white} size="small" />
            </View>
          ) : (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeIcon}>📷</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text variant="caption" style={styles.avatarHint}>
          Koppints a profilkép módosításához
        </Text>
        <Text variant="h3" style={{ marginTop: 8 }}>{displayName}</Text>
        <Text variant="caption">{profile.email ?? '-'}</Text>
      </Animated.View>

      {/* Profile form */}
      <Animated.View style={formAnim}>
        <View style={styles.sectionHeader}>
          <Text variant="title">Személyes adatok</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>Szerkesztés</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <>
            <Text variant="caption" style={styles.fieldLabel}>Fiók típusa</Text>
            <View style={styles.typeRow}>
              {(['private', 'company'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, form.user_type === t && styles.typePillActive]}
                  onPress={() => setForm((f) => ({ ...f, user_type: t }))}
                >
                  <Text style={[styles.typePillText, form.user_type === t && styles.typePillTextActive]}>
                    {t === 'private' ? 'Magánszemély' : 'Cég'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Keresztnév" value={form.first_name ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} />
            <Input label="Vezetéknév" value={form.last_name ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} />
            <Input label="Telefonszám" value={form.phone ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            {form.user_type === 'company' ? (
              <>
                <Input label="Cégnév" value={form.company_name ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, company_name: v }))} />
                <Input label="Adószám" value={form.tax_number ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, tax_number: v }))} />
              </>
            ) : null}
            <Text variant="caption" style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Számlázási cím</Text>
            <Input label="Ország" value={form.address_country ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_country: v }))} />
            <Input label="Irányítószám" value={form.address_postal_code ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_postal_code: v }))} keyboardType="numeric" />
            <Input label="Település" value={form.address_city ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_city: v }))} />
            <Input label="Utca, házszám" value={form.address_street ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_street: v }))} />
            <Input label="Emelet, ajtó, egyéb (opcionális)" value={form.address_extra ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_extra: v }))} />
            <Text variant="caption" style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Szállítási cím</Text>
            <Input label="Ország" value={form.shipping_country ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, shipping_country: v }))} />
            <Input label="Irányítószám" value={form.shipping_postal_code ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, shipping_postal_code: v }))} keyboardType="numeric" />
            <Input label="Település" value={form.shipping_city ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, shipping_city: v }))} />
            <Input label="Utca, házszám" value={form.shipping_street ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, shipping_street: v }))} />
            <Input label="Emelet, ajtó, egyéb (opcionális)" value={form.shipping_extra ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, shipping_extra: v }))} />
            <View style={styles.editActions}>
              <Button label="Mégse" variant="secondary" onPress={() => { setForm(profile); setEditing(false); }} style={{ flex: 1, marginRight: 8 }} />
              <Button label="Mentés" onPress={() => void handleSave()} loading={saving} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <>
            <Card padding={16} style={styles.profileCard}>
              <Text style={styles.addrSectionLabel}>Személyes adatok</Text>
              {[
                ['Keresztnév', profile.first_name],
                ['Vezetéknév', profile.last_name],
                ['Telefonszám', profile.phone],
                ...(isCompany
                  ? ([['Cégnév', profile.company_name], ['Adószám', profile.tax_number]] as [string, string][])
                  : []),
              ].map(([label, value], i, arr) => (
                <View key={label}>
                  <View style={styles.profileRow}>
                    <Text variant="caption" style={{ flex: 1 }}>{label}</Text>
                    <Text style={styles.profileValue}>{value || '—'}</Text>
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </View>
              ))}
            </Card>

            <Card padding={16} style={styles.profileCard}>
              <Text style={styles.addrSectionLabel}>Számlázási cím</Text>
              {[
                ['Ország', profile.address_country],
                ['Irányítószám', profile.address_postal_code],
                ['Település', profile.address_city],
                ['Utca, házszám', profile.address_street],
                ...(profile.address_extra ? [['Emelet, ajtó, egyéb', profile.address_extra]] as [string, string][] : []),
              ].map(([label, value], i, arr) => (
                <View key={label}>
                  <View style={styles.profileRow}>
                    <Text variant="caption" style={{ flex: 1 }}>{label}</Text>
                    <Text style={styles.profileValue}>{value || '—'}</Text>
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </View>
              ))}
            </Card>

            <Card padding={16} style={styles.profileCard}>
              <Text style={styles.addrSectionLabel}>Szállítási cím</Text>
              {[
                ['Ország', profile.shipping_country],
                ['Irányítószám', profile.shipping_postal_code],
                ['Település', profile.shipping_city],
                ['Utca, házszám', profile.shipping_street],
                ...(profile.shipping_extra ? [['Emelet, ajtó, egyéb', profile.shipping_extra]] as [string, string][] : []),
              ].map(([label, value], i, arr) => (
                <View key={label}>
                  <View style={styles.profileRow}>
                    <Text variant="caption" style={{ flex: 1 }}>{label}</Text>
                    <Text style={styles.profileValue}>{value || '—'}</Text>
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </View>
              ))}
            </Card>
          </>
        )}
      </Animated.View>

      {/* Referral */}
      <Animated.View style={referralAnim}>
        <Text variant="title" style={styles.sectionTitle}>Barát meghívása</Text>
        <Card padding={16} style={{ marginBottom: Spacing.md }}>
          <Text variant="caption" style={{ marginBottom: 10, lineHeight: 18 }}>
            Hívja meg barátait és mindketten kedvezményt kapnak az első ENC rendelésre.
          </Text>
          {inviteSuccess ? (
            <View style={styles.inviteSuccess}>
              <Text style={{ fontSize: 28 }}>✅</Text>
              <Text semibold style={{ marginLeft: 10 }}>Meghívó elküldve!</Text>
            </View>
          ) : (
            <View style={styles.inviteRow}>
              <Input
                value={referralEmail}
                onChangeText={setReferralEmail}
                placeholder="barát@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              <Button
                label="Küld"
                onPress={() => void handleInvite()}
                loading={inviting}
                size="md"
                style={{ marginLeft: 8, marginBottom: 16 }}
              />
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Legal links */}
      <Animated.View style={legalAnim}>
        <Text variant="title" style={styles.sectionTitle}>Egyebek</Text>
        <Card padding={0} style={{ marginBottom: Spacing.md, overflow: 'hidden' }}>
          {[
            { label: 'ÁSZF', screen: 'Aszf', icon: '📄' },
            { label: 'Adatvédelmi nyilatkozat', screen: 'Adatvedelem', icon: '🔒' },
            { label: 'Kapcsolat', screen: 'Contact', icon: '✉️' },
          ].map((item, i, arr) => (
            <View key={item.label}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => navigation.navigate(item.screen as keyof ProfileStackParamList)}
              >
                <Text style={{ fontSize: 18, marginRight: 12 }}>{item.icon}</Text>
                <Text style={{ flex: 1 }}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <Divider style={{ marginVertical: 0 }} />}
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Logout */}
      <Animated.View style={logoutAnim}>
        <Button label="Kilépés" variant="danger" onPress={handleSignOut} style={styles.logoutBtn} />
      </Animated.View>

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarSection: { alignItems: 'center', paddingTop: Spacing.lg, marginBottom: Spacing.xl },
  avatarTouch: { position: 'relative' },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.bgSurface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarLetter: { fontSize: 32, fontWeight: Fonts.weights.bold, color: Colors.white },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeIcon: { fontSize: 14 },
  avatarHint: { marginTop: 8, color: Colors.textTertiary },
  fieldLabel: { marginBottom: 6, color: Colors.textSecondary },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
  },
  typePillActive: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  typePillText: { fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.semibold, color: Colors.textSecondary },
  typePillTextActive: { color: Colors.accent },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  editLink: { color: Colors.accent, fontSize: Fonts.sizes.sm, fontWeight: Fonts.weights.medium },
  profileCard: { marginBottom: Spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  profileValue: { fontSize: Fonts.sizes.sm, color: Colors.textPrimary, textAlign: 'right', flexShrink: 1, flex: 2 },
  editActions: { flexDirection: 'row', marginTop: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { marginBottom: Spacing.sm, marginTop: Spacing.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  inviteSuccess: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  chevron: { fontSize: 20, color: Colors.textTertiary },
  logoutBtn: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
  addrSectionLabel: {
    fontSize: Fonts.sizes.xs,
    fontWeight: Fonts.weights.semibold,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  shippingNote: {
    marginTop: Spacing.sm,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});
