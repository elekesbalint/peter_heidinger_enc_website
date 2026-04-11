import React, { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Button, Input } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { patchProfile } from '../../lib/api';

interface Props {
  onComplete: () => void;
}

type Form = {
  user_type: 'private' | 'company';
  first_name: string;
  last_name: string;
  company_name: string;
  tax_number: string;
  phone: string;
  address_country: string;
  address_postal_code: string;
  address_city: string;
  address_street: string;
  address_extra: string;
  shipping_same: boolean;
  shipping_country: string;
  shipping_postal_code: string;
  shipping_city: string;
  shipping_street: string;
  shipping_extra: string;
};

const STEPS = [
  { key: 'type', title: 'Fiók típusa', subtitle: 'Milyen minőségben szeretnéd használni az AdriaGo-t?' },
  { key: 'name', title: 'Hogyan szólíthatunk?', subtitle: 'Add meg a neved a rendeléshez és számlázáshoz.' },
  { key: 'phone', title: 'Telefonszámod', subtitle: 'Szükség esetén ezen a számon keresünk meg.' },
  { key: 'billing', title: 'Számlázási cím', subtitle: 'Ez kerül a számlára és a rendelési visszaigazolóra.' },
  { key: 'shipping', title: 'Szállítási cím', subtitle: 'Ide küldjük az ENC készüléket.' },
] as const;

