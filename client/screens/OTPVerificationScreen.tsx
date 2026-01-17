import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "OTPVerification">;
type ScreenRouteProp = RouteProp<OnboardingStackParamList, "OTPVerification">;

const OTP_LENGTH = 6;
const RESEND_TIMEOUT = 60;

export default function OTPVerificationScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t, registerUser, loginUser, setOnboardingComplete } = useApp();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();

  const { firstName, lastName, idNumber, phoneNumber, mode } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    sendOTP();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const sendOTP = async () => {
    setIsSending(true);
    setError(null);
    setDevCode(null);

    try {
      const response = await apiRequest("POST", "/api/auth/send-otp", { phoneNumber });
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Failed to send verification code.");
        return;
      }
      
      if (data.devCode) {
        setDevCode(data.devCode);
      }
    } catch (err: any) {
      console.error("Failed to send OTP:", err);
      setError("Failed to send verification code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      setError(t.auth.invalidCode);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", { 
        phoneNumber, 
        code 
      });
      
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || t.auth.invalidCode);
        setIsLoading(false);
        return;
      }

      if (mode === "register") {
        const result = await registerUser({
          firstName,
          lastName,
          idNumber,
          phoneNumber,
        });

        if (!result.success) {
          if (result.error === "alreadyRegistered") {
            setError(t.auth.alreadyRegistered);
          } else {
            setError(t.common.error);
          }
          setIsLoading(false);
          return;
        }

        navigation.navigate("Demographics");
      } else {
        const result = await loginUser(idNumber, phoneNumber);

        if (!result.success) {
          setError(t.auth.userNotFound);
          setIsLoading(false);
          return;
        }

        await setOnboardingComplete(true);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError(t.common.error);
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setResendTimer(RESEND_TIMEOUT);
    setOtp(Array(OTP_LENGTH).fill(""));
    sendOTP();
  };

  const isComplete = otp.every((digit) => digit !== "");

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <ThemedText type="h2" style={styles.title}>
          {t.auth.verifyTitle}
        </ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t.auth.enterCode}
        </ThemedText>
        <ThemedText type="body" style={styles.phone}>
          {phoneNumber}
        </ThemedText>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: digit ? theme.primary : theme.border,
                  color: theme.text,
                },
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value.slice(-1), index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              editable={!isLoading && !isSending}
            />
          ))}
        </View>

        {devCode ? (
          <ThemedText type="caption" style={[styles.hint, { color: theme.textSecondary }]}>
            Dev code: {devCode}
          </ThemedText>
        ) : null}

        {error ? (
          <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
            {error}
          </ThemedText>
        ) : null}

        <Button
          onPress={handleVerify}
          disabled={!isComplete || isLoading || isSending}
          style={styles.button}
        >
          {isLoading ? t.auth.verifying : isSending ? t.common.loading : t.common.confirm}
        </Button>

        {resendTimer > 0 ? (
          <ThemedText type="small" style={[styles.resendText, { color: theme.textSecondary }]}>
            {t.auth.resendIn} {resendTimer} {t.auth.seconds}
          </ThemedText>
        ) : (
          <Pressable onPress={handleResend} disabled={isSending}>
            <ThemedText type="link" style={styles.resendText}>
              {t.auth.resendCode}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: "center",
  },
  phone: {
    textAlign: "center",
    fontWeight: "600",
    marginTop: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  otpContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  hint: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  errorText: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  button: {
    width: "100%",
  },
  resendText: {
    textAlign: "center",
    marginTop: Spacing.xl,
  },
});
