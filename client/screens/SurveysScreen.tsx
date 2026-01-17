import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp, SurveyResponse } from "@/contexts/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function SurveysScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t, isRTL, activeSurveys, deleteSurvey } = useApp();

  const [selectedSurvey, setSelectedSurvey] = useState<SurveyResponse | null>(null);
  const [surveyToDelete, setSurveyToDelete] = useState<SurveyResponse | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeletePress = (survey: SurveyResponse) => {
    if (Platform.OS === "web") {
      setSurveyToDelete(survey);
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        t.surveys.deleteTitle,
        t.surveys.deleteConfirm,
        [
          { text: t.common.cancel, style: "cancel" },
          {
            text: t.common.delete,
            style: "destructive",
            onPress: async () => {
              await deleteSurvey(survey.id);
            },
          },
        ]
      );
    }
  };

  const confirmDelete = async () => {
    if (surveyToDelete) {
      await deleteSurvey(surveyToDelete.id);
      setSurveyToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const textAlign = isRTL ? "right" : "left";

  const getMoodLabel = (feeling: string) => {
    const labels: Record<string, string> = {
      veryGood: t.survey.feelingVeryGood,
      okay: t.survey.feelingOkay,
      notGreat: t.survey.feelingNotGreat,
    };
    return labels[feeling] || feeling;
  };

  const getSymptomLabel = (symptom: string) => {
    const labels: Record<string, string> = {
      stomach: t.survey.symptomStomach,
      headache: t.survey.symptomHeadache,
      breathing: t.survey.symptomBreathing,
      chest: t.survey.symptomChest,
      fatigue: t.survey.symptomFatigue,
      none: t.survey.symptomNone,
    };
    return labels[symptom] || symptom;
  };

  const renderSurveyCard = ({ item }: { item: SurveyResponse }) => {
    const date = new Date(item.date);
    const moodIcon = item.feeling === "veryGood" ? "smile" : item.feeling === "okay" ? "meh" : "frown";
    const moodColor =
      item.feeling === "veryGood" ? theme.secondary : item.feeling === "okay" ? theme.warning : theme.error;

    return (
      <Card elevation={1} style={styles.surveyCard} onPress={() => setSelectedSurvey(item)}>
        <View style={[styles.surveyHeader, isRTL && styles.surveyHeaderRTL]}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h4" style={{ textAlign }}>
              {date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign }}>
              {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </ThemedText>
          </View>
          <View style={[styles.headerActions, isRTL && styles.headerActionsRTL]}>
            <Pressable
              style={[styles.deleteButton, { backgroundColor: theme.error + "15" }]}
              onPress={(e) => {
                e.stopPropagation();
                handleDeletePress(item);
              }}
              accessibilityLabel={t.common.delete}
            >
              <Feather name="trash-2" size={18} color={theme.error} />
            </Pressable>
            <View style={[styles.moodBadge, { backgroundColor: moodColor + "20" }]}>
              <Feather name={moodIcon as any} size={20} color={moodColor} />
            </View>
          </View>
        </View>
        <View style={styles.surveyDetails}>
          <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
            <Feather name="activity" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {item.symptoms.filter((s) => s !== "none").length > 0
                ? item.symptoms.filter((s) => s !== "none").map(getSymptomLabel).join(", ")
                : t.survey.symptomNone}
            </ThemedText>
          </View>
          <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
            <Feather name="bar-chart" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {t.survey.painQuestion}: {item.painLevel}/10
            </ThemedText>
          </View>
        </View>
        <View style={[styles.viewDetails, isRTL && styles.viewDetailsRTL]}>
          <ThemedText type="link">{t.surveys.viewDetails}</ThemedText>
          <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={18} color={theme.link} />
        </View>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="clipboard" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h4" style={styles.emptyTitle}>
        {t.surveys.empty}
      </ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {t.surveys.emptySubtitle}
      </ThemedText>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing["6xl"] + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={activeSurveys}
        keyExtractor={(item) => item.id}
        renderItem={renderSurveyCard}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />

      <Modal visible={!!selectedSurvey} animationType="slide" presentationStyle="pageSheet">
        {selectedSurvey ? (
          <ThemedView style={styles.modalContainer}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="h4">{t.surveys.viewDetails}</ThemedText>
              <Pressable onPress={() => setSelectedSurvey(null)} style={styles.closeButton}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
              <View style={styles.modalSection}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Date
                </ThemedText>
                <ThemedText type="body">
                  {new Date(selectedSurvey.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.survey.feelingQuestion}
                </ThemedText>
                <ThemedText type="body">{getMoodLabel(selectedSurvey.feeling)}</ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.survey.symptomsQuestion}
                </ThemedText>
                <ThemedText type="body">
                  {selectedSurvey.symptoms.map(getSymptomLabel).join(", ")}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.survey.timingQuestion}
                </ThemedText>
                <ThemedText type="body">
                  {selectedSurvey.timing === "afterMeals"
                    ? t.survey.timingAfterMeals
                    : selectedSurvey.timing === "duringActivity"
                      ? t.survey.timingDuringActivity
                      : selectedSurvey.timing === "atRest"
                        ? t.survey.timingAtRest
                        : t.survey.timingNoSymptoms}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.survey.painQuestion}
                </ThemedText>
                <ThemedText type="body">{selectedSurvey.painLevel}/10</ThemedText>
              </View>

              {selectedSurvey.notes ? (
                <View style={styles.modalSection}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {t.survey.notesQuestion}
                  </ThemedText>
                  <ThemedText type="body">{selectedSurvey.notes}</ThemedText>
                </View>
              ) : null}

              <Button onPress={() => setSelectedSurvey(null)} style={styles.modalButton}>
                {t.common.done}
              </Button>
            </View>
          </ThemedView>
        ) : null}
      </Modal>

      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={styles.deleteModalOverlay}>
          <ThemedView style={[styles.deleteModalContainer, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.md }}>
              {t.surveys.deleteTitle}
            </ThemedText>
            <ThemedText type="body" style={{ textAlign: "center", marginBottom: Spacing.xl, color: theme.textSecondary }}>
              {t.surveys.deleteConfirm}
            </ThemedText>
            <View style={styles.deleteModalButtons}>
              <Pressable
                style={[styles.deleteModalButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setSurveyToDelete(null);
                  setShowDeleteConfirm(false);
                }}
              >
                <ThemedText type="body">{t.common.cancel}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.deleteModalButton, { backgroundColor: theme.error }]}
                onPress={confirmDelete}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                  {t.common.delete}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  surveyCard: {
    gap: Spacing.md,
  },
  surveyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  surveyHeaderRTL: {
    flexDirection: "row-reverse",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerActionsRTL: {
    flexDirection: "row-reverse",
  },
  deleteButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  moodBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  surveyDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailRowRTL: {
    flexDirection: "row-reverse",
  },
  viewDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  viewDetailsRTL: {
    flexDirection: "row-reverse",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  modalSection: {
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  modalButton: {
    marginTop: "auto",
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  deleteModalContainer: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  deleteModalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
