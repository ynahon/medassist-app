import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp, Gender } from "@/contexts/AppContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { Feather } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Demographics">;

const GENDER_OPTIONS: { value: Gender; labelKey: keyof typeof genderLabels }[] = [
  { value: "male", labelKey: "genderMale" },
  { value: "female", labelKey: "genderFemale" },
  { value: "other", labelKey: "genderOther" },
  { value: "preferNot", labelKey: "genderPreferNot" },
];

const genderLabels = {
  genderMale: true,
  genderFemale: true,
  genderOther: true,
  genderPreferNot: true,
};

export default function DemographicsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t, isRTL, updateUserDemographics, setOnboardingComplete } = useApp();
  const navigation = useNavigation<NavigationProp>();

  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const maxDate = new Date();
  const minDate = new Date(1900, 0, 1);

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setDateOfBirth(selectedDate);
    }
    if (Platform.OS === "ios" && event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await updateUserDemographics({
        dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : undefined,
        gender: gender,
      });
      await setOnboardingComplete(true);
      navigation.reset({
        index: 0,
        routes: [{ name: "Survey", params: { isOnboarding: true } }],
      });
    } catch (error) {
      console.error("Error saving demographics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await setOnboardingComplete(true);
      navigation.reset({
        index: 0,
        routes: [{ name: "Survey", params: { isOnboarding: true } }],
      });
    } catch (error) {
      console.error("Error skipping demographics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.header}>
          <ThemedText style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
            {t.demographics.title}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: theme.textSecondary, textAlign: isRTL ? "right" : "left" }]}
          >
            {t.demographics.subtitle}
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
              {t.demographics.dateOfBirthLabel}
            </ThemedText>
            <Pressable
              style={[
                styles.dateButton,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText
                style={[
                  styles.dateButtonText,
                  !dateOfBirth && { color: theme.textSecondary },
                ]}
              >
                {dateOfBirth ? formatDate(dateOfBirth) : t.demographics.dateOfBirthPlaceholder}
              </ThemedText>
              <Feather name="calendar" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {showDatePicker && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={dateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                maximumDate={maxDate}
                minimumDate={minDate}
              />
              {Platform.OS === "ios" && (
                <Button
                  onPress={() => setShowDatePicker(false)}
                  style={styles.doneButton}
                >
                  Done
                </Button>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={[styles.labelRow, isRTL && styles.labelRowRTL]}>
              <ThemedText style={styles.label}>{t.demographics.genderLabel}</ThemedText>
              <ThemedText style={[styles.optionalLabel, { color: theme.textSecondary }]}>
                ({t.demographics.genderOptional})
              </ThemedText>
            </View>
            <View style={styles.genderOptions}>
              {GENDER_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.radioRow, isRTL && styles.radioRowRTL]}
                  onPress={() => setGender(option.value)}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: gender === option.value ? theme.primary : theme.border },
                    ]}
                  >
                    {gender === option.value ? (
                      <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                    ) : null}
                  </View>
                  <ThemedText style={styles.radioLabel}>
                    {t.demographics[option.labelKey]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.buttons}>
          <Button
            onPress={handleContinue}
            disabled={isLoading}
            style={styles.continueButton}
          >
            {t.demographics.continue}
          </Button>
          <Pressable onPress={handleSkip} style={styles.skipButton} disabled={isLoading}>
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              {t.demographics.skip}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    flexGrow: 1,
  },
  header: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
  },
  form: {
    flex: 1,
    gap: Spacing.xl,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.body,
    fontWeight: "600",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  labelRowRTL: {
    flexDirection: "row-reverse",
  },
  optionalLabel: {
    ...Typography.small,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dateButtonText: {
    ...Typography.body,
  },
  datePickerContainer: {
    alignItems: "center",
  },
  doneButton: {
    marginTop: Spacing.sm,
    width: 100,
  },
  genderOptions: {
    gap: Spacing.md,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  radioRowRTL: {
    flexDirection: "row-reverse",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: {
    ...Typography.body,
  },
  buttons: {
    marginTop: Spacing["2xl"],
    gap: Spacing.lg,
    alignItems: "center",
  },
  continueButton: {
    width: "100%",
    height: 56,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    ...Typography.body,
  },
});
