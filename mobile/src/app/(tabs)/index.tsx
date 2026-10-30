import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fingerprint } from "../../lib/microproof/crypto";
import { readPayload } from "../../lib/microproof/protocol";
import { useDb } from "../../lib/microproof/store";
import { TEMPLATES, agreementTitle, getTemplate, partyLines } from "../../lib/microproof/templates";
import type { Agreement, TemplateType } from "../../lib/microproof/types";
import { colors } from "../../theme";
import { Muted, Screen, Title } from "../../ui";

const STATUS: Record<Agreement["status"], string> = {
  DRAFT: "Waiting",
  SIGNED: "Sealed",
  DISPUTED: "Disputed",
  RESOLVED: "Resolved",
};

function summary(agreement: Agreement) {
  try {
    const payload = readPayload(agreement.payload_json);
    const parties = partyLines(payload);
    return {
      title: agreementTitle(payload),
      kind: getTemplate(payload.template).name,
      parties: `${parties[0]?.name ?? ""} → ${parties[1]?.name ?? ""}`,
    };
  } catch {
    return { title: "Unreadable record", kind: agreement.template_type, parties: "Tamper check failed" };
  }
}

export default function LedgerScreen() {
  const db = useDb();
  const fp = db.identity ? fingerprint(db.identity.publicKey) : "···· ····";

  return (
    <Screen>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.top}>
            <Text style={styles.brand}>MicroProof</Text>
            <Text style={styles.fp}>{fp}</Text>
          </View>
          <Title>Ledger</Title>
          <Muted>Signed records stay on this phone. Nothing is uploaded.</Muted>
          {!db.ready ? <Text style={styles.wait}>Reading this phone…</Text> : null}
          {db.ready && db.agreements.length === 0 ? (
            <View style={styles.block}>
              <Text style={styles.h2}>Nothing filed yet</Text>
              <Muted>Write the terms, they sign your code, you scan their reply.</Muted>
              {(Object.keys(TEMPLATES) as TemplateType[]).map((id) => {
                const spec = TEMPLATES[id];
                return (
                  <Link key={id} href={{ pathname: "/new", params: { template: id, example: "1" } }} asChild>
                    <Pressable style={styles.row}>
                      <Text style={styles.index}>{spec.index}</Text>
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle}>{spec.name}</Text>
                        <Text style={styles.rowBody}>{spec.blurb}</Text>
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          ) : null}
          {db.ready && db.agreements.length > 0
            ? db.agreements.map((agreement) => {
                const item = summary(agreement);
                return (
                  <Link key={agreement.id} href={{ pathname: "/record/[id]", params: { id: agreement.id } }} asChild>
                    <Pressable style={styles.row}>
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Text style={styles.rowBody}>
                          {item.kind} · {item.parties}
                        </Text>
                      </View>
                      <Text style={styles.status}>{STATUS[agreement.status]}</Text>
                    </Pressable>
                  </Link>
                );
              })
            : null}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 20, color: colors.ink, fontWeight: "600" },
  fp: { color: colors.ink, fontWeight: "700", letterSpacing: 0.4 },
  wait: { color: colors.muted, marginTop: 12 },
  block: { gap: 8, marginTop: 8 },
  h2: { fontSize: 24, color: colors.ink, fontWeight: "600" },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.sheet,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  index: { color: colors.brass, fontSize: 18, width: 32 },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  rowBody: { color: colors.muted, marginTop: 2 },
  status: { color: colors.seal, fontWeight: "700" },
});
