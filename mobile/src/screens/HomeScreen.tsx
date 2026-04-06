import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import {
  createMobileDeviceCheckout,
  createMobileTopupCheckout,
  getMobileSummary,
  sendMobileContactMessage,
  sendMobileReferralInvite,
  type MobileSummary,
} from "../lib/mobile-api";
import { supabase } from "../lib/supabase";

type HomeScreenProps = {
  session: Session;
};

type AppTab = "home" | "order" | "topup" | "contact" | "account";

export function HomeScreen({ session }: HomeScreenProps) {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [summary, setSummary] = useState<MobileSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [orderCategory, setOrderCategory] = useState<"ia" | "i" | "ii" | "iii" | "iv">("i");
  const [orderLicensePlate, setOrderLicensePlate] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [topupDeviceIdentifier, setTopupDeviceIdentifier] = useState("");
  const [topupDestination, setTopupDestination] = useState("");
  const [topupAmountEur, setTopupAmountEur] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState(session.user.email ?? "");
  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);

  async function refreshSummary() {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await getMobileSummary(session);
      setSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Nem sikerült betölteni az összegzést.");
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    let active = true;
    refreshSummary().catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!summary?.devices?.length) return;
    if (!topupDeviceIdentifier) {
      setTopupDeviceIdentifier(summary.devices[0].identifier);
    }
  }, [summary, topupDeviceIdentifier]);

  const totalBalanceEur = useMemo(() => {
    if (!summary) return 0;
    const totalHuf = summary.devices.reduce((sum, device) => sum + Number(device.balanceHuf ?? 0), 0);
    return Math.round((totalHuf / Math.max(1, summary.fxEurToHuf)) * 100) / 100;
  }, [summary]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleInviteSend() {
    setInviteError(null);
    setInviteMessage(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setInviteError("Adj meg érvényes e-mail címet.");
      return;
    }
    setInviteLoading(true);
    try {
      await sendMobileReferralInvite(session, email);
      setInviteMessage("Meghívó sikeresen elküldve.");
      setInviteEmail("");
      await refreshSummary();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Nem sikerült elküldeni a meghívót.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleDeviceOrder() {
    setOrderError(null);
    setOrderMessage(null);
    const plate = orderLicensePlate.trim().toUpperCase().replace(/\s+/g, "");
    if (plate.length < 5 || plate.length > 12) {
      setOrderError("A rendszám 5-12 karakter legyen.");
      return;
    }
    setOrderLoading(true);
    try {
      const result = await createMobileDeviceCheckout(session, {
        category: orderCategory,
        licensePlate: plate,
        contractAccepted: true,
      });
      if (result.waitlist) {
        setOrderMessage(result.message ?? "Nincs szabad készülék; várólistára kerültél.");
        return;
      }
      if (!result.url) {
        setOrderError("Nem érkezett Stripe checkout URL.");
        return;
      }
      await WebBrowser.openBrowserAsync(result.url);
      setOrderMessage("Stripe fizetés megnyitva.");
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "A rendelési checkout indítása sikertelen.");
    } finally {
      setOrderLoading(false);
    }
  }

  async function handleTopupCheckout() {
    setTopupError(null);
    const amount = Number(topupAmountEur);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopupError("Adj meg érvényes EUR összeget.");
      return;
    }
    if (!topupDeviceIdentifier.trim()) {
      setTopupError("Készülék azonosító megadása kötelező.");
      return;
    }
    if (topupDestination.trim().length < 2) {
      setTopupError("Úticél megadása kötelező.");
      return;
    }
    setTopupLoading(true);
    try {
      const { url } = await createMobileTopupCheckout(session, {
        topupAmountEur: amount,
        selectedPackageEur: null,
        deviceIdentifier: topupDeviceIdentifier.trim(),
        travelDestination: topupDestination.trim(),
      });
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : "A feltöltési checkout indítása sikertelen.");
    } finally {
      setTopupLoading(false);
    }
  }

  async function handleContactSend() {
    setContactError(null);
    setContactSuccess(null);
    const name = contactName.trim();
    const email = contactEmail.trim().toLowerCase();
    const message = contactMessage.trim();
    if (name.length < 2 || email.length < 5 || message.length < 10) {
      setContactError("Töltsd ki a nevet, e-mailt és legalább 10 karakteres üzenetet.");
      return;
    }
    setContactLoading(true);
    try {
      await sendMobileContactMessage({ name, email, message });
      setContactSuccess("Üzenet elküldve. Hamarosan jelentkezünk.");
      setContactMessage("");
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Üzenetküldési hiba.");
    } finally {
      setContactLoading(false);
    }
  }

  function renderHomeTab() {
    return (
      <>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>AdriaGo</Text>
          <Text style={styles.heroTitle}>Utazz saját készülékkel</Text>
          <Text style={styles.heroSubtitle}>
            Vásárolj ENC-t a horvát autópályára, kezeld az egyenleget és a teljes útdíjfolyamatot mobilról.
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryBtn} onPress={() => setActiveTab("order")}>
              <Text style={styles.primaryBtnText}>Eszközrendelés</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtnWide} onPress={() => setActiveTab("topup")}>
              <Text style={styles.secondaryBtnWideText}>Egyenlegfeltöltés</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Így működik az AdriaGo</Text>
          {[
            "1. Regisztráció és profil kitöltése",
            "2. ENC készülék rendelés",
            "3. Egyenleg feltöltése",
            "4. Utazás és követés",
          ].map((item) => (
            <Text key={item} style={styles.listBullet}>
              {item}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Miért jó ez?</Text>
          {[
            "Biztonságos Stripe fizetés",
            "Eszköz- és wallet kezelés egy helyen",
            "Ajánlói induló egyenleg rendszer",
            "Magyar nyelvű ügyintézés",
          ].map((item) => (
            <Text key={item} style={styles.listBullet}>
              • {item}
            </Text>
          ))}
        </View>
      </>
    );
  }

  function renderOrderTab() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ENC készülék rendelés</Text>
        <Text style={styles.mutedText}>Válassz kategóriát, add meg a rendszámot, majd fizess Stripe-on.</Text>
        <View style={styles.segmentRow}>
          {(["ia", "i", "ii", "iii", "iv"] as const).map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setOrderCategory(cat)}
              style={[styles.segmentBtn, orderCategory === cat && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentBtnText, orderCategory === cat && styles.segmentBtnTextActive]}>
                {cat.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={orderLicensePlate}
          onChangeText={setOrderLicensePlate}
          autoCapitalize="characters"
          placeholder="Rendszám (pl. ABC123)"
          style={styles.input}
        />
        <Pressable style={styles.actionBtn} onPress={handleDeviceOrder} disabled={orderLoading}>
          <Text style={styles.actionBtnText}>{orderLoading ? "Feldolgozás..." : "Tovább a Stripe fizetéshez"}</Text>
        </Pressable>
        {orderError ? <Text style={styles.errorText}>{orderError}</Text> : null}
        {orderMessage ? <Text style={styles.successText}>{orderMessage}</Text> : null}
      </View>
    );
  }

  function renderTopupTab() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Egyenlegfeltöltés</Text>
        <Text style={styles.mutedText}>Eszköz + úticél + összeg, majd Stripe fizetés.</Text>
        <TextInput
          value={topupDeviceIdentifier}
          onChangeText={setTopupDeviceIdentifier}
          placeholder="Készülék azonosító"
          style={styles.input}
        />
        <TextInput
          value={topupDestination}
          onChangeText={setTopupDestination}
          placeholder="Úticél (ország/régió)"
          style={styles.input}
        />
        <TextInput
          value={topupAmountEur}
          onChangeText={setTopupAmountEur}
          keyboardType="decimal-pad"
          placeholder="Feltöltés összege (EUR)"
          style={styles.input}
        />
        <View style={styles.segmentRow}>
          {[40, 60, 100].map((value) => (
            <Pressable key={value} style={styles.quickAmountBtn} onPress={() => setTopupAmountEur(String(value))}>
              <Text style={styles.quickAmountText}>{value} EUR</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.actionBtn} onPress={handleTopupCheckout} disabled={topupLoading}>
          <Text style={styles.actionBtnText}>{topupLoading ? "Feldolgozás..." : "Feltöltés indítása"}</Text>
        </Pressable>
        {topupError ? <Text style={styles.errorText}>{topupError}</Text> : null}
      </View>
    );
  }

  function renderContactTab() {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kapcsolat</Text>
        <Text style={styles.mutedText}>Kérdésed van? Írj nekünk, eltároljuk és válaszolunk.</Text>
        <TextInput value={contactName} onChangeText={setContactName} placeholder="Név" style={styles.input} />
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="E-mail cím"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={contactMessage}
          onChangeText={setContactMessage}
          placeholder="Üzenet"
          multiline
          style={[styles.input, styles.textArea]}
        />
        <Pressable style={styles.actionBtn} onPress={handleContactSend} disabled={contactLoading}>
          <Text style={styles.actionBtnText}>{contactLoading ? "Küldés..." : "Üzenet küldése"}</Text>
        </Pressable>
        {contactError ? <Text style={styles.errorText}>{contactError}</Text> : null}
        {contactSuccess ? <Text style={styles.successText}>{contactSuccess}</Text> : null}
      </View>
    );
  }

  function renderAccountTab() {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fiókom</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          {loadingSummary ? <Text style={styles.mutedText}>Betöltés...</Text> : null}
          {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
          {summary ? (
            <>
              <Text style={styles.metric}>
                Készülékek: <Text style={styles.metricValue}>{summary.devices.length}</Text>
              </Text>
              <Text style={styles.metric}>
                Összes egyenleg: <Text style={styles.metricValue}>{totalBalanceEur.toLocaleString("hu-HU")} EUR</Text>
              </Text>
              <Text style={styles.metric}>
                Meghívók: <Text style={styles.metricValue}>{summary.invites.length}</Text>
              </Text>
              <Pressable style={styles.secondaryBtn} onPress={refreshSummary}>
                <Text style={styles.secondaryBtnText}>Frissítés</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {summary?.devices?.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Saját készülékek</Text>
            {summary.devices.map((device) => {
              const balanceEur = Math.round((Number(device.balanceHuf ?? 0) / summary.fxEurToHuf) * 100) / 100;
              return (
                <View key={device.identifier} style={styles.listRow}>
                  <Text style={styles.rowTitle}>{device.identifier}</Text>
                  <Text style={styles.rowMeta}>
                    {device.category.toUpperCase()} · {device.status}
                  </Text>
                  <Text style={styles.rowMeta}>Egyenleg: {balanceEur.toLocaleString("hu-HU")} EUR</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ajánlás</Text>
          <Text style={styles.mutedText}>
            Induló egyenleg plafon: {summary?.referralWalletBonusCapHuf?.toLocaleString("hu-HU") ?? 0} HUF
          </Text>
          <TextInput
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="meghivott@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <Pressable style={styles.actionBtn} onPress={handleInviteSend} disabled={inviteLoading}>
            <Text style={styles.actionBtnText}>{inviteLoading ? "Küldés..." : "Meghívó küldése"}</Text>
          </Pressable>
          {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
          {inviteMessage ? <Text style={styles.successText}>{inviteMessage}</Text> : null}
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Kijelentkezés</Text>
        </Pressable>
      </>
    );
  }

  function renderActiveTab() {
    if (activeTab === "home") return renderHomeTab();
    if (activeTab === "order") return renderOrderTab();
    if (activeTab === "topup") return renderTopupTab();
    if (activeTab === "contact") return renderContactTab();
    return renderAccountTab();
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>{renderActiveTab()}</ScrollView>
      <View style={styles.tabBar}>
        <BottomTab label="Főoldal" active={activeTab === "home"} onPress={() => setActiveTab("home")} />
        <BottomTab label="Rendelés" active={activeTab === "order"} onPress={() => setActiveTab("order")} />
        <BottomTab label="Feltöltés" active={activeTab === "topup"} onPress={() => setActiveTab("topup")} />
        <BottomTab label="Kapcsolat" active={activeTab === "contact"} onPress={() => setActiveTab("contact")} />
        <BottomTab label="Fiókom" active={activeTab === "account"} onPress={() => setActiveTab("account")} />
      </View>
    </View>
  );
}

function BottomTab({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active: boolean;
}) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f8fc",
  },
  container: {
    padding: 20,
    paddingBottom: 96,
    gap: 16,
  },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  heroEyebrow: {
    color: "#93c5fd",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#dbeafe",
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryBtnWide: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#60a5fa",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#111827",
  },
  secondaryBtnWideText: {
    color: "#dbeafe",
    fontWeight: "700",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  email: {
    fontSize: 14,
    color: "#334155",
  },
  lead: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  mutedText: {
    color: "#64748b",
  },
  errorText: {
    color: "#b91c1c",
  },
  successText: {
    color: "#166534",
  },
  metric: {
    color: "#334155",
  },
  metricValue: {
    fontWeight: "700",
    color: "#0f172a",
  },
  actionBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  secondaryBtnText: {
    color: "#334155",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  listRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    gap: 2,
  },
  rowTitle: {
    color: "#0f172a",
    fontWeight: "600",
  },
  rowMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  segmentBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  segmentBtnActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  segmentBtnText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  segmentBtnTextActive: {
    color: "#fff",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  quickAmountBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  quickAmountText: {
    color: "#1e293b",
    fontWeight: "600",
    fontSize: 12,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  logoutText: {
    color: "#334155",
    fontWeight: "600",
  },
  listBullet: {
    color: "#334155",
    lineHeight: 20,
  },
  tabBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    flexDirection: "row",
    padding: 6,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#2563eb",
  },
  tabBtnText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  tabBtnTextActive: {
    color: "#fff",
  },
});

