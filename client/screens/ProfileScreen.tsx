import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Switch, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import { getApiUrl } from "@/lib/query-client";

import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp, Gender } from "@/contexts/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Language, getLanguageName } from "@/i18n";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme } = useTheme();
  const {
    t,
    isRTL,
    user,
    language,
    setLanguage,
    notificationsEnabled,
    setNotificationsEnabled,
    logout,
    deleteAccount,
    updateUserDemographics,
  } = useApp();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDemographicsModal, setShowDemographicsModal] = useState(false);
  const [editingDateOfBirth, setEditingDateOfBirth] = useState<Date | null>(
    user?.dateOfBirth ? new Date(user.dateOfBirth) : null
  );
  const [editingGender, setEditingGender] = useState<Gender>(user?.gender ?? null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  const appVersion = Constants.expoConfig?.version || "1.0.0";

  useEffect(() => {
    const fetchBackendVersion = async () => {
      try {
        const baseUrl = getApiUrl();
        const response = await fetch(`${baseUrl}health`);
        if (response.ok) {
          const data = await response.json();
          setBackendVersion(data.version || null);
        }
      } catch (error) {
        console.error("Failed to fetch backend version:", error);
      }
    };
    fetchBackendVersion();
  }, []);

  const textAlign = isRTL ? "right" : "left";

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = () => {
    setShowDeleteModal(false);
    deleteAccount();
  };

  const handleLanguageChange = async (lang: Language) => {
    await setLanguage(lang);
    setShowLanguageModal(false);
  };

  const formatDateOfBirth = (dateString: string | undefined) => {
    if (!dateString) return t.common.notSet || "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? "he-IL" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getGenderLabel = (gender: Gender) => {
    if (!gender) return t.common.notSet || "Not set";
    const labels: Record<string, string> = {
      male: t.demographics.genderMale,
      female: t.demographics.genderFemale,
      other: t.demographics.genderOther,
      preferNot: t.demographics.genderPreferNot,
    };
    return labels[gender] || t.common.notSet || "Not set";
  };

  const handleOpenDemographicsModal = () => {
    setEditingDateOfBirth(user?.dateOfBirth ? new Date(user.dateOfBirth) : null);
    setEditingGender(user?.gender ?? null);
    setShowDemographicsModal(true);
  };

  const handleSaveDemographics = async () => {
    await updateUserDemographics({
      dateOfBirth: editingDateOfBirth?.toISOString(),
      gender: editingGender,
    });
    setShowDemographicsModal(false);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setEditingDateOfBirth(selectedDate);
    }
    if (Platform.OS === "ios" && event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  return (
    <>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing["6xl"] + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </ThemedText>
          </View>
          <ThemedText type="h3" style={{ textAlign: "center" }}>
            {user?.firstName} {user?.lastName}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {user?.phoneNumber}
          </ThemedText>
          {user?.idNumberMasked ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              {t.profile.idMasked}: {user.idNumberMasked}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText type="h4" style={[styles.sectionTitle, { textAlign }]}>
          {t.profile.settings}
        </ThemedText>

        <Card elevation={1} style={styles.settingsCard}>
          <Pressable
            style={[styles.settingRow, isRTL && styles.settingRowRTL]}
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="globe" size={20} color={theme.primary} />
              </View>
              <ThemedText type="body">{t.profile.language}</ThemedText>
            </View>
            <View style={[styles.settingRight, isRTL && styles.settingRightRTL]}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {getLanguageName(language, language)}
              </ThemedText>
              <Feather
                name={isRTL ? "chevron-left" : "chevron-right"}
                size={20}
                color={theme.textSecondary}
              />
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={[styles.settingRow, isRTL && styles.settingRowRTL]}>
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.secondary + "20" }]}>
                <Feather name="bell" size={20} color={theme.secondary} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText type="body" style={{ textAlign }}>{t.profile.notifications}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign }}>
                  {t.profile.notificationsDesc}
                </ThemedText>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
        </Card>

        <ThemedText type="h4" style={[styles.sectionTitle, { textAlign }]}>
          {t.profile.personalInfo}
        </ThemedText>

        <Card elevation={1} style={styles.settingsCard}>
          <Pressable
            style={[styles.settingRow, isRTL && styles.settingRowRTL]}
            onPress={handleOpenDemographicsModal}
          >
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="user" size={20} color={theme.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText type="body" style={{ textAlign }}>{t.demographics.dateOfBirthLabel}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign }}>
                  {formatDateOfBirth(user?.dateOfBirth)}
                </ThemedText>
              </View>
            </View>
            <Feather
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Pressable
            style={[styles.settingRow, isRTL && styles.settingRowRTL]}
            onPress={handleOpenDemographicsModal}
          >
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.secondary + "20" }]}>
                <Feather name="users" size={20} color={theme.secondary} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText type="body" style={{ textAlign }}>{t.demographics.genderLabel}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign }}>
                  {getGenderLabel(user?.gender ?? null)}
                </ThemedText>
              </View>
            </View>
            <Feather
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Pressable
            style={[styles.settingRow, isRTL && styles.settingRowRTL]}
            onPress={() => navigation.navigate("MedicalDocuments")}
          >
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="file-text" size={20} color={theme.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <ThemedText type="body" style={{ textAlign }}>{t.documents?.title || "Medical Documents"}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign }}>
                  {t.documents?.subtitle || "Upload and manage your medical records"}
                </ThemedText>
              </View>
            </View>
            <Feather
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        </Card>

        <ThemedText type="h4" style={[styles.sectionTitle, { textAlign }]}>
          {t.profile.account}
        </ThemedText>

        <Card elevation={1} style={styles.settingsCard}>
          <Pressable style={[styles.settingRow, isRTL && styles.settingRowRTL]} onPress={handleLogout}>
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="log-out" size={20} color={theme.warning} />
              </View>
              <ThemedText type="body">{t.profile.logout}</ThemedText>
            </View>
            <Feather
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Pressable style={[styles.settingRow, isRTL && styles.settingRowRTL]} onPress={handleDeleteAccount}>
            <View style={[styles.settingLeft, isRTL && styles.settingLeftRTL]}>
              <View style={[styles.settingIcon, { backgroundColor: theme.error + "20" }]}>
                <Feather name="trash-2" size={20} color={theme.error} />
              </View>
              <ThemedText type="body" style={{ color: theme.error }}>
                {t.profile.deleteAccount}
              </ThemedText>
            </View>
            <Feather
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        </Card>

        <View style={styles.versionContainer}>
          <ThemedText type="caption" style={[styles.version, { color: theme.textSecondary }]}>
            {t.profile.version}: {appVersion}
          </ThemedText>
          {backendVersion ? (
            <ThemedText type="caption" style={[styles.version, { color: theme.textSecondary }]}>
              {t.profile.backendVersion}: {backendVersion}
            </ThemedText>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal visible={showLanguageModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="h4">{t.profile.language}</ThemedText>
            <Pressable onPress={() => setShowLanguageModal(false)} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <Pressable
              style={[
                styles.languageOption,
                {
                  backgroundColor: language === "en" ? theme.primary + "20" : theme.backgroundDefault,
                  borderColor: language === "en" ? theme.primary : theme.border,
                },
              ]}
              onPress={() => handleLanguageChange("en")}
            >
              <ThemedText type="body">English</ThemedText>
              {language === "en" ? <Feather name="check" size={20} color={theme.primary} /> : null}
            </Pressable>

            <Pressable
              style={[
                styles.languageOption,
                {
                  backgroundColor: language === "he" ? theme.primary + "20" : theme.backgroundDefault,
                  borderColor: language === "he" ? theme.primary : theme.border,
                },
              ]}
              onPress={() => handleLanguageChange("he")}
            >
              <ThemedText type="body">עברית</ThemedText>
              {language === "he" ? <Feather name="check" size={20} color={theme.primary} /> : null}
            </Pressable>
          </View>
        </ThemedView>
      </Modal>

      <Modal visible={showLogoutModal} animationType="fade" transparent>
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModalContainer, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.confirmModalTitle}>
              {t.profile.logout}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              {t.common.confirm}?
            </ThemedText>
            <View style={styles.confirmModalButtons}>
              <Pressable
                style={[styles.confirmModalButton, { backgroundColor: theme.border }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText type="body">{t.common.cancel}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.confirmModalButton, { backgroundColor: theme.error }]}
                onPress={confirmLogout}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>{t.profile.logout}</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModalContainer, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.confirmModalTitle}>
              {t.profile.deleteAccount}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              {t.profile.deleteConfirm}
            </ThemedText>
            <View style={styles.confirmModalButtons}>
              <Pressable
                style={[styles.confirmModalButton, { backgroundColor: theme.border }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <ThemedText type="body">{t.common.cancel}</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.confirmModalButton, { backgroundColor: theme.error }]}
                onPress={confirmDeleteAccount}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>{t.common.delete}</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDemographicsModal} animationType="slide" presentationStyle="pageSheet">
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText type="h4">{t.demographics.editTitle}</ThemedText>
            <Pressable onPress={() => setShowDemographicsModal(false)} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <View style={styles.demographicsField}>
              <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                {t.demographics.dateOfBirthLabel}
              </ThemedText>
              <Pressable
                style={[
                  styles.demographicsInput,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText
                  type="body"
                  style={{ color: editingDateOfBirth ? theme.text : theme.textSecondary }}
                >
                  {editingDateOfBirth
                    ? editingDateOfBirth.toLocaleDateString(isRTL ? "he-IL" : "en-US")
                    : t.demographics.dateOfBirthPlaceholder}
                </ThemedText>
                <Feather name="calendar" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {showDatePicker && (
              <View style={{ alignItems: "center", marginBottom: Spacing.lg }}>
                <DateTimePicker
                  value={editingDateOfBirth || new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                />
                {Platform.OS === "ios" && (
                  <Button onPress={() => setShowDatePicker(false)} style={{ marginTop: Spacing.sm, width: 100 }}>
                    {t.common.done}
                  </Button>
                )}
              </View>
            )}

            <View style={styles.demographicsField}>
              <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                {t.demographics.genderLabel} ({t.demographics.genderOptional})
              </ThemedText>
              <View style={styles.genderOptions}>
                {[
                  { value: "male" as Gender, label: t.demographics.genderMale },
                  { value: "female" as Gender, label: t.demographics.genderFemale },
                  { value: "other" as Gender, label: t.demographics.genderOther },
                  { value: "preferNot" as Gender, label: t.demographics.genderPreferNot },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    style={[styles.radioRow, isRTL && styles.radioRowRTL]}
                    onPress={() => setEditingGender(option.value)}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: editingGender === option.value ? theme.primary : theme.border },
                      ]}
                    >
                      {editingGender === option.value ? (
                        <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                      ) : null}
                    </View>
                    <ThemedText type="body">{option.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <Button onPress={handleSaveDemographics} style={styles.saveButton}>
              {t.common.save}
            </Button>
          </View>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
    gap: Spacing.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  settingsCard: {
    padding: 0,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    minHeight: 60,
  },
  settingRowRTL: {
    flexDirection: "row-reverse",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  settingLeftRTL: {
    flexDirection: "row-reverse",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  settingRightRTL: {
    flexDirection: "row-reverse",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  versionContainer: {
    alignItems: "center",
    marginTop: Spacing["2xl"],
    gap: Spacing.xs,
  },
  version: {
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
    gap: Spacing.md,
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  confirmModalContainer: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
    alignItems: "center",
  },
  confirmModalTitle: {
    textAlign: "center",
  },
  confirmModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  demographicsField: {
    marginBottom: Spacing.lg,
  },
  demographicsInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
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
  saveButton: {
    width: "100%",
    height: 56,
    marginTop: Spacing.xl,
  },
});
