import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useNavigation, CommonActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const QUESTIONS = [
  { id: "feeling", type: "mood" },
  { id: "symptoms", type: "multiselect" },
  { id: "timing", type: "choice" },
  { id: "pain", type: "slider" },
  { id: "notes", type: "text" },
];

export default function SurveyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t, isRTL, addSurvey, setOnboardingComplete, surveys } = useApp();
  const navigation = useNavigation();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({
    feeling: "",
    symptoms: [],
    timing: "",
    painLevel: null,
    notes: "",
  });
  const [isComplete, setIsComplete] = useState(false);

  const textAlign = isRTL ? "right" : "left";

  const handleNext = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await addSurvey({
        feeling: answers.feeling,
        symptoms: answers.symptoms,
        timing: answers.timing,
        painLevel: answers.painLevel,
        notes: answers.notes || undefined,
      });
      
      if (surveys.length === 0) {
        await setOnboardingComplete(true);
      }
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateAnswer = (key: string, value: any) => {
    setAnswers({ ...answers, [key]: value });
  };

  const toggleSymptom = (symptom: string) => {
    const current = answers.symptoms;
    if (symptom === "none") {
      updateAnswer("symptoms", current.includes("none") ? [] : ["none"]);
    } else {
      const filtered = current.filter((s: string) => s !== "none" && s !== symptom);
      if (!current.includes(symptom)) {
        filtered.push(symptom);
      }
      updateAnswer("symptoms", filtered);
    }
  };

  const handleFinish = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" as never }],
      })
    );
  };

  const canProceed = () => {
    const question = QUESTIONS[currentStep];
    switch (question.id) {
      case "feeling":
        return !!answers.feeling;
      case "symptoms":
        return answers.symptoms.length > 0;
      case "timing":
        return !!answers.timing;
      case "pain":
        return answers.painLevel !== null;
      case "notes":
        return true;
      default:
        return true;
    }
  };

  if (isComplete) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing["3xl"] }]}>
        <View style={[styles.completeContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={[styles.successIcon, { backgroundColor: theme.secondary }]}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
          <ThemedText type="h2" style={styles.completeTitle}>
            {t.survey.surveyComplete}
          </ThemedText>
          <ThemedText type="body" style={[styles.completeSubtitle, { color: theme.textSecondary }]}>
            {t.survey.thankYou}
          </ThemedText>
          <Button onPress={handleFinish} style={styles.completeButton}>
            {t.survey.viewSummary}
          </Button>
        </View>
      </ThemedView>
    );
  }

  const question = QUESTIONS[currentStep];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.primary,
              width: `${((currentStep + 1) / QUESTIONS.length) * 100}%`,
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.xl,
        }}
      >
        <ThemedText type="small" style={[styles.progress, { color: theme.textSecondary }]}>
          {t.survey.progress} {currentStep + 1} {t.survey.of} {QUESTIONS.length}
        </ThemedText>

        {question.id === "feeling" && (
          <>
            <ThemedText type="h3" style={[styles.question, { textAlign }]}>
              {t.survey.feelingQuestion}
            </ThemedText>
            <View style={styles.moodContainer}>
              {[
                { value: "veryGood", icon: "smile" as const, label: t.survey.feelingVeryGood },
                { value: "okay", icon: "meh" as const, label: t.survey.feelingOkay },
                { value: "notGreat", icon: "frown" as const, label: t.survey.feelingNotGreat },
              ].map((mood) => (
                <Pressable
                  key={mood.value}
                  style={[
                    styles.moodCard,
                    {
                      backgroundColor: answers.feeling === mood.value ? theme.primary + "20" : theme.backgroundDefault,
                      borderColor: answers.feeling === mood.value ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => updateAnswer("feeling", mood.value)}
                >
                  <Feather
                    name={mood.icon}
                    size={32}
                    color={answers.feeling === mood.value ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText type="small" style={{ textAlign: "center", marginTop: Spacing.sm }}>
                    {mood.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText type="caption" style={[styles.disclaimer, { color: theme.textSecondary, textAlign }]}>
              {t.survey.feelingDisclaimer}
            </ThemedText>
          </>
        )}

        {question.id === "symptoms" && (
          <>
            <ThemedText type="h3" style={[styles.question, { textAlign }]}>
              {t.survey.symptomsQuestion}
            </ThemedText>
            <View style={styles.symptomsGrid}>
              {[
                { value: "stomach", icon: "circle" as const, label: t.survey.symptomStomach },
                { value: "headache", icon: "activity" as const, label: t.survey.symptomHeadache },
                { value: "breathing", icon: "wind" as const, label: t.survey.symptomBreathing },
                { value: "chest", icon: "heart" as const, label: t.survey.symptomChest },
                { value: "fatigue", icon: "battery" as const, label: t.survey.symptomFatigue },
                { value: "fever", icon: "thermometer" as const, label: t.survey.symptomFever },
                { value: "unusualFatigue", icon: "moon" as const, label: t.survey.symptomUnusualFatigue },
                { value: "cough", icon: "cloud" as const, label: t.survey.symptomCough },
                { value: "soreThroat", icon: "mic-off" as const, label: t.survey.symptomSoreThroat },
                { value: "runnyNose", icon: "droplet" as const, label: t.survey.symptomRunnyNose },
                { value: "nausea", icon: "frown" as const, label: t.survey.symptomNausea },
                { value: "diarrhea", icon: "alert-circle" as const, label: t.survey.symptomDiarrhea },
                { value: "dizziness", icon: "loader" as const, label: t.survey.symptomDizziness },
                { value: "musclePain", icon: "zap" as const, label: t.survey.symptomMusclePain },
                { value: "skinRash", icon: "sun" as const, label: t.survey.symptomSkinRash },
                { value: "none", icon: "check-circle" as const, label: t.survey.symptomNone },
              ].map((symptom) => {
                const isSelected = answers.symptoms.includes(symptom.value);
                return (
                  <Pressable
                    key={symptom.value}
                    style={[
                      styles.symptomCard,
                      {
                        backgroundColor: isSelected ? theme.primary + "20" : theme.backgroundDefault,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleSymptom(symptom.value)}
                  >
                    <Feather
                      name={symptom.icon}
                      size={24}
                      color={isSelected ? theme.primary : theme.textSecondary}
                    />
                    <ThemedText type="small" style={{ textAlign: "center", marginTop: Spacing.xs }}>
                      {symptom.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {question.id === "timing" && (
          <>
            <ThemedText type="h3" style={[styles.question, { textAlign }]}>
              {t.survey.timingQuestion}
            </ThemedText>
            {[
              { value: "afterMeals", label: t.survey.timingAfterMeals },
              { value: "duringActivity", label: t.survey.timingDuringActivity },
              { value: "duringStress", label: t.survey.timingDuringStress },
              { value: "eveningNight", label: t.survey.timingEveningNight },
              { value: "atRest", label: t.survey.timingAtRest },
              { value: "noSymptoms", label: t.survey.timingNoSymptoms },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: answers.timing === option.value ? theme.primary + "20" : theme.backgroundDefault,
                    borderColor: answers.timing === option.value ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => updateAnswer("timing", option.value)}
              >
                <ThemedText type="body" style={{ textAlign }}>{option.label}</ThemedText>
              </Pressable>
            ))}
          </>
        )}

        {question.id === "pain" && (
          <>
            <ThemedText type="h3" style={[styles.question, { textAlign }]}>
              {t.survey.painQuestion}
            </ThemedText>
            <View style={styles.painContainer}>
              <View style={styles.painLabels}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.survey.painNone}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.survey.painSevere}
                </ThemedText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={10}
                step={1}
                value={answers.painLevel ?? 5}
                onValueChange={(value: number) => updateAnswer("painLevel", value)}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
              />
              <View style={styles.sliderTicks}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tick) => (
                  <ThemedText key={tick} type="caption" style={{ color: theme.textSecondary }}>
                    {tick}
                  </ThemedText>
                ))}
              </View>
              {answers.painLevel !== null && (
                <View style={styles.selectedValue}>
                  <ThemedText type="h2" style={{ color: theme.primary }}>
                    {answers.painLevel}
                  </ThemedText>
                </View>
              )}
              <ThemedText type="caption" style={[styles.painHelper, { color: theme.textSecondary, textAlign }]}>
                {t.survey.painHelper}
              </ThemedText>
            </View>
          </>
        )}

        {question.id === "notes" && (
          <>
            <ThemedText type="h3" style={[styles.question, { textAlign }]}>
              {t.survey.notesQuestion}
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                  textAlign,
                },
              ]}
              value={answers.notes}
              onChangeText={(val) => updateAnswer("notes", val)}
              placeholder={t.survey.notesPlaceholder}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {t.common.optional}
            </ThemedText>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
            ...Shadows.medium,
          },
        ]}
      >
        <View style={styles.footerButtons}>
          {currentStep > 0 ? (
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={24} color={theme.primary} />
              <ThemedText type="link">{t.common.back}</ThemedText>
            </Pressable>
          ) : (
            <View />
          )}
          <Button onPress={handleNext} disabled={!canProceed()} style={styles.nextButton}>
            {currentStep === QUESTIONS.length - 1 ? t.common.submit : t.common.next}
          </Button>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  progress: {
    marginBottom: Spacing.md,
  },
  question: {
    marginBottom: Spacing.xl,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    marginBottom: Spacing.sm,
  },
  dateButton: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textArea: {
    minHeight: 120,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  optionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  moodContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  moodCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  disclaimer: {
    marginTop: Spacing.lg,
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  symptomCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  painContainer: {
    gap: Spacing.md,
  },
  painLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xs,
  },
  selectedValue: {
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  painHelper: {
    marginTop: Spacing.md,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  footerButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nextButton: {
    minWidth: 120,
  },
  completeContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  completeTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  completeSubtitle: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  completeButton: {
    width: "100%",
  },
});
