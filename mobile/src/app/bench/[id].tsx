import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Code } from "../../components/Code";
import { fingerprint } from "../../lib/microproof/crypto";
import { offerText } from "../../lib/microproof/protocol";
import { acceptOffer, applyAccept, useDb } from "../../lib/microproof/store";
import { colors } from "../../theme";
import { Button, Card, Muted, Screen, Title } from "../../ui";

export default function BenchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const agreement = db.agreements.find((item) => item.id === id);
  const [phone, setPhone] = useState<"a" | "b">("a");
  const [phase, setPhase] = useState<"idle" | "review" | "reply">("idle");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const benchKey = db.benchIdentity ? fingerprint(db.benchIdentity.publicKey) : "created on first accept";

  async function readOffer() {
    if (!agreement) return;
    setBusy(true);
    setError(null);
    try {
      const text = offerText(agreement);
      const result = await acceptOffer(text, "bench");
      setReply(result.responseText);
      setPhase("reply");
      setPhone("b");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign on the second phone.");
    } finally {
      setBusy(false);
    }
  }

  async function readReply() {
    if (!reply) return;
    setBusy(true);
    setError(null);
    try {
      await applyAccept(reply);
      setPhase("reply");
      setPhone("a");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not store the reply.");
    } finally {
      setBusy(false);
    }
  }

  const sealed = agreement?.status === "SIGNED" || agreement?.sig_party_b;

  return (
    <Screen>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <Button label="Back" tone="line" onPress={() => router.back()} />
          <Title>Two phones, one desk</Title>
          <Muted>The other phone has its own key ({benchKey}), kept on this device so you can rehearse both signatures.</Muted>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.switch}>
            <Button label="Your phone" tone={phone === "a" ? "ink" : "line"} onPress={() => setPhone("a")} />
            <Button label="Their phone" tone={phone === "b" ? "ink" : "line"} onPress={() => setPhone("b")} />
          </View>
          {phone === "a" && agreement ? (
            <Card>
              <Text style={styles.kicker}>Your phone</Text>
              {sealed ? (
                <>
                  <Text style={styles.h2}>Sealed on your phone</Text>
                  <Button label="Open the certificate" onPress={() => router.push({ pathname: "/record/[id]", params: { id: agreement.id } })} />
                </>
              ) : (
                <>
                  <Muted>This is the offer, already signed with your key.</Muted>
                  <Code text={offerText(agreement)} />
                  {reply ? (
                    <Button label={busy ? "Storing…" : "Scan their reply"} disabled={busy} onPress={() => void readReply()} />
                  ) : (
                    <Muted>Switch to their phone and accept the code.</Muted>
                  )}
                </>
              )}
            </Card>
          ) : null}
          {phone === "b" && agreement ? (
            <Card>
              <Text style={styles.kicker}>Their phone</Text>
              {phase === "idle" ? (
                <Button label={busy ? "Reading…" : "Read the code on your phone"} disabled={busy} onPress={() => void readOffer()} />
              ) : null}
              {phase === "reply" && reply ? (
                <>
                  <Text style={styles.h2}>Signed</Text>
                  <Muted>Show this reply. Your phone stores it beside the offer.</Muted>
                  <Code text={reply} />
                </>
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  error: { color: colors.fault },
  switch: { flexDirection: "row", gap: 8 },
  kicker: { color: colors.muted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", fontSize: 12 },
  h2: { fontSize: 24, color: colors.ink, fontWeight: "600" },
});
