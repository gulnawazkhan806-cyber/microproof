import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors } from "../theme";

export function Code({ text }: { text: string }) {
  return (
    <View style={styles.frame}>
      <QRCode value={text} size={220} color={colors.ink} backgroundColor={colors.sheet} ecl="M" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    backgroundColor: colors.sheet,
    padding: 16,
    borderRadius: 16,
  },
});
