import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface CardProps {
  elevation?: number;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: "default" | "outlined" | "filled";
  noPadding?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  elevation = 1,
  title,
  description,
  children,
  onPress,
  style,
  variant = "default",
  noPadding = false,
}: CardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const getCardStyle = () => {
    switch (variant) {
      case "outlined":
        return {
          backgroundColor: theme.cardBackground,
          borderWidth: 1,
          borderColor: theme.cardBorder,
        };
      case "filled":
        return {
          backgroundColor: theme.backgroundSecondary,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: theme.cardBackground,
          borderWidth: 1,
          borderColor: theme.cardBorder,
        };
    }
  };

  const getShadow = () => {
    switch (elevation) {
      case 0:
        return Shadows.none;
      case 1:
        return Shadows.small;
      case 2:
        return Shadows.medium;
      case 3:
        return Shadows.large;
      default:
        return Shadows.small;
    }
  };

  const cardStyle = getCardStyle();
  const shadow = getShadow();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      style={[
        styles.card,
        cardStyle,
        shadow,
        !noPadding && styles.cardPadding,
        animatedStyle,
        style,
      ]}
    >
      {title ? (
        <ThemedText type="h4" style={styles.cardTitle}>
          {title}
        </ThemedText>
      ) : null}
      {description ? (
        <ThemedText type="small" style={[styles.cardDescription, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  cardPadding: {
    padding: Spacing.xl,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    marginBottom: Spacing.md,
  },
});
