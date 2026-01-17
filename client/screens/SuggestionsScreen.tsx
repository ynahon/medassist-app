import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import {
  useApp,
  Recommendation,
  RecommendationStatus,
  RecommendationCategory,
} from "@/contexts/AppContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface GenerateRecommendationsPayload {
  userProfile: { dateOfBirth?: string; gender?: string };
  surveys: { date: string; responses: Record<string, unknown> }[];
  existingRecommendations: Recommendation[];
  language: string;
  userId?: string;
}

interface GenerateRecommendationsResponse {
  success: boolean;
  recommendations: {
    title: string;
    category: string;
    rationale: string;
    suggestedTiming: string;
    priority: number;
    clinicianPrompt?: string;
  }[];
  documentCount?: number;
  noMoreRecommendations?: boolean;
}

const CATEGORY_ICONS: Record<RecommendationCategory, keyof typeof Feather.glyphMap> = {
  checkup: "activity",
  vaccine: "shield",
  lifestyle: "heart",
  followup: "calendar",
};

export default function SuggestionsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    t,
    isRTL,
    language,
    user,
    activeSurveys,
    recommendations,
    addRecommendation,
    updateRecommendationStatus,
    deleteRecommendation,
    hideNotNeeded,
    setHideNotNeeded,
  } = useApp();

  const [showNoSurveyPrompt, setShowNoSurveyPrompt] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recommendationToDelete, setRecommendationToDelete] = useState<Recommendation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [pendingStatus, setPendingStatus] = useState<RecommendationStatus | null>(null);
  const [completionDate, setCompletionDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [lastDocumentCount, setLastDocumentCount] = useState<number | null>(null);
  const [noMoreRecommendations, setNoMoreRecommendations] = useState(false);

  const generateMutation = useMutation<GenerateRecommendationsResponse, Error, GenerateRecommendationsPayload>({
    mutationFn: async (payload) => {
      const response = await apiRequest("POST", "/api/recommendations/generate", payload);
      return response.json();
    },
    onSuccess: async (data) => {
      setLastDocumentCount(data.documentCount || 0);
      if (data.noMoreRecommendations || (data.recommendations && data.recommendations.length === 0)) {
        setNoMoreRecommendations(true);
      } else {
        setNoMoreRecommendations(false);
      }
      if (data.recommendations && Array.isArray(data.recommendations)) {
        const reversedRecs = [...data.recommendations].reverse();
        for (const rec of reversedRecs) {
          await addRecommendation({
            source: "ai" as const,
            title: rec.title,
            category: (rec.category || "checkup") as RecommendationCategory,
            rationale: rec.rationale,
            suggestedTiming: rec.suggestedTiming,
            priority: rec.priority || 2,
            clinicianPrompt: rec.clinicianPrompt,
            status: "pending" as const,
          });
        }
      }
    },
    onError: (error) => {
      console.error("Error generating recommendations:", error);
    },
  });

  const textAlign = isRTL ? "right" : "left";
  
  const filteredRecommendations = hideNotNeeded
    ? recommendations.filter((r) => r.status !== "not_needed")
    : recommendations;
  const pendingRecommendations = filteredRecommendations.filter((r) => r.status === "pending");
  const completedRecommendations = filteredRecommendations.filter((r) => r.status !== "pending");

  const getCategoryLabel = (category: RecommendationCategory): string => {
    const labels: Record<RecommendationCategory, string> = {
      checkup: t.suggestions.categoryCheckup,
      vaccine: t.suggestions.categoryVaccine,
      lifestyle: t.suggestions.categoryLifestyle,
      followup: t.suggestions.categoryFollowup,
    };
    return labels[category];
  };

  const handleGenerateRecommendations = () => {
    if (activeSurveys.length === 0) {
      setShowNoSurveyPrompt(true);
      return;
    }

    generateMutation.mutate({
      userProfile: {
        dateOfBirth: user?.dateOfBirth,
        gender: user?.gender || undefined,
      },
      surveys: activeSurveys.map((s) => ({
        date: s.date,
        responses: {
          feeling: s.feeling,
          symptoms: s.symptoms,
          timing: s.timing,
          painLevel: s.painLevel,
          notes: s.notes,
        },
      })),
      existingRecommendations: recommendations,
      language,
      userId: user?.id,
    });
  };

  const handleStatusChange = (recommendation: Recommendation, status: RecommendationStatus) => {
    setSelectedRecommendation(recommendation);
    setPendingStatus(status);
    setCompletionDate(null);
    setUserNote("");
    setStatusReason("");
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedRecommendation || !pendingStatus) return;

    await updateRecommendationStatus(selectedRecommendation.id, pendingStatus, {
      completedAt: completionDate?.toISOString(),
      userNote: userNote || undefined,
      statusReason: statusReason || undefined,
    });

    setShowStatusModal(false);
    setSelectedRecommendation(null);
    setPendingStatus(null);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setCompletionDate(selectedDate);
    }
  };

  const navigateToSurveys = () => {
    (navigation as any).navigate("SurveysTab");
  };

  const handleDeletePress = (recommendation: Recommendation) => {
    if (deletingId) return;
    setDeleteError(null);
    if (Platform.OS === "web") {
      setRecommendationToDelete(recommendation);
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        t.suggestions.deleteTitle,
        t.suggestions.deleteConfirm,
        [
          { text: t.common.cancel, style: "cancel" },
          {
            text: t.common.delete,
            style: "destructive",
            onPress: async () => {
              setDeletingId(recommendation.id);
              try {
                await deleteRecommendation(recommendation.id);
              } catch {
                Alert.alert(t.common.error, t.suggestions.deleteError);
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    }
  };

  const confirmDeleteRecommendation = async () => {
    if (!recommendationToDelete) return;
    setDeletingId(recommendationToDelete.id);
    setDeleteError(null);
    try {
      await deleteRecommendation(recommendationToDelete.id);
      setShowDeleteConfirm(false);
      setRecommendationToDelete(null);
    } catch {
      setDeleteError(t.suggestions.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="heart" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h4" style={styles.emptyTitle}>
        {t.suggestions.empty}
      </ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {t.suggestions.emptySubtitle}
      </ThemedText>

      <View style={styles.emptyButtons}>
        <Button
          onPress={handleGenerateRecommendations}
          style={styles.emptyPrimaryButton}
          disabled={generateMutation.isPending}
          variant="accent"
        >
          {t.suggestions.emptyPrimary}
        </Button>

        {activeSurveys.length === 0 ? (
          <Pressable onPress={navigateToSurveys} style={styles.emptySecondaryButton}>
            <ThemedText type="body" style={{ color: theme.primary }}>
              {t.suggestions.emptySecondary}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderRecommendationCard = (recommendation: Recommendation) => (
    <Card key={recommendation.id} elevation={1} style={styles.recommendationCard}>
      <View style={[styles.cardHeader, isRTL && styles.cardHeaderRTL]}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
          <Feather
            name={CATEGORY_ICONS[recommendation.category]}
            size={24}
            color={theme.primary}
          />
        </View>
        <View style={styles.cardTitleContainer}>
          <ThemedText type="h4" style={{ textAlign }}>
            {recommendation.title}
          </ThemedText>
          <View style={[styles.categoryChip, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {getCategoryLabel(recommendation.category)}
            </ThemedText>
          </View>
        </View>
        <Pressable
          style={[styles.deleteIconButton, { backgroundColor: theme.error + "15" }]}
          onPress={() => handleDeletePress(recommendation)}
          accessibilityLabel={t.common.delete}
          disabled={deletingId === recommendation.id}
        >
          {deletingId === recommendation.id ? (
            <ActivityIndicator size="small" color={theme.error} />
          ) : (
            <Feather name="trash-2" size={18} color={theme.error} />
          )}
        </Pressable>
      </View>

      <View style={styles.timingRow}>
        <Feather name="clock" size={14} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {recommendation.suggestedTiming}
        </ThemedText>
      </View>

      <ThemedText type="body" style={[styles.rationale, { textAlign }]}>
        {recommendation.rationale}
      </ThemedText>

      {recommendation.status === "pending" ? (
        <View style={[styles.actionButtons, isRTL && styles.actionButtonsRTL]}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.success + "20" }]}
            onPress={() => handleStatusChange(recommendation, "done")}
          >
            <Feather name="check" size={16} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success }}>
              {t.suggestions.statusDone}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.warning + "20" }]}
            onPress={() => handleStatusChange(recommendation, "irrelevant")}
          >
            <Feather name="x" size={16} color={theme.warning} />
            <ThemedText type="small" style={{ color: theme.warning }}>
              {t.suggestions.statusIrrelevant}
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.error + "20" }]}
            onPress={() => handleStatusChange(recommendation, "not_needed")}
          >
            <Feather name="slash" size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error }}>
              {t.suggestions.statusNotNeeded}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.statusBadge, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {recommendation.status === "done"
              ? t.suggestions.statusDone
              : recommendation.status === "irrelevant"
              ? t.suggestions.statusIrrelevant
              : t.suggestions.statusNotNeeded}
          </ThemedText>
        </View>
      )}
    </Card>
  );

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing["6xl"] + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card elevation={1} style={{ ...styles.disclaimerCard, borderColor: theme.warning }}>
          <View style={[styles.disclaimerRow, isRTL && styles.disclaimerRowRTL]}>
            <Feather name="info" size={20} color={theme.warning} />
            <ThemedText type="small" style={[styles.disclaimerText, { textAlign }]}>
              {t.suggestions.disclaimer}
            </ThemedText>
          </View>
        </Card>

        {lastDocumentCount !== null && lastDocumentCount > 0 ? (
          <View style={[styles.documentIndicator, isRTL && styles.documentIndicatorRTL]}>
            <Feather name="file-text" size={14} color={theme.primary} />
            <ThemedText type="caption" style={{ color: theme.primary }}>
              {t.suggestions.usingDocuments?.replace("{count}", String(lastDocumentCount)) || `Using ${lastDocumentCount} uploaded document${lastDocumentCount > 1 ? "s" : ""} as context`}
            </ThemedText>
          </View>
        ) : null}

        {recommendations.length > 0 ? (
          <Pressable
            style={[styles.filterToggle, isRTL && styles.filterToggleRTL]}
            onPress={async () => await setHideNotNeeded(!hideNotNeeded)}
          >
            <Feather
              name={hideNotNeeded ? "check-square" : "square"}
              size={18}
              color={hideNotNeeded ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{ color: hideNotNeeded ? theme.primary : theme.textSecondary }}
            >
              {t.suggestions.hideNotNeeded}
            </ThemedText>
          </Pressable>
        ) : null}

        {filteredRecommendations.length > 0 ? (
          <>
            {pendingRecommendations.length > 0 ? (
              pendingRecommendations.map(renderRecommendationCard)
            ) : null}

            {completedRecommendations.length > 0 ? (
              <View style={styles.completedSection}>
                <ThemedText
                  type="caption"
                  style={[styles.sectionLabel, { color: theme.textSecondary, textAlign }]}
                >
                  {t.surveys.completed}
                </ThemedText>
                {completedRecommendations.map(renderRecommendationCard)}
              </View>
            ) : null}

            {noMoreRecommendations ? (
              <View style={styles.noMoreContainer}>
                <Feather name="check-circle" size={24} color={theme.success} />
                <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
                  {t.suggestions.noMoreRecommendations || "No more recommendations at this time"}
                </ThemedText>
              </View>
            ) : (
              <Button
                onPress={handleGenerateRecommendations}
                style={styles.getMoreButton}
                disabled={generateMutation.isPending}
                variant="primary"
              >
                {generateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  t.suggestions.getMore || "Get More Recommendations"
                )}
              </Button>
            )}
          </>
        ) : generateMutation.isPending ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.lg }}>
              {t.suggestions.generating}
            </ThemedText>
          </View>
        ) : recommendations.length > 0 && hideNotNeeded ? (
          <View style={styles.emptyFilterContainer}>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              {t.suggestions.noRecommendationsWithFilter}
            </ThemedText>
            <Pressable onPress={() => setHideNotNeeded(false)} style={styles.showAllButton}>
              <ThemedText type="body" style={{ color: theme.primary }}>
                {t.suggestions.showAll}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.promptModal, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.md }}>
              {t.suggestions.deleteTitle}
            </ThemedText>
            <ThemedText type="body" style={{ textAlign: "center", marginBottom: Spacing.xl, color: theme.textSecondary }}>
              {t.suggestions.deleteConfirm}
            </ThemedText>
            {deleteError ? (
              <ThemedText type="small" style={{ textAlign: "center", marginBottom: Spacing.md, color: theme.error }}>
                {deleteError}
              </ThemedText>
            ) : null}
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setRecommendationToDelete(null);
                  setDeleteError(null);
                }}
                disabled={!!deletingId}
              >
                <ThemedText type="body">{t.common.cancel}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.error }]}
                onPress={confirmDeleteRecommendation}
                disabled={!!deletingId}
              >
                {deletingId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                    {t.common.delete}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={showNoSurveyPrompt} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.promptModal, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="body" style={{ textAlign: "center", marginBottom: Spacing.xl }}>
              {t.suggestions.noSurveyPrompt}
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => setShowNoSurveyPrompt(false)}
              >
                <ThemedText type="body">{t.common.cancel}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowNoSurveyPrompt(false);
                  navigateToSurveys();
                }}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                  {t.suggestions.goToSurveys}
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal visible={showStatusModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.lg }}>
              {pendingStatus === "done"
                ? t.suggestions.markDone
                : pendingStatus === "irrelevant"
                ? t.suggestions.statusIrrelevant
                : t.suggestions.statusNotNeeded}
            </ThemedText>

            {pendingStatus === "done" ? (
              <>
                <ThemedText type="body" style={{ marginBottom: Spacing.sm, textAlign }}>
                  {t.suggestions.completionDate}
                </ThemedText>
                <Pressable
                  style={[
                    styles.dateInput,
                    { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <ThemedText
                    type="body"
                    style={{ color: completionDate ? theme.text : theme.textSecondary }}
                  >
                    {completionDate
                      ? completionDate.toLocaleDateString(isRTL ? "he-IL" : "en-US")
                      : "Select date"}
                  </ThemedText>
                  <Feather name="calendar" size={20} color={theme.textSecondary} />
                </Pressable>

                {showDatePicker ? (
                  <DateTimePicker
                    value={completionDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                  />
                ) : null}

                <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm, textAlign }}>
                  {t.suggestions.addNote}
                </ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      color: theme.text,
                      textAlign,
                    },
                  ]}
                  value={userNote}
                  onChangeText={setUserNote}
                  placeholder="..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </>
            ) : (
              <>
                <ThemedText type="body" style={{ marginBottom: Spacing.sm, textAlign }}>
                  {t.suggestions.reasonOptional}
                </ThemedText>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      color: theme.text,
                      textAlign,
                    },
                  ]}
                  value={statusReason}
                  onChangeText={setStatusReason}
                  placeholder="..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => setShowStatusModal(false)}
              >
                <ThemedText type="body">{t.common.cancel}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={confirmStatusChange}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                  {t.common.confirm}
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
  disclaimerCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  disclaimerRowRTL: {
    flexDirection: "row-reverse",
  },
  disclaimerText: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing["2xl"],
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
    marginBottom: Spacing.xl,
  },
  emptyButtons: {
    width: "100%",
    gap: Spacing.md,
    alignItems: "center",
  },
  emptyPrimaryButton: {
    width: "100%",
  },
  emptySecondaryButton: {
    paddingVertical: Spacing.sm,
  },
  hintContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["4xl"],
  },
  recommendationCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeaderRTL: {
    flexDirection: "row-reverse",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  deleteIconButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  categoryChip: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rationale: {
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionButtonsRTL: {
    flexDirection: "row-reverse",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  completedSection: {
    marginTop: Spacing.xl,
  },
  getMoreButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  noMoreContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  textInput: {
    minHeight: 80,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterToggleRTL: {
    flexDirection: "row-reverse",
  },
  documentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  documentIndicatorRTL: {
    flexDirection: "row-reverse",
  },
  emptyFilterContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["4xl"],
    gap: Spacing.lg,
  },
  showAllButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  promptModal: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
});
