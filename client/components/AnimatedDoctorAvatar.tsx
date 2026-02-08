import React, { useEffect } from "react";
import { View, StyleSheet, Image, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

const doctorImage = require("@/assets/images/doctor-avatar.png");

type AvatarState = "idle" | "talking" | "listening";

interface AnimatedDoctorAvatarProps {
  state: AvatarState;
  size?: "large" | "small" | "inline";
}

export function AnimatedDoctorAvatar({
  state,
  size = "large",
}: AnimatedDoctorAvatarProps) {
  const { theme } = useTheme();

  const breathe = useSharedValue(0);
  const headTilt = useSharedValue(0);
  const glow = useSharedValue(0);
  const talkPulse = useSharedValue(0);
  const listenScale = useSharedValue(0);
  const waveBar1 = useSharedValue(0);
  const waveBar2 = useSharedValue(0);
  const waveBar3 = useSharedValue(0);
  const waveBar4 = useSharedValue(0);
  const waveBar5 = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    headTilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (state === "talking") {
      talkPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 250, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.1, { duration: 200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );

      waveBar1.value = withRepeat(withSequence(withTiming(1, { duration: 200 }), withTiming(0.2, { duration: 300 })), -1, false);
      waveBar2.value = withDelay(80, withRepeat(withSequence(withTiming(1, { duration: 250 }), withTiming(0.15, { duration: 280 })), -1, false));
      waveBar3.value = withDelay(160, withRepeat(withSequence(withTiming(1, { duration: 180 }), withTiming(0.3, { duration: 320 })), -1, false));
      waveBar4.value = withDelay(100, withRepeat(withSequence(withTiming(1, { duration: 220 }), withTiming(0.1, { duration: 260 })), -1, false));
      waveBar5.value = withDelay(140, withRepeat(withSequence(withTiming(1, { duration: 240 }), withTiming(0.25, { duration: 290 })), -1, false));
    } else {
      talkPulse.value = withTiming(0, { duration: 300 });
      waveBar1.value = withTiming(0, { duration: 300 });
      waveBar2.value = withTiming(0, { duration: 300 });
      waveBar3.value = withTiming(0, { duration: 300 });
      waveBar4.value = withTiming(0, { duration: 300 });
      waveBar5.value = withTiming(0, { duration: 300 });
    }

    if (state === "listening") {
      listenScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      listenScale.value = withTiming(0, { duration: 400 });
    }

    if (state === "idle") {
      glow.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [state]);

  const dimensions = size === "large" ? 140 : size === "small" ? 80 : 32;
  const ringPadding = size === "large" ? 8 : size === "small" ? 5 : 2;
  const outerSize = dimensions + ringPadding * 2;

  const containerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(breathe.value, [0, 1], [0, size === "large" ? -4 : -2]);
    const rotate = interpolate(headTilt.value, [-1, 0, 1], [-1.5, 0, 1.5]);

    return {
      transform: [
        { translateY },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const glowRingStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glow.value, [0, 1], [0.2, 0.8]);
    const scale = interpolate(glow.value, [0, 1], [1, 1.08]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const talkIndicatorStyle = useAnimatedStyle(() => {
    const scale = interpolate(talkPulse.value, [0, 1], [0.6, 1]);
    const opacity = interpolate(talkPulse.value, [0, 1], [0.4, 1]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const listenRingStyle = useAnimatedStyle(() => {
    const scale = interpolate(listenScale.value, [0, 1], [1, 1.3]);
    const opacity = interpolate(listenScale.value, [0, 1], [0.6, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const makeWaveStyle = (waveValue: { value: number }, maxHeight: number) =>
    useAnimatedStyle(() => ({
      height: interpolate(waveValue.value, [0, 1], [4, maxHeight]),
    }));

  const wave1Style = makeWaveStyle(waveBar1, size === "large" ? 20 : 10);
  const wave2Style = makeWaveStyle(waveBar2, size === "large" ? 28 : 14);
  const wave3Style = makeWaveStyle(waveBar3, size === "large" ? 24 : 12);
  const wave4Style = makeWaveStyle(waveBar4, size === "large" ? 18 : 9);
  const wave5Style = makeWaveStyle(waveBar5, size === "large" ? 22 : 11);

  if (size === "inline") {
    return (
      <View style={[styles.inlineContainer, { backgroundColor: theme.primary + "15" }]}>
        <Image
          source={doctorImage}
          style={styles.inlineImage}
        />
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={[{ alignItems: "center" }, containerStyle]}>
        <View style={[styles.outerRing, { width: outerSize, height: outerSize, borderRadius: outerSize / 2 }]}>
          <Animated.View
            style={[
              styles.glowRing,
              {
                width: outerSize + 12,
                height: outerSize + 12,
                borderRadius: (outerSize + 12) / 2,
                borderColor: state === "listening" ? theme.error : theme.primary,
              },
              glowRingStyle,
            ]}
          />

          {state === "listening" ? (
            <Animated.View
              style={[
                styles.listenPulseRing,
                {
                  width: outerSize + 20,
                  height: outerSize + 20,
                  borderRadius: (outerSize + 20) / 2,
                  borderColor: theme.error,
                },
                listenRingStyle,
              ]}
            />
          ) : null}

          <View
            style={[
              styles.imageContainer,
              {
                width: dimensions,
                height: dimensions,
                borderRadius: dimensions / 2,
                borderColor: state === "talking" ? theme.primary : state === "listening" ? theme.error : theme.primary + "60",
                borderWidth: size === "large" ? 3 : 2,
              },
            ]}
          >
            <Image
              source={doctorImage}
              style={[
                styles.avatarImage,
                {
                  width: dimensions - (size === "large" ? 6 : 4),
                  height: dimensions - (size === "large" ? 6 : 4),
                  borderRadius: (dimensions - (size === "large" ? 6 : 4)) / 2,
                },
              ]}
            />
          </View>

          {state === "talking" ? (
            <Animated.View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: theme.primary,
                  bottom: size === "large" ? 4 : 0,
                  right: size === "large" ? 4 : 0,
                },
                talkIndicatorStyle,
              ]}
            >
              <Feather name="volume-2" size={size === "large" ? 14 : 10} color="#FFF" />
            </Animated.View>
          ) : null}

          {state === "listening" ? (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: theme.error,
                  bottom: size === "large" ? 4 : 0,
                  right: size === "large" ? 4 : 0,
                },
              ]}
            >
              <Feather name="mic" size={size === "large" ? 14 : 10} color="#FFF" />
            </View>
          ) : null}

          {state === "idle" ? (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: "#22C55E",
                  bottom: size === "large" ? 4 : 0,
                  right: size === "large" ? 4 : 0,
                  width: size === "large" ? 20 : 14,
                  height: size === "large" ? 20 : 14,
                  borderRadius: size === "large" ? 10 : 7,
                },
              ]}
            >
              <View style={[styles.onlineDot, { width: size === "large" ? 8 : 6, height: size === "large" ? 8 : 6 }]} />
            </View>
          ) : null}
        </View>
      </Animated.View>

      {state === "talking" && size === "large" ? (
        <View style={styles.waveContainer}>
          {[wave1Style, wave2Style, wave3Style, wave4Style, wave5Style].map((wStyle, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                { backgroundColor: theme.primary },
                wStyle,
              ]}
            />
          ))}
        </View>
      ) : null}

      {state === "listening" && size === "large" ? (
        <View style={styles.waveContainer}>
          {[wave1Style, wave2Style, wave3Style, wave4Style, wave5Style].map((wStyle, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveBar,
                { backgroundColor: theme.error },
                wStyle,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outerRing: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glowRing: {
    position: "absolute",
    borderWidth: 2,
  },
  listenPulseRing: {
    position: "absolute",
    borderWidth: 2,
  },
  imageContainer: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    resizeMode: "cover",
  },
  statusBadge: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  onlineDot: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  inlineContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 2,
  },
  inlineImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: "cover",
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 12,
    height: 30,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
});
