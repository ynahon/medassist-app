import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LanguageSelectionScreen from "@/screens/LanguageSelectionScreen";
import RegistrationScreen from "@/screens/RegistrationScreen";
import LoginScreen from "@/screens/LoginScreen";
import OTPVerificationScreen from "@/screens/OTPVerificationScreen";
import SurveyScreen from "@/screens/SurveyScreen";
import DemographicsScreen from "@/screens/DemographicsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useApp } from "@/contexts/AppContext";

export type OnboardingStackParamList = {
  LanguageSelection: undefined;
  Registration: undefined;
  Login: undefined;
  OTPVerification: {
    firstName: string;
    lastName: string;
    idNumber: string;
    phoneNumber: string;
    mode: "register" | "login";
  };
  Demographics: undefined;
  Survey: { isOnboarding?: boolean };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  const screenOptions = useScreenOptions();
  const { t, hasSelectedLanguage, user, isLoading } = useApp();

  if (isLoading) {
    return null;
  }

  return (
    <Stack.Navigator 
      screenOptions={screenOptions}
      key={`onboarding-${hasSelectedLanguage}-${user ? 'user' : 'no-user'}`}
    >
      {!hasSelectedLanguage ? (
        <Stack.Screen
          name="LanguageSelection"
          component={LanguageSelectionScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerTitle: t.auth.loginTitle }}
          />
          <Stack.Screen
            name="Registration"
            component={RegistrationScreen}
            options={{ headerTitle: t.auth.registerTitle }}
          />
          <Stack.Screen
            name="OTPVerification"
            component={OTPVerificationScreen}
            options={{ headerTitle: t.auth.verifyTitle }}
          />
          <Stack.Screen
            name="Demographics"
            component={DemographicsScreen}
            options={{ headerTitle: t.demographics.title }}
          />
          <Stack.Screen
            name="Survey"
            component={SurveyScreen}
            options={{ headerTitle: t.survey.onboardingTitle }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