const TOTAL = STEPS.length;

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [form, setForm] = useState<Form>({
    user_type: 'private',
    first_name: '',
    last_name: '',
    company_name: '',
    tax_number: '',
    phone: '',
    address_country: 'Magyarország',
    address_postal_code: '',
    address_city: '',
    address_street: '',
    address_extra: '',
    shipping_same: true,
    shipping_country: 'Magyarország',
    shipping_postal_code: '',
    shipping_city: '',
    shipping_street: '',
    shipping_extra: '',
  });

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function animateStep(direction: 1 | -1, callback: () => void) {
    slideAnim.setValue(direction * 40);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    callback();
  }

  function validateStep(): string | null {
    const current = STEPS[step];
    if (current.key === 'name') {
      if (!form.first_name.trim()) return 'Keresztnév megadása kötelező.';
      if (!form.last_name.trim()) return 'Vezetéknév megadása kötelező.';
      if (form.user_type === 'company') {
        if (!form.company_name.trim()) return 'Cégnév megadása kötelező.';
        if (!form.tax_number.trim()) return 'Adószám megadása kötelező.';
      }
    }
    if (current.key === 'phone') {
      if (!form.phone.trim()) return 'Telefonszám megadása kötelező.';
    }
    if (current.key === 'billing') {
      if (!form.address_postal_code.trim()) return 'Irányítószám megadása kötelező.';
      if (!form.address_city.trim()) return 'Település megadása kötelező.';
      if (!form.address_street.trim()) return 'Utca, házszám megadása kötelező.';
    }
    if (current.key === 'shipping' && !form.shipping_same) {
      if (!form.shipping_postal_code.trim()) return 'Irányítószám megadása kötelező.';
      if (!form.shipping_city.trim()) return 'Település megadása kötelező.';
      if (!form.shipping_street.trim()) return 'Utca, házszám megadása kötelező.';
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) { Alert.alert('Hiányzó adat', err); return; }
    if (step < TOTAL - 1) {
      animateStep(1, () => setStep((s) => s + 1));
    } else {
      void handleFinish();
    }
  }

  function handleBack() {
    if (step > 0) animateStep(-1, () => setStep((s) => s - 1));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        user_type: form.user_type,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        address_country: form.address_country.trim() || 'Magyarország',
        address_postal_code: form.address_postal_code.trim(),
        address_city: form.address_city.trim(),
        address_street: form.address_street.trim(),
        address_extra: form.address_extra.trim(),
      };
      if (form.user_type === 'company') {
        payload.company_name = form.company_name.trim();
        payload.tax_number = form.tax_number.trim();
      }
      const shippingCountry = form.shipping_same
        ? payload.address_country
        : form.shipping_country.trim() || 'Magyarország';
      payload.shipping_country = shippingCountry;
      payload.shipping_postal_code = form.shipping_same ? payload.address_postal_code : form.shipping_postal_code.trim();
      payload.shipping_city = form.shipping_same ? payload.address_city : form.shipping_city.trim();
      payload.shipping_street = form.shipping_same ? payload.address_street : form.shipping_street.trim();
      payload.shipping_extra = form.shipping_same ? payload.address_extra : form.shipping_extra.trim();

      await patchProfile(payload);
      onComplete();
    } catch (e) {
      Alert.alert('Hiba', e instanceof Error ? e.message : 'Mentés sikertelen. Próbáld újra.');
    } finally {
      setSaving(false);
    }
  }

  const currentStep = STEPS[step];
  const isLast = step === TOTAL - 1;

  return (
    <LinearGradient colors={Gradients.bg} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Progress bar */}
        <View style={styles.progressWrap}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < step && styles.progressDotDone,
                i === step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={20}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
              {/* Step header */}
              <View style={styles.header}>
                <Text variant="caption" style={styles.stepLabel}>
                  {step + 1} / {TOTAL}
                </Text>
                <Text variant="h2" style={styles.title}>{currentStep.title}</Text>
                <Text variant="caption" style={styles.subtitle}>{currentStep.subtitle}</Text>
              </View>

              {/* Step content */}
              {currentStep.key === 'type' && (
                <View style={styles.typeRow}>
                  {(['private', 'company'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeCard, form.user_type === t && styles.typeCardActive]}
                      onPress={() => set('user_type', t)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.typeEmoji}>{t === 'private' ? '👤' : '🏢'}</Text>
                      <Text semibold style={form.user_type === t ? styles.typeCardActiveText : styles.typeCardText}>
                        {t === 'private' ? 'Magán­személy' : 'Cég'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {currentStep.key === 'name' && (
                <>
                  <Input label="Vezetéknév" value={form.last_name} onChangeText={(v) => set('last_name', v)} />
                  <Input label="Keresztnév" value={form.first_name} onChangeText={(v) => set('first_name', v)} />
                  {form.user_type === 'company' && (
                    <>
                      <View style={styles.sectionDivider} />
                      <Input label="Cégnév" value={form.company_name} onChangeText={(v) => set('company_name', v)} />
                      <Input label="Adószám" value={form.tax_number} onChangeText={(v) => set('tax_number', v)} keyboardType="numeric" />
                    </>
                  )}
                </>
              )}

              {currentStep.key === 'phone' && (
                <Input
                  label="Telefonszám"
                  value={form.phone}
                  onChangeText={(v) => set('phone', v)}
                  keyboardType="phone-pad"
                  placeholder="+36 30 123 4567"
                />
              )}

              {currentStep.key === 'billing' && (
                <>
                  <Input label="Ország" value={form.address_country} onChangeText={(v) => set('address_country', v)} />
                  <Input label="Irányítószám" value={form.address_postal_code} onChangeText={(v) => set('address_postal_code', v)} keyboardType="numeric" />
                  <Input label="Település" value={form.address_city} onChangeText={(v) => set('address_city', v)} />
                  <Input label="Utca, házszám" value={form.address_street} onChangeText={(v) => set('address_street', v)} />
                  <Input label="Emelet, ajtó, egyéb (opcionális)" value={form.address_extra} onChangeText={(v) => set('address_extra', v)} />
                </>
              )}

              {currentStep.key === 'shipping' && (
                <>
                  <TouchableOpacity
                    style={styles.sameCheckRow}
                    onPress={() => set('shipping_same', !form.shipping_same)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, form.shipping_same && styles.checkboxChecked]}>
                      {form.shipping_same && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                    <Text style={styles.sameCheckLabel}>Ugyanaz, mint a számlázási cím</Text>
                  </TouchableOpacity>

                  {!form.shipping_same && (
                    <>
                      <Input label="Ország" value={form.shipping_country} onChangeText={(v) => set('shipping_country', v)} />
                      <Input label="Irányítószám" value={form.shipping_postal_code} onChangeText={(v) => set('shipping_postal_code', v)} keyboardType="numeric" />
                      <Input label="Település" value={form.shipping_city} onChangeText={(v) => set('shipping_city', v)} />
                      <Input label="Utca, házszám" value={form.shipping_street} onChangeText={(v) => set('shipping_street', v)} />
                      <Input label="Emelet, ajtó, egyéb (opcionális)" value={form.shipping_extra} onChangeText={(v) => set('shipping_extra', v)} />
                    </>
                  )}
                </>
              )}
            </Animated.View>
          </ScrollView>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step > 0 ? (
              <Button
                label="Vissza"
                variant="secondary"
                onPress={handleBack}
                style={styles.backBtn}
              />
            ) : (
              <View style={styles.backBtn} />
            )}
            <Button
              label={isLast ? 'Kész' : 'Következő'}
              onPress={handleNext}
              loading={saving}
              style={styles.nextBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  progressWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  progressDotDone: {
    backgroundColor: Colors.accentTeal,
  },
  progressDotActive: {
    backgroundColor: Colors.accent,
  },
  header: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  stepLabel: {
    color: Colors.accent,
    fontWeight: Fonts.weights.semibold,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    gap: 10,
  },
  typeCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  typeEmoji: { fontSize: 36 },
  typeCardText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
  typeCardActiveText: { color: Colors.accent, fontSize: Fonts.sizes.sm },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  sameCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkMark: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  sameCheckLabel: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  backBtn: { flex: 1 },
  nextBtn: { flex: 2 },
});
