import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t, isRTL, user, surveys } = useApp();
  const navigation = useNavigation<NavigationProp>();

  const textAlign = isRTL ? "right" : "left";

  const lastSurveyDate = surveys.length > 0 ? new Date(surveys[0].date) : null;
  const daysSinceLastSurvey = lastSurveyDate
    ? Math.floor((Date.now() - lastSurveyDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysUntilNextSurvey = daysSinceLastSurvey !== null ? Math.max(0, 30 - daysSinceLastSurvey) : 0;
  const surveyReady = daysSinceLastSurvey === null || daysSinceLastSurvey >= 30;

  const getRecentTrends = () => {
    if (surveys.length < 2) return null;
    const recentSurveys = surveys.slice(0, 3);
    const symptomCounts: Record<string, number> = {};
    recentSurveys.forEach((survey) => {
      survey.symptoms.forEach((symptom) => {
        if (symptom !== "none") {
          symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
        }
      });
    });
    return Object.entries(symptomCounts)
      .filter(([_, count]) => count >= 2)
      .map(([symptom]) => symptom);
  };

  const recentTrends = getRecentTrends();

  const getSymptomLabel = (symptom: string) => {
    const labels: Record<string, string> = {
      stomach: t.survey.symptomStomach,
      headache: t.survey.symptomHeadache,
      breathing: t.survey.symptomBreathing,
      chest: t.survey.symptomChest,
      fatigue: t.survey.symptomFatigue,
    };
    return labels[symptom] || symptom;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing["6xl"] + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <ThemedText type="h3" style={[styles.greeting, { textAlign }]}>
        {t.home.greeting}, {user?.firstName}
      </ThemedText>

      <Card elevation={1} style={styles.statusCard}>
        <View style={[styles.statusRow, isRTL && styles.statusRowRTL]}>
          <View style={[styles.statusIcon, { backgroundColor: surveyReady ? theme.accent : theme.primary }]}>
            <Feather name={surveyReady ? "bell" : "clock"} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.statusContent}>
            <ThemedText type="h4" style={{ textAlign }}>
              {surveyReady ? t.home.surveyReady : t.home.nextSurvey}
            </ThemedText>
            {!surveyReady ? (
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign }}>
                {daysUntilNextSurvey} {t.home.days}
              </ThemedText>
            ) : null}
          </View>
        </View>
        {surveyReady ? (
          <Button onPress={() => navigation.navigate("MonthlySurvey")} style={styles.surveyButton} variant="accent">
            {t.home.takeSurveyNow}
          </Button>
        ) : null}
      </Card>

      <View style={styles.statsRow}>
        <Card elevation={1} style={styles.statCard}>
          <ThemedText type="h2" style={[styles.statValue, { color: theme.primary }]}>
            {surveys.length}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {t.home.surveysCompleted}
          </ThemedText>
        </Card>
      </View>

      <ThemedText type="h4" style={[styles.sectionTitle, { textAlign }]}>
        {t.home.recentTrends}
      </ThemedText>

      {recentTrends && recentTrends.length > 0 ? (
        <Card elevation={1} style={styles.trendsCard}>
          {recentTrends.map((symptom, index) => (
            <View key={symptom} style={[styles.trendItem, index > 0 && styles.trendItemBorder]}>
              <Feather name="trending-up" size={20} color={theme.warning} />
              <ThemedText type="body" style={{ flex: 1, textAlign }}>
                {getSymptomLabel(symptom)}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : (
        <Card elevation={1} style={styles.emptyCard}>
          <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
            {t.home.noTrends}
          </ThemedText>
        </Card>
      )}

      {surveys.length > 0 ? (
        <>
          <ThemedText type="h4" style={[styles.sectionTitle, { textAlign }]}>
            {t.home.healthTimeline}
          </ThemedText>
          <Card elevation={1} style={styles.timelineCard}>
            {surveys.slice(0, 5).map((survey, index) => {
              const date = new Date(survey.date);
              const moodIcon = survey.feeling === "veryGood" ? "smile" : survey.feeling === "okay" ? "meh" : "frown";
              const moodColor =
                survey.feeling === "veryGood"
                  ? theme.secondary
                  : survey.feeling === "okay"
                    ? theme.warning
                    : theme.error;
              return (
                <View key={survey.id} style={[styles.timelineItem, index > 0 && styles.timelineItemBorder]}>
                  <View style={styles.timelineDate}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>
                      {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </ThemedText>
                  </View>
                  <View style={[styles.timelineDot, { backgroundColor: moodColor }]} />
                  <View style={styles.timelineContent}>
                    <Feather name={moodIcon as any} size={20} color={moodColor} />
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {survey.symptoms.filter((s) => s !== "none").length > 0
                        ? `${survey.symptoms.filter((s) => s !== "none").length} symptoms`
                        : "No symptoms"}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: {
    marginBottom: Spacing.xl,
  },
  statusCard: {
    marginBottom: Spacing.xl,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  statusRowRTL: {
    flexDirection: "row-reverse",
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  statusContent: {
    flex: 1,
  },
  surveyButton: {
    marginTop: Spacing.lg,
  },
  statsRow: {
    marginBottom: Spacing.xl,
  },
  statCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  statValue: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  trendsCard: {
    marginBottom: Spacing.xl,
  },
  trendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  trendItemBorder: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  timelineCard: {
    marginBottom: Spacing.xl,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  timelineItemBorder: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  timelineDate: {
    width: 60,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
