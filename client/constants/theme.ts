import { Platform } from "react-native";

const primaryLight = "#2563EB";
const primaryDark = "#3B82F6";
const accentLight = "#F97316";
const accentDark = "#FB923C";
const successLight = "#10B981";
const successDark = "#34D399";

export const Colors = {
  light: {
    text: "#1F2937",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9CA3AF",
    tabIconSelected: primaryLight,
    link: primaryLight,
    primary: primaryLight,
    primaryHover: "#1D4ED8",
    secondary: "#E5E7EB",
    accent: accentLight,
    accentHover: "#EA580C",
    error: "#EF4444",
    errorLight: "#FEE2E2",
    success: successLight,
    successLight: "#D1FAE5",
    warning: "#F59E0B",
    warningLight: "#FEF3C7",
    info: "#3B82F6",
    infoLight: "#DBEAFE",
    backgroundRoot: "#F3F4F6",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F9FAFB",
    backgroundTertiary: "#E5E7EB",
    border: "#E5E7EB",
    borderFocus: primaryLight,
    cardBorder: "#E5E7EB",
    cardBackground: "#FFFFFF",
    inputBackground: "#FFFFFF",
    inputBorder: "#D1D5DB",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#D1D5DB",
    textMuted: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: primaryDark,
    link: primaryDark,
    primary: primaryDark,
    primaryHover: "#2563EB",
    secondary: "#374151",
    accent: accentDark,
    accentHover: "#F97316",
    error: "#F87171",
    errorLight: "#450A0A",
    success: successDark,
    successLight: "#064E3B",
    warning: "#FBBF24",
    warningLight: "#451A03",
    info: "#60A5FA",
    infoLight: "#1E3A5F",
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
    border: "#374151",
    borderFocus: primaryDark,
    cardBorder: "#374151",
    cardBackground: "#1F2937",
    inputBackground: "#374151",
    inputBorder: "#4B5563",
    overlay: "rgba(0, 0, 0, 0.7)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 60,
  inputHeight: 52,
  buttonHeight: 56,
  fabSize: 64,
  minTouchTarget: 44,
};

export const BorderRadius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 36,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: "400" as const,
    lineHeight: 28,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 16,
  },
  link: {
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 24,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
};

export const Shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
});

export const Transitions = {
  fast: 150,
  normal: 250,
  slow: 400,
};
