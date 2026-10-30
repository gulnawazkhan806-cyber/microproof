import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { bootstrap } from "../lib/microproof/store";
import { colors } from "../theme";

export default function RootLayout() {
  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="offer/[id]" />
        <Stack.Screen name="bench/[id]" />
        <Stack.Screen name="record/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
