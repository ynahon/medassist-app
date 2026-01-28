import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "./ThemedText";
import { Card } from "./Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PossibleCondition {
  id?: string;
  name: string;
  probability?: number;
  confidence?: number;
  severity?: "low" | "moderate" | "high";
  summary?: string;
  whyItFits?: string[];
  redFlagsToWatch?: string[];
  selfCare?: string[];
  whenToSeeDoctor?: string;
}

interface ConditionsAccordionProps {
  conditions: PossibleCondition[];
  isRTL?: boolean;
  translations: {
    title: string;
    searchPlaceholder: string;
    expandAll: string;
    collapseAll: string;
    showDetailsByDefault: string;
    noConditions: string;
    disclaimer: string;
    whyItFits: string;
    redFlags: string;
    selfCare: string;
    whenToSeeDoctor: string;
    severityLow: string;
    severityModerate: string;
    severityHigh: string;
  };
}

const STORAGE_KEY = "conditions_show_details_default";

function normalizeConditions(
  conditions: PossibleCondition[]
): PossibleCondition[] {
  return conditions.map((c) => {
    let prob = c.probability ?? c.confidence ?? 0;
    if (prob > 1) prob = prob / 100;
    return { ...c, probability: Math.max(0, Math.min(1, prob)) };
  });
}

