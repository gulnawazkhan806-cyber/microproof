import { Tabs } from "expo-router";
import { colors } from "../../theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.seal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.sheet,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ledger" }} />
      <Tabs.Screen name="new" options={{ title: "New" }} />
      <Tabs.Screen name="scan" options={{ title: "Scan" }} />
      <Tabs.Screen name="key" options={{ title: "Key" }} />
    </Tabs>
  );
}
