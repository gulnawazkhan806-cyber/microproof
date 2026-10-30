import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDraft } from "../../lib/microproof/store";
import { TEMPLATES, exampleFor } from "../../lib/microproof/templates";
import { TEMPLATE_TYPES, isTemplate, type TemplateType } from "../../lib/microproof/types";
import { colors } from "../../theme";
import { Button, Muted, Screen, Title } from "../../ui";

export default function NewScreen() {
  const params = useLocalSearchParams<{ template?: string; example?: string }>();
  const initial = isTemplate(params.template) ? params.template : "ITEM_BORROW";
  const [template, setTemplate] = useState<TemplateType>(initial);
  const spec = TEMPLATES[template];
  const starter = useMemo(() => (params.example === "1" ? exampleFor(initial) : null), [params.example, initial]);
  const [initiator, setInitiator] = useState(starter?.initiator ?? "");
  const [counterparty, setCounterparty] = useState(starter?.counterparty ?? "");
  const [fields, setFields] = useState<Record<string, string>>(starter?.fields ?? { yourRole: spec.fields[0]?.options?.[0] ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function choose(next: TemplateType) {
    const example = exampleFor(next);
    setTemplate(next);
    setInitiator(example.initiator);
    setCounterparty(example.counterparty);
    setFields(example.fields);
  }

  async function seal() {
    setError(null);
    const missing = spec.fields.filter((field) => field.required && !(fields[field.key] ?? "").trim());
    if (!initiator.trim() || !counterparty.trim() || missing.length > 0) {
      setError("Name both people and fill the required lines.");
      return;
    }
    setBusy(true);
    try {
      const agreement = await createDraft({
        template,
        initiator,
        counterparty,
        fields,
        photos: [],
        gps: null,
      });
      router.push({ pathname: "/offer/[id]", params: { id: agreement.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign this draft.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title>New agreement</Title>
          <Muted>{spec.blurb}</Muted>
          <View style={styles.choices}>
            {TEMPLATE_TYPES.map((id) => (
              <Pressable key={id} onPress={() => choose(id)} style={[styles.chip, template === id && styles.chipOn]}>
                <Text style={[styles.chipText, template === id && styles.chipTextOn]}>{TEMPLATES[id].name}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Your name" value={initiator} onChangeText={setInitiator} />
          <Field label="Their name" value={counterparty} onChangeText={setCounterparty} />
          {spec.fields.map((field) =>
            field.kind === "select" && field.options ? (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <View style={styles.choices}>
                  {field.options.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setFields((current) => ({ ...current, [field.key]: option }))}
                      style={[styles.chip, fields[field.key] === option && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, fields[field.key] === option && styles.chipTextOn]}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Field
                key={field.key}
                label={field.label}
                value={fields[field.key] ?? ""}
                placeholder={field.placeholder}
                multiline={field.kind === "textarea"}
                onChangeText={(value) => setFields((current) => ({ ...current, [field.key]: value }))}
              />
            ),
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={busy ? "Signing…" : "Sign and show code"} disabled={busy} onPress={() => void seal()} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, multiline && styles.area]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.sheet, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: "600" },
  chipTextOn: { color: colors.paper },
  field: { gap: 6 },
  label: { color: colors.ink, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sheet,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 16,
  },
  area: { minHeight: 96, textAlignVertical: "top", paddingVertical: 10 },
  error: { color: colors.fault },
});
