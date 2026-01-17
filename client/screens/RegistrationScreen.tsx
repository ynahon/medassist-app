import React, { useState } from "react";
import { View, StyleSheet, TextInput, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { normalizePhone } from "@/utils/phoneUtils";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Registration">;

export default function RegistrationScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t, isRTL } = useApp();
  const navigation = useNavigation<NavigationProp>();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; phone?: string }>({});

  const validateIdNumber = (id: string): boolean => {
    const cleanId = id.replace(/\D/g, "");
    return cleanId.length === 9;
  };

  const validatePhone = (phone: string): boolean => {
    const result = normalizePhone(phone);
    return result.ok;
  };

  const isValid =
    firstName.trim() &&
    lastName.trim() &&
    validateIdNumber(idNumber) &&
    validatePhone(phoneNumber) &&
    privacyAccepted;

  const handleIdChange = (text: string) => {
    setIdNumber(text);
    if (errors.id) {
      setErrors((prev) => ({ ...prev, id: undefined }));
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhoneNumber(text);
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handleSendCode = () => {
    const newErrors: { id?: string; phone?: string } = {};

    if (!validateIdNumber(idNumber)) {
      newErrors.id = t.auth.invalidId;
    }
    
    const phoneResult = normalizePhone(phoneNumber);
    if (!phoneResult.ok) {
      newErrors.phone = t.auth.invalidPhoneFormat;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const normalizedPhone = phoneResult.ok ? phoneResult.value : phoneNumber;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigation.navigate("OTPVerification", {
        firstName,
        lastName,
        idNumber: idNumber.replace(/\D/g, ""),
        phoneNumber: normalizedPhone,
        mode: "register",
      });
    }, 500);
  };

  const handlePrivacyPress = () => {
    setShowPrivacyNotice(true);
  };

  const handlePrivacyAccept = () => {
    setPrivacyAccepted(true);
    setShowPrivacyNotice(false);
  };

  const handleLoginPress = () => {
    navigation.navigate("Login");
  };

  const textAlign = isRTL ? "right" : "left";

  return (
    <>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.xl,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <ThemedText type="h2" style={[styles.title, { textAlign }]}>
          {t.auth.registerTitle}
        </ThemedText>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary, textAlign }]}>
              {t.auth.firstName}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                  textAlign,
                },
              ]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t.auth.firstName}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary, textAlign }]}>
              {t.auth.lastName}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                  textAlign,
                },
              ]}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t.auth.lastName}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary, textAlign }]}>
              {t.auth.idNumber}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: errors.id ? theme.error : theme.border,
                  textAlign,
                },
              ]}
              value={idNumber}
              onChangeText={handleIdChange}
              placeholder={t.auth.idNumber}
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={9}
            />
            {errors.id ? (
              <ThemedText type="caption" style={{ color: theme.error }}>
                {errors.id}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary, textAlign }]}>
              {t.auth.phoneNumber}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: errors.phone ? theme.error : theme.border,
                  textAlign,
                },
              ]}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder={t.auth.phoneNumber}
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            {errors.phone ? (
              <ThemedText type="caption" style={{ color: theme.error }}>
                {errors.phone}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <Pressable onPress={handlePrivacyPress} style={[styles.privacyCheckbox, isRTL && styles.privacyCheckboxRTL]}>
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: privacyAccepted ? theme.primary : "transparent",
                borderColor: privacyAccepted ? theme.primary : theme.border,
              },
            ]}
          >
            {privacyAccepted ? (
              <ThemedText style={{ color: "#fff", fontSize: 12 }}>✓</ThemedText>
            ) : null}
          </View>
          <ThemedText type="small" style={{ flex: 1, color: theme.primary, textAlign }}>
            {t.auth.privacyNotice}
          </ThemedText>
        </Pressable>

        <Button
          onPress={handleSendCode}
          disabled={!isValid || isLoading}
          style={styles.button}
        >
          {isLoading ? t.common.loading : t.auth.sendCode}
        </Button>

        <ThemedText type="caption" style={[styles.terms, { color: theme.textSecondary, textAlign: "center" }]}>
          {t.auth.termsPrefix} {t.auth.termsOfService} {t.auth.and} {t.auth.privacyPolicy}
        </ThemedText>

        <View style={styles.loginPrompt}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {t.auth.haveAccount}
          </ThemedText>
          <Pressable onPress={handleLoginPress}>
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
              {t.auth.login}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showPrivacyNotice}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyNotice(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h3" style={[styles.modalTitle, { textAlign }]}>
              {t.auth.privacyNotice}
            </ThemedText>
            <ThemedText style={[styles.modalText, { textAlign }]}>
              {t.auth.privacyNoticeText}
            </ThemedText>
            <Button onPress={handlePrivacyAccept} style={styles.modalButton}>
              {t.auth.iUnderstand}
            </Button>
            <Pressable onPress={() => setShowPrivacyNotice(false)}>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
                {t.common.cancel}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: Spacing["2xl"],
  },
  form: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {},
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  privacyCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  privacyCheckboxRTL: {
    flexDirection: "row-reverse",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    marginTop: Spacing.lg,
  },
  terms: {
    marginTop: Spacing.xl,
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    marginBottom: Spacing.lg,
  },
  modalText: {
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  modalButton: {
    marginTop: Spacing.md,
  },
});
