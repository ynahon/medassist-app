import { en, Translations } from "./en";
import { he } from "./he";

export type Language = "en" | "he";

export const translations: Record<Language, Translations> = {
  en,
  he,
};

export const isRTL = (language: Language): boolean => language === "he";

export const getLanguageName = (language: Language, inLanguage: Language): string => {
  const names: Record<Language, Record<Language, string>> = {
    en: { en: "English", he: "Hebrew" },
    he: { en: "אנגלית", he: "עברית" },
  };
  return names[inLanguage][language];
};

export { en, he };
export type { Translations };
