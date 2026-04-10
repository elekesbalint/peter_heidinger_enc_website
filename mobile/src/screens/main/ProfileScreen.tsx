import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Text, Button, Input, Card, Divider } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { getProfile, patchProfile, sendReferralInvite } from '../../lib/api';
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
  const [saving, setSaving] = useState(false);
  const [referralEmail, setReferralEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProfile();
      setProfile(data ?? {});
      setForm(data ?? {});
    } catch {
      // hiba tolerálva
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await patchProfile(form);
      setProfile(form);
      setEditing(false);
      Alert.alert('Sikeres', 'Profil mentve!');
    } catch (err: unknown) {
      Alert.alert('Hiba', err instanceof Error ? err.message : 'Mentés sikertelen.');
    } finally {
      setSaving(false);
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

  return (
    <ScreenWrapper>
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <LinearGradient colors={Gradients.accent} style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {(profile.first_name?.[0] ?? profile.email?.[0] ?? 'U').toUpperCase()}
          </Text>
        </LinearGradient>
        <Text variant="h3" style={{ marginTop: 12 }}>{displayName}</Text>
        <Text variant="caption">{profile.email ?? '-'}</Text>
      </View>

      {/* Profile form */}
      <View>
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
            <Input label="Keresztnév" value={form.first_name ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))} />
            <Input label="Vezetéknév" value={form.last_name ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} />
            <Input label="Telefonszám" value={form.phone ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <Input label="Utca" value={form.address_street ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_street: v }))} />
            <Input label="Város" value={form.address_city ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_city: v }))} />
            <Input label="Irányítószám" value={form.address_postal_code ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_postal_code: v }))} keyboardType="numeric" />
            <Input label="Ország kód (pl. HU)" value={form.address_country ?? ''} onChangeText={(v) => setForm((f) => ({ ...f, address_country: v }))} autoCapitalize="characters" maxLength={2} />
            <View style={styles.editActions}>
              <Button label="Mégse" variant="secondary" onPress={() => { setForm(profile); setEditing(false); }} style={{ flex: 1, marginRight: 8 }} />
              <Button label="Mentés" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <Card padding={16} style={styles.profileCard}>
            {[
              ['Keresztnév', profile.first_name],
              ['Vezetéknév', profile.last_name],
              ['Telefonszám', profile.phone],
              ['Cím', [profile.address_street, profile.address_postal_code, profile.address_city].filter(Boolean).join(', ')],
              ['Ország', profile.address_country],
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
        )}
      </View>

      {/* Referral */}
      <View>
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
                onPress={handleInvite}
                loading={inviting}
                size="md"
                style={{ marginLeft: 8, marginBottom: 16 }}
              />
            </View>
          )}
        </Card>
      </View>

      {/* Legal links */}
      <View>
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
                onPress={() => (navigation as unknown as { navigate: (s: string) => void }).navigate(item.screen)}
              >
                <Text style={{ fontSize: 18, marginRight: 12 }}>{item.icon}</Text>
                <Text style={{ flex: 1 }}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <Divider style={{ marginVertical: 0 }} />}
            </View>
          ))}
        </Card>
      </View>

      {/* Logout */}
      <View>
        <Button label="Kilépés" variant="danger" onPress={handleSignOut} style={styles.logoutBtn} />
      </View>

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarSection: { alignItems: 'center', paddingTop: Spacing.lg, marginBottom: Spacing.xl },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 32, fontWeight: Fonts.weights.bold, color: Colors.white },
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
});
