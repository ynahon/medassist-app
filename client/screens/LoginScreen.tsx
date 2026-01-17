import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { normalizePhone } from "@/utils/phoneUtils";
import { Language } from "@/i18n";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Login">;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t, isRTL, checkUserExists, language, setLanguage } = useApp();
  const navigation = useNavigation<NavigationProp>();

  const [idNumber, setIdNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const validateIdNumber = (id: string): boolean => {
    const cleanId = id.replace(/\D/g, "");
    return cleanId.length === 9;
  };

  const validatePhone = (phone: string): boolean => {
    const result = normalizePhone(phone);
    return result.ok;
  };

  const isValid = validateIdNumber(idNumber) && validatePhone(phoneNumber);

  const handleIdChange = (text: string) => {
    setIdNumber(text);
    if (message) setMessage(null);
  };

  const handlePhoneChange = (text: string) => {
    setPhoneNumber(text);
    if (message) setMessage(null);
  };

  const handleLogin = async () => {
    if (!validateIdNumber(idNumber)) {
      setMessage({ text: t.auth.invalidId, type: "error" });
      return;
    }
    
    const phoneResult = normalizePhone(phoneNumber);
    if (!phoneResult.ok) {
      setMessage({ text: t.auth.invalidPhoneFormat, type: "error" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const cleanId = idNumber.replace(/\D/g, "");
      const normalizedPhone = phoneResult.value;
      const result = await checkUserExists(cleanId, normalizedPhone);

      if (!result.exists) {
        setMessage({ text: t.auth.invalidCredentials, type: "error" });
        setIsLoading(false);
        return;
      }

      navigation.navigate("OTPVerification", {
        firstName: result.user?.firstName || "",
        lastName: result.user?.lastName || "",
        idNumber: cleanId,
        phoneNumber: normalizedPhone,
        mode: "login",
      });
    } catch (err) {
      setMessage({ text: t.common.error, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterPress = () => {
    navigation.navigate("Registration");
  };

  const toggleLanguage = () => {
    const newLang: Language = language === "en" ? "he" : "en";
    setLanguage(newLang);
  };

  const textAlign = isRTL ? "right" : "left";

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.xl,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Pressable
        style={[styles.languageToggle, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
        onPress={toggleLanguage}
      >
        <Feather name="globe" size={18} color={theme.primary} />
        <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
          {language === "en" ? "עברית" : "Eng"}
        </ThemedText>
      </Pressable>

      <ThemedText type="h2" style={[styles.title, { textAlign }]}>
        {t.auth.loginTitle}
      </ThemedText>

      <ThemedText style={[styles.subtitle, { color: theme.textSecondary, textAlign }]}>
        {t.auth.welcome}
      </ThemedText>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <ThemedText type="small" style={[styles.label, { color: theme.textSecondary, textAlign }]}>
            {t.auth.idNumberShort}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: message?.type === "error" ? theme.error : theme.border,
                textAlign: "left",
              },
            ]}
            value={idNumber}
            onChangeText={handleIdChange}
            placeholder=""
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            maxLength={9}
          />
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
                borderColor: message?.type === "error" ? theme.error : theme.border,
                textAlign: "left",
              },
            ]}
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            placeholder=""
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        </View>

        {message ? (
          <ThemedText 
            type="small" 
            style={[
              styles.messageText, 
              { color: message.type === "success" ? theme.success : theme.error }
            ]}
          >
            {message.text}
          </ThemedText>
        ) : null}
      </View>

      <Button
        onPress={handleLogin}
        disabled={!isValid || isLoading}
        style={styles.button}
      >
        {isLoading ? t.common.loading : t.auth.sendCode}
      </Button>

      <View style={styles.registerPrompt}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {t.auth.newUser}
        </ThemedText>
        <Pressable onPress={handleRegisterPress}>
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
            {t.auth.register}
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  languageToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
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
  messageText: {
    textAlign: "center",
  },
  button: {
    marginTop: Spacing.lg,
  },
  registerPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
});
