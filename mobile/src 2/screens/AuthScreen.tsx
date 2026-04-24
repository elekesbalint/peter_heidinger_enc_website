import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { postJson } from "../lib/api";
import { supabase } from "../lib/supabase";

type AuthMode = "login" | "register";

type ReferralAttachResponse = {
  ok: boolean;
  error?: string;
};

function formatAuthError(message: string): string {
  const text = message.toLowerCase();
  if (
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("email rate limit")
  ) {
    return "Túl sok regisztrációs próbálkozás történt. Kérlek, próbáld újra később.";
  }
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralToken, setReferralToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAuth() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedReferral = referralToken.trim();

    try {
      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (loginError) {
          throw loginError;
        }
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (signUpError) {
        throw signUpError;
      }

      if (normalizedReferral && data.user?.id) {
        await postJson<ReferralAttachResponse>("/api/referrals/attach", {
          token: normalizedReferral,
          user_id: data.user.id,
          email: normalizedEmail,
        }).catch(() => {
          // Keep registration flow non-blocking if referral attach fails.
        });
      }

      if (!data.session) {
        setSuccess("Fiók létrehozva. Erősítsd meg e-mailben, majd jelentkezz be.");
      } else {
        setSuccess("Sikeres regisztráció.");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ismeretlen hitelesítési hiba.";
      setError(formatAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>AdriaGo Mobile</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Jelentkezz be a fiókodba." : "Hozd létre a fiókodat ENC szolgáltatáshoz."}
        </Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, mode === "login" && styles.toggleBtnActive]}
            onPress={() => setMode("login")}
          >
            <Text style={[styles.toggleText, mode === "login" && styles.toggleTextActive]}>Belépés</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === "register" && styles.toggleBtnActive]}
            onPress={() => setMode("register")}
          >
            <Text style={[styles.toggleText, mode === "register" && styles.toggleTextActive]}>
              Regisztráció
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="te@pelda.hu"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Jelszó"
          style={styles.input}
        />
        {mode === "register" && (
          <TextInput
            value={referralToken}
            onChangeText={setReferralToken}
            autoCapitalize="none"
            placeholder="Ajánlói token (opcionális)"
            style={styles.input}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable style={styles.actionBtn} onPress={handleAuth} disabled={loading}>
          <Text style={styles.actionBtnText}>
            {loading ? "Kérlek várj..." : mode === "login" ? "Belépés" : "Fiók létrehozása"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
  },
  toggleRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    overflow: "hidden",
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#2563eb",
  },
  toggleText: {
    color: "#334155",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  actionBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    fontSize: 13,
  },
  success: {
    color: "#166534",
    fontSize: 13,
  },
});

