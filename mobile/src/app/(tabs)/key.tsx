import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fingerprint } from "../../lib/microproof/crypto";
import { replaceIdentity, useDb } from "../../lib/microproof/store";
import { colors } from "../../theme";
import { Button, Card, Muted, Screen, Title } from "../../ui";

export default function KeyScreen() {
  const db = useDb();
  const fp = db.identity ? fingerprint(db.identity.publicKey) : "···· ····";
  const bench = db.benchIdentity ? fingerprint(db.benchIdentity.publicKey) : "Created when you rehearse a second phone";

  return (
    <Screen>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Title>Your key</Title>
          <Muted>This Ed25519 key stays in the phone keystore. It is not uploaded.</Muted>
          <Card>
            <Text style={styles.label}>Fingerprint</Text>
            <Text style={styles.fp}>{fp}</Text>
          </Card>
          <Card>
            <Text style={styles.label}>Bench phone</Text>
            <Text style={styles.body}>{bench}</Text>
          </Card>
          <Button label="Replace this key" tone="fault" onPress={() => void replaceIdentity()} />
          <Muted>Replacing the key does not rewrite records already signed.</Muted>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  fp: { color: colors.ink, fontSize: 28, fontWeight: "700", marginTop: 6, letterSpacing: 0.6 },
  body: { color: colors.ink, fontSize: 16, marginTop: 6 },
});
