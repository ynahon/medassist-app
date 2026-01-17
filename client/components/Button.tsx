import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  variant = "primary",
  size = "md",
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.97, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const getButtonStyle = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: theme.primary,
          borderColor: "transparent",
        };
      case "secondary":
        return {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
        };
      case "accent":
        return {
          backgroundColor: theme.accent,
          borderColor: "transparent",
        };
      case "danger":
        return {
          backgroundColor: theme.error,
          borderColor: "transparent",
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
          borderColor: theme.border,
        };
      default:
        return {
          backgroundColor: theme.primary,
          borderColor: "transparent",
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "secondary":
        return theme.text;
      case "ghost":
        return theme.primary;
      default:
        return theme.buttonText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm":
        return {
          height: 40,
          paddingHorizontal: Spacing.lg,
        };
      case "lg":
        return {
          height: 60,
          paddingHorizontal: Spacing["3xl"],
        };
      default:
        return {
          height: Spacing.buttonHeight,
          paddingHorizontal: Spacing["2xl"],
        };
    }
  };

  const buttonStyle = getButtonStyle();
  const sizeStyle = getSizeStyle();

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.button,
        buttonStyle,
        sizeStyle,
        variant !== "ghost" && Shadows.small,
        {
          opacity: disabled ? 0.5 : 1,
        },
        style,
        animatedStyle,
      ]}
    >
      <ThemedText
        type="body"
        style={[styles.buttonText, { color: getTextColor() }]}
      >
        {children}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexDirection: "row",
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
  },
});
