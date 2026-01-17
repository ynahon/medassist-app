import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import HomeScreen from "@/screens/HomeScreen";
import SurveysScreen from "@/screens/SurveysScreen";
import SuggestionsScreen from "@/screens/SuggestionsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Spacing, Shadows, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import HeaderTitle from "@/components/HeaderTitle";

export type MainTabParamList = {
  HomeTab: undefined;
  SurveysTab: undefined;
  SuggestionsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function FABButton() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("MonthlySurvey");
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: theme.primary,
          bottom: 50 + insets.bottom,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
        Shadows.large,
      ]}
      onPress={handlePress}
    >
      <Feather name="plus" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t, isRTL } = useApp();
  const screenOptions = useScreenOptions();
  const [activeTab, setActiveTab] = useState<string>("HomeTab");

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenListeners={{
          state: (e) => {
            const state = e.data.state;
            if (state) {
              const route = state.routes[state.index];
              setActiveTab(route.name);
            }
          },
        }}
        initialRouteName="HomeTab"
        screenOptions={{
          ...screenOptions,
          tabBarActiveTintColor: theme.tabIconSelected,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
            }),
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            title: t.home.greeting.split(",")[0],
            headerTitle: () => <HeaderTitle />,
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SurveysTab"
          component={SurveysScreen}
          options={{
            title: t.surveys.title,
            headerTitle: t.surveys.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name="clipboard" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SuggestionsTab"
          component={SuggestionsScreen}
          options={{
            title: t.suggestions.title,
            headerTitle: t.suggestions.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name="heart" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            title: t.profile.title,
            headerTitle: t.profile.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      {activeTab === "SurveysTab" ? <FABButton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: Spacing.xl,
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
