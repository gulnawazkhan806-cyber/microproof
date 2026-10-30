import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Code } from "../../components/Code";
import { offerText } from "../../lib/microproof/protocol";
import { useDb } from "../../lib/microproof/store";
import { colors } from "../../theme";
import { Button, Muted, Screen, Title } from "../../ui";

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agreement = useDb().agreements.find((item) => item.id === id);

  return (
    <Screen>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <Button label="Back to ledger" tone="line" onPress={() => router.back()} />
          {!agreement ? (
            <>
              <Title>Not on this phone</Title>
              <Muted>This offer is not stored here.</Muted>
            </>
          ) : (
            <>
              <Title>Show this code</Title>
              <Muted>The other phone reads this picture, then shows a reply for you to scan.</Muted>
              <Code text={offerText(agreement)} />
              <Text style={styles.hash}>{agreement.sha256_hash.slice(0, 16)}…</Text>
              <Button
                label="Their phone is on this desk"
                onPress={() => router.push({ pathname: "/bench/[id]", params: { id: agreement.id } })}
              />
              <Button label="Open the record" tone="line" onPress={() => router.push({ pathname: "/record/[id]", params: { id: agreement.id } })} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  hash: { textAlign: "center", color: colors.muted, fontVariant: ["tabular-nums"] },
});
