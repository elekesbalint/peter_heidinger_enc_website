import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { env } from "../lib/env";
import { getMobileSummary, type MobileSummary } from "../lib/mobile-api";
import { supabase } from "../lib/supabase";

type HomeScreenProps = {
  session: Session;
};

function toAbsoluteUrl(path: string): string {
  return `${env.webBaseUrl.replace(/\/$/, "")}${path}`;
}

export function HomeScreen({ session }: HomeScreenProps) {
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [summary, setSummary] = useState<MobileSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingSummary(true);
    getMobileSummary(session)
      .then((data) => {
        if (!active) return;
        setSummary(data);
      })
      .catch((err) => {
        if (!active) return;
        setSummaryError(err instanceof Error ? err.message : "Failed to load summary.");
      })
      .finally(() => {
        if (!active) return;
        setLoadingSummary(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const totalBalanceEur = useMemo(() => {
    if (!summary) return 0;
    const totalHuf = summary.devices.reduce((sum, device) => sum + Number(device.balanceHuf ?? 0), 0);
    return Math.round((totalHuf / Math.max(1, summary.fxEurToHuf)) * 100) / 100;
  }, [summary]);

  async function openPath(path: string) {
    setLoadingPath(path);
    try {
      await WebBrowser.openBrowserAsync(toAbsoluteUrl(path));
    } finally {
      setLoadingPath(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.email}>{session.user.email}</Text>
      <Text style={styles.lead}>
        MVP mode: mobile auth is native, and checkout/account flows open your existing web system.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account snapshot</Text>
        {loadingSummary ? <Text style={styles.mutedText}>Loading...</Text> : null}
        {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
        {summary ? (
          <>
            <Text style={styles.metric}>
              Devices: <Text style={styles.metricValue}>{summary.devices.length}</Text>
            </Text>
            <Text style={styles.metric}>
              Total wallet: <Text style={styles.metricValue}>{totalBalanceEur.toLocaleString("hu-HU")} EUR</Text>
            </Text>
            <Text style={styles.metric}>
              Referrals sent: <Text style={styles.metricValue}>{summary.invites.length}</Text>
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>

        <ActionButton
          label="Open dashboard"
          loading={loadingPath === "/dashboard"}
          onPress={() => openPath("/dashboard")}
        />
        <ActionButton
          label="Order ENC device"
          loading={loadingPath === "/order"}
          onPress={() => openPath("/order")}
        />
        <ActionButton
          label="Open topup"
          loading={loadingPath === "/topup"}
          onPress={() => openPath("/topup")}
        />
        <ActionButton
          label="Open referrals"
          loading={loadingPath === "/dashboard#referral"}
          onPress={() => openPath("/dashboard#referral")}
        />
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

function ActionButton({
  label,
  loading,
  onPress,
}: {
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress} disabled={loading}>
      <Text style={styles.actionBtnText}>{loading ? "Opening..." : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
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
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
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
});

