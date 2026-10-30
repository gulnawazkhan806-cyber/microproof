import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Code } from "../../components/Code";
import { authenticateOffer, parseMessage } from "../../lib/microproof/protocol";
import { acceptOffer, applyAccept } from "../../lib/microproof/store";
import { agreementTitle } from "../../lib/microproof/templates";
import type { Payload } from "../../lib/microproof/types";
import { colors } from "../../theme";
import { Button, Card, Muted, Screen, Title } from "../../ui";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ raw: string; payload: Payload } | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function onText(text: string) {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      const message = parseMessage(text);
      if (message.kind === "accept") {
        const agreement = await applyAccept(text);
        router.push({ pathname: "/record/[id]", params: { id: agreement.id } });
        return;
      }
      const authenticated = await authenticateOffer(text);
      setOffer({ raw: text, payload: authenticated.payload });
      setReply(null);
      setCameraOn(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that code.");
    } finally {
      lock.current = false;
    }
  }

  async function sign() {
    if (!offer) return;
    setBusy(true);
    setError(null);
    try {
      const result = await acceptOffer(offer.raw, "primary");
      setReply(result.responseText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <View style={styles.content}>
          <Title>{reply ? "Show your reply" : offer ? "Review the terms" : "Scan a code"}</Title>
          <Muted>
            {reply
              ? "They scan this reply to store your signature next to theirs."
              : offer
                ? "Signing locks your key to this exact digest."
                : "Read an offer to sign it, or a reply that seals a draft you started."}
          </Muted>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!offer && !reply ? (
            <>
              {cameraOn && permission?.granted ? (
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={({ data }) => void onText(data)}
                />
              ) : (
                <Card>
                  <Text style={styles.body}>Use the camera, or paste the code text if you are on a desk without one.</Text>
                </Card>
              )}
              <Button
                label={cameraOn ? "Stop camera" : "Use camera"}
                tone={cameraOn ? "ink" : "line"}
                onPress={() => {
                  if (!permission?.granted) {
                    void requestPermission();
                    return;
                  }
                  setCameraOn((on) => !on);
                }}
              />
              <TextInput
                value={paste}
                onChangeText={setPaste}
                placeholder='{"v":1'
                placeholderTextColor={colors.muted}
                multiline
                style={styles.input}
              />
              <Button label="Read pasted code" tone="line" onPress={() => void onText(paste)} />
            </>
          ) : null}
          {offer && !reply ? (
            <>
              <Card>
                <Text style={styles.body}>{agreementTitle(offer.payload)}</Text>
                <Text style={styles.meta}>
                  {offer.payload.initiator} → {offer.payload.counterparty}
                </Text>
              </Card>
              <Button label={busy ? "Signing…" : "Approve and sign"} disabled={busy} onPress={() => void sign()} />
            </>
          ) : null}
          {reply ? (
            <View style={styles.qr}>
              <Code text={reply} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: 20, gap: 12 },
  error: { color: colors.fault },
  camera: { flex: 1, minHeight: 240, borderRadius: 16, overflow: "hidden" },
  body: { color: colors.ink, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
  input: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sheet,
    padding: 12,
    color: colors.ink,
  },
  qr: { alignItems: "center" },
});
