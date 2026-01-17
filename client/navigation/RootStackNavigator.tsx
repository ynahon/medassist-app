import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import OnboardingNavigator from "@/navigation/OnboardingNavigator";
import SurveyScreen from "@/screens/SurveyScreen";
import MedicalDocumentsScreen from "@/screens/MedicalDocumentsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  MonthlySurvey: undefined;
  MedicalDocuments: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isOnboardingComplete, isLoading, t } = useApp();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const isAuthenticated = !!user && isOnboardingComplete;

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MonthlySurvey"
            component={SurveyScreen}
            options={{
              presentation: "modal",
              headerTitle: t.survey.monthlyTitle,
            }}
          />
          <Stack.Screen
            name="MedicalDocuments"
            component={MedicalDocumentsScreen}
            options={{
              presentation: "modal",
              headerTitle: t.documents?.title || "Medical Documents",
            }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingNavigator}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