function AccordionItem({
  condition,
  isExpanded,
  onToggle,
  isRTL,
  translations,
  theme,
}: {
  condition: PossibleCondition;
  isExpanded: boolean;
  onToggle: () => void;
  isRTL: boolean;
  translations: ConditionsAccordionProps["translations"];
  theme: any;
}) {
  const rotation = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(isExpanded ? 1 : 0, { duration: 200 });
  }, [isExpanded, rotation]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const textAlign = isRTL ? "right" : "left";
  const probability = Math.round((condition.probability ?? 0) * 100);

  const getSeverityColor = () => {
    switch (condition.severity) {
      case "high":
        return theme.error;
      case "moderate":
        return theme.warning;
      default:
        return theme.success;
    }
  };

  const getSeverityLabel = () => {
    switch (condition.severity) {
      case "high":
        return translations.severityHigh;
      case "moderate":
        return translations.severityModerate;
      default:
        return translations.severityLow;
    }
  };

  return (
    <Card elevation={1} style={styles.accordionItem}>
      <Pressable
        style={[styles.accordionHeader, isRTL && styles.accordionHeaderRTL]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${condition.name}, ${probability}%`}
      >
        <View style={[styles.headerContent, isRTL && styles.headerContentRTL]}>
          <View style={styles.nameAndBadge}>
            <ThemedText type="h4" style={{ textAlign, flex: 1 }}>
              {condition.name}
            </ThemedText>
            {condition.severity && (
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: getSeverityColor() + "20" },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: getSeverityColor() }}
                >
                  {getSeverityLabel()}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.probabilityContainer}>
            <View
              style={[styles.progressBar, { backgroundColor: theme.border }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${probability}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>
            <ThemedText type="bodyLarge" style={styles.probabilityText}>
              {probability}%
            </ThemedText>
          </View>
        </View>

        <Animated.View style={animatedIconStyle}>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Animated.View>
      </Pressable>

      {isExpanded && (
        <View style={styles.accordionBody}>
          {condition.summary && (
            <ThemedText
              type="body"
              style={[styles.summary, { textAlign, color: theme.text }]}
            >
              {condition.summary}
            </ThemedText>
          )}

          {condition.whyItFits && condition.whyItFits.length > 0 && (
            <View style={styles.section}>
              <ThemedText
                type="small"
                style={[styles.sectionTitle, { color: theme.textSecondary }]}
              >
                {translations.whyItFits}
              </ThemedText>
              {condition.whyItFits.map((item, i) => (
                <View
                  key={i}
                  style={[styles.bulletRow, isRTL && styles.bulletRowRTL]}
                >
                  <ThemedText
                    type="body"
                    style={{ color: theme.textSecondary }}
                  >
                    {isRTL ? "•" : "•"}
                  </ThemedText>
                  <ThemedText type="body" style={{ textAlign, flex: 1 }}>
                    {item}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {condition.redFlagsToWatch &&
            condition.redFlagsToWatch.length > 0 && (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={[styles.sectionTitle, { color: theme.error }]}
                >
                  {translations.redFlags}
                </ThemedText>
                {condition.redFlagsToWatch.map((item, i) => (
                  <View
                    key={i}
                    style={[styles.bulletRow, isRTL && styles.bulletRowRTL]}
                  >
                    <Feather
                      name="alert-triangle"
                      size={12}
                      color={theme.error}
                    />
                    <ThemedText
                      type="body"
                      style={{ textAlign, flex: 1, color: theme.error }}
                    >
                      {item}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

          {condition.selfCare && condition.selfCare.length > 0 && (
            <View style={styles.section}>
              <ThemedText
                type="small"
                style={[styles.sectionTitle, { color: theme.success }]}
              >
                {translations.selfCare}
              </ThemedText>
              {condition.selfCare.map((item, i) => (
                <View
                  key={i}
                  style={[styles.bulletRow, isRTL && styles.bulletRowRTL]}
                >
                  <Feather name="check-circle" size={12} color={theme.success} />
                  <ThemedText type="body" style={{ textAlign, flex: 1 }}>
                    {item}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          {condition.whenToSeeDoctor && (
            <View style={[styles.section, styles.doctorSection]}>
              <View
                style={[styles.doctorRow, isRTL && styles.doctorRowRTL]}
              >
                <Feather name="user" size={14} color={theme.primary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary }}
                >
                  {translations.whenToSeeDoctor}
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ textAlign }}>
                {condition.whenToSeeDoctor}
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

export function ConditionsAccordion({
  conditions,
  isRTL = false,
  translations,
}: ConditionsAccordionProps) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showDetailsByDefault, setShowDetailsByDefault] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "true") setShowDetailsByDefault(true);
    });
  }, []);

  const normalizedConditions = normalizeConditions(conditions);
  const sortedConditions = [...normalizedConditions].sort(
    (a, b) => (b.probability ?? 0) - (a.probability ?? 0)
  );
  const filteredConditions = sortedConditions.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const allIds = filteredConditions.map((c) => c.id || c.name);
    setExpandedIds(new Set(allIds));
  }, [filteredConditions]);

  const collapseAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds(new Set());
  }, []);

  const toggleShowByDefault = useCallback(async () => {
    const newVal = !showDetailsByDefault;
    setShowDetailsByDefault(newVal);
    await AsyncStorage.setItem(STORAGE_KEY, newVal ? "true" : "false");
  }, [showDetailsByDefault]);

  useEffect(() => {
    if (showDetailsByDefault && conditions.length > 0) {
      const allIds = normalizedConditions.map((c) => c.id || c.name);
      setExpandedIds(new Set(allIds));
    }
  }, [showDetailsByDefault, conditions.length, normalizedConditions]);

  if (!conditions || conditions.length === 0) {
    return null;
  }

  const textAlign = isRTL ? "right" : "left";

  return (
    <View style={styles.container}>
      <ThemedText type="h4" style={[styles.title, { textAlign }]}>
        {translations.title}
      </ThemedText>

      <View
        style={[styles.searchContainer, { backgroundColor: theme.backgroundSecondary }]}
      >
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[
            styles.searchInput,
            { color: theme.text, textAlign },
          ]}
          placeholder={translations.searchPlaceholder}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={[styles.controls, isRTL && styles.controlsRTL]}>
        <Pressable
          style={[styles.controlButton, { borderColor: theme.border }]}
          onPress={expandAll}
        >
          <Feather name="maximize-2" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary }}>
            {translations.expandAll}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.controlButton, { borderColor: theme.border }]}
          onPress={collapseAll}
        >
          <Feather name="minimize-2" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary }}>
            {translations.collapseAll}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.toggleButton, isRTL && styles.toggleButtonRTL]}
          onPress={toggleShowByDefault}
        >
          <Feather
            name={showDetailsByDefault ? "check-square" : "square"}
            size={16}
            color={showDetailsByDefault ? theme.primary : theme.textSecondary}
          />
          <ThemedText
            type="caption"
            style={{ color: showDetailsByDefault ? theme.primary : theme.textSecondary }}
          >
            {translations.showDetailsByDefault}
          </ThemedText>
        </Pressable>
      </View>

      {filteredConditions.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {translations.noConditions}
          </ThemedText>
        </View>
      ) : (
        filteredConditions.map((condition) => {
          const id = condition.id || condition.name;
          return (
            <AccordionItem
              key={id}
              condition={condition}
              isExpanded={expandedIds.has(id)}
              onToggle={() => toggleExpand(id)}
              isRTL={isRTL}
              translations={translations}
              theme={theme}
            />
          );
        })
      )}

      <View
        style={[styles.disclaimerCard, { backgroundColor: theme.warning + "15", borderColor: theme.warning }]}
      >
        <View style={[styles.disclaimerRow, isRTL && styles.disclaimerRowRTL]}>
          <Feather name="alert-circle" size={16} color={theme.warning} />
          <ThemedText type="small" style={[styles.disclaimerText, { color: theme.text, textAlign }]}>
            {translations.disclaimer}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  controlsRTL: {
    flexDirection: "row-reverse",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: "auto",
  },
  toggleButtonRTL: {
    marginLeft: 0,
    marginRight: "auto",
  },
  emptyState: {
    padding: Spacing.xl,
  },
  accordionItem: {
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  accordionHeaderRTL: {
    flexDirection: "row-reverse",
  },
  headerContent: {
    flex: 1,
    gap: Spacing.sm,
  },
  headerContentRTL: {
    alignItems: "flex-end",
  },
  nameAndBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  severityBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  probabilityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  probabilityText: {
    minWidth: 40,
    textAlign: "right",
  },
  accordionBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  summary: {
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  bulletRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  bulletRowRTL: {
    flexDirection: "row-reverse",
  },
  doctorSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  doctorRowRTL: {
    flexDirection: "row-reverse",
  },
  disclaimerCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  disclaimerRowRTL: {
    flexDirection: "row-reverse",
  },
  disclaimerText: {
    flex: 1,
  },
});
