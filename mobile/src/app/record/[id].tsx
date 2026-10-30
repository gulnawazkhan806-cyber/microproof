import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fingerprint, groupHex } from "../../lib/microproof/crypto";
import { inspect, readPayload, type Integrity } from "../../lib/microproof/protocol";
import { setStatus, useDb } from "../../lib/microproof/store";
import { agreementTitle, fieldRows, partyLines } from "../../lib/microproof/templates";
import { colors } from "../../theme";
import { Button, Card, Muted, Screen, Title } from "../../ui";

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agreement = useDb().agreements.find((item) => item.id === id);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);

  useEffect(() => {
    if (!agreement) return;
    let live = true;
    void inspect(agreement).then((result) => {
      if (live) setIntegrity(result);
    });
    return () => {
      live = false;
    };
  }, [agreement]);

  if (!agreement) {
    return (
      <Screen>
        <SafeAreaView style={styles.content}>
          <Title>Not on this phone</Title>
          <Button label="Back" tone="line" onPress={() => router.back()} />
        </SafeAreaView>
      </Screen>
    );
  }

  let body = "The stored terms could not be read.";
  let rows: { label: string; value: string }[] = [];
  let parties = "";
  try {
    const payload = readPayload(agreement.payload_json);
    body = agreementTitle(payload);
    rows = fieldRows(payload);
    const names = partyLines(payload);
    parties = `${names[0]?.role ?? ""} ${names[0]?.name ?? ""} → ${names[1]?.role ?? ""} ${names[1]?.name ?? ""}`;
  } catch {
    body = "Unreadable record";
  }

  const state = integrity?.state === "sealed" ? "Both signatures check out" : integrity?.state === "waiting" ? "Waiting for the second signature" : integrity ? "Check failed" : "Checking…";

  return (
    <Screen>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <Button label="Back" tone="line" onPress={() => router.back()} />
          <Title>{body}</Title>
          <Muted>{parties}</Muted>
          <Card>
            <Text style={styles.label}>{state}</Text>
            <Text style={styles.hash}>{groupHex(agreement.sha256_hash)}</Text>
            <Text style={styles.meta}>Initiator {fingerprint(agreement.pub_party_a)}</Text>
            <Text style={styles.meta}>Counterparty {agreement.pub_party_b ? fingerprint(agreement.pub_party_b) : "not signed"}</Text>
          </Card>
          {rows.map((row) => (
            <Card key={row.label}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{row.value}</Text>
            </Card>
          ))}
          {agreement.status === "DRAFT" ? (
            <Button label="Show the offer code" onPress={() => router.push({ pathname: "/offer/[id]", params: { id: agreement.id } })} />
          ) : null}
          {agreement.status === "SIGNED" || agreement.status === "RESOLVED" ? (
            <Button label="Flag a dispute" tone="line" onPress={() => void setStatus(agreement.id, "DISPUTED")} />
          ) : null}
          {agreement.status === "DISPUTED" ? (
            <Button label="Mark resolved" onPress={() => void setStatus(agreement.id, "RESOLVED")} />
          ) : null}
          <Button
            label="Share the record"
            tone="line"
            onPress={() =>
              void Share.share({
                message: `${body}\n${parties}\n${state}\n${agreement.sha256_hash}`,
              })
            }
          />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  label: { color: colors.muted, fontWeight: "600" },
  value: { color: colors.ink, fontSize: 16, marginTop: 4 },
  hash: { color: colors.ink, marginTop: 8, fontVariant: ["tabular-nums"] },
  meta: { color: colors.ink, marginTop: 6 },
});
