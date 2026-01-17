import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Language } from "@/i18n";

export default function LanguageSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { setLanguage, t } = useApp();

  const handleLanguageSelect = async (lang: Language) => {
    await setLanguage(lang);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.icon}
            contentFit="contain"
          />
          <ThemedText type="h2" style={styles.title}>
            {t.languageSelection.title}
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t.languageSelection.subtitle}
          </ThemedText>
        </View>

        <View style={styles.languages}>
          <Pressable
            style={({ pressed }) => [
              styles.languageCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => handleLanguageSelect("en")}
          >
            <View style={styles.languageContent}>
              <ThemedText type="h4">English</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Left-to-Right
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={24} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.languageCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => handleLanguageSelect("he")}
          >
            <View style={styles.languageContent}>
              <ThemedText type="h4">עברית</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Right-to-Left
              </ThemedText>
            </View>
            <Feather name="chevron-left" size={24} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  icon: {
    width: 100,
    height: 100,
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
  },
  languages: {
    gap: Spacing.lg,
  },
  languageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  languageContent: {
    gap: Spacing.xs,
  },
});
