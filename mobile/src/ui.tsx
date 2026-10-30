import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "./theme";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Title({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label,
  tone = "seal",
  onPress,
  disabled,
}: {
  label: string;
  tone?: "seal" | "ink" | "line" | "fault";
  onPress?: PressableProps["onPress"];
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "seal" && styles.seal,
        tone === "ink" && styles.ink,
        tone === "line" && styles.line,
        tone === "fault" && styles.fault,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, tone === "line" ? styles.inkText : styles.lightText]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 32, lineHeight: 38, color: colors.ink, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 6 },
  button: { minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  seal: { backgroundColor: colors.seal },
  ink: { backgroundColor: colors.ink },
  line: { backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.line },
  fault: { backgroundColor: colors.fault },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  lightText: { color: colors.sealInk },
  inkText: { color: colors.ink },
  card: { backgroundColor: colors.sheet, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 },
});
