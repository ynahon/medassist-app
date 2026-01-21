import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { I18nManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, translations, isRTL, Translations } from "@/i18n";
import { apiRequest } from "@/lib/query-client";

const STORAGE_KEYS = {
  LANGUAGE: "@medassist_language",
  LANGUAGE_SELECTED: "@medassist_language_selected",
  USER: "@medassist_user",
  SURVEYS: "@medassist_surveys",
  RECOMMENDATIONS: "@medassist_recommendations",
  ONBOARDING_COMPLETE: "@medassist_onboarding_complete",
  NOTIFICATIONS_ENABLED: "@medassist_notifications",
  HIDE_NOT_NEEDED: "@medassist_hide_not_needed",
};

export type Gender = "male" | "female" | "other" | "preferNot" | null;

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  idNumberHash: string;
  idNumberMasked: string;
  phoneNumber: string;
  createdAt: string;
  dateOfBirth?: string;
  gender?: Gender;
}

export interface SurveyResponse {
  id: string;
  date: string;
  feeling: string;
  symptoms: string[];
  timing: string;
  painLevel: number;
  notes?: string;
  deletedAt?: string;
}

export type RecommendationStatus = "pending" | "done" | "irrelevant" | "not_needed";
export type RecommendationCategory = "checkup" | "vaccine" | "lifestyle" | "followup";
export type RecommendationSource = "ai" | "manual";

export interface Recommendation {
  id: string;
  userId: string;
  source: RecommendationSource;
  title: string;
  category: RecommendationCategory;
  rationale: string;
  suggestedTiming: string;
  priority: number;
  clinicianPrompt?: string;
  status: RecommendationStatus;
  completedAt?: string;
  userNote?: string;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationEvent {
  id: string;
  recommendationId: string;
  fromStatus: RecommendationStatus;
  toStatus: RecommendationStatus;
  note?: string;
  changedAt: string;
}

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  hasSelectedLanguage: boolean;
  t: Translations;
  isRTL: boolean;
  user: User | null;
  setUser: (user: User | null) => Promise<void>;
  surveys: SurveyResponse[];
  activeSurveys: SurveyResponse[];
  addSurvey: (survey: Omit<SurveyResponse, "id" | "date">) => Promise<void>;
  deleteSurvey: (surveyId: string) => Promise<void>;
  recommendations: Recommendation[];
  addRecommendation: (recommendation: Omit<Recommendation, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<void>;
  updateRecommendationStatus: (
    id: string,
    status: RecommendationStatus,
    options?: { completedAt?: string; userNote?: string; statusReason?: string }
  ) => Promise<void>;
  deleteRecommendation: (id: string) => Promise<void>;
  clearRecommendations: () => Promise<void>;
  hideNotNeeded: boolean;
  setHideNotNeeded: (hide: boolean) => Promise<void>;
  isOnboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => Promise<void>;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  registerUser: (userData: {
    firstName: string;
    lastName: string;
    idNumber: string;
    phoneNumber: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginUser: (idNumber: string, phoneNumber: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  checkUserExists: (idNumber: string, phoneNumber: string) => Promise<{ exists: boolean; user?: User }>;
  updateUserDemographics: (demographics: { dateOfBirth?: string; gender?: Gender }) => Promise<void>;
}

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

const maskIdNumber = (idNumber: string): string => {
  if (idNumber.length <= 4) return "****";
  return "*".repeat(idNumber.length - 4) + idNumber.slice(-4);
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [user, setUserState] = useState<User | null>(null);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isOnboardingComplete, setOnboardingCompleteState] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [hideNotNeeded, setHideNotNeededState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const activeSurveys = surveys.filter(s => !s.deletedAt);

  useEffect(() => {
    loadAppState();
  }, []);

  const loadAppState = async () => {
    try {
      const [
        savedLanguage,
        savedLanguageSelected,
        savedUser,
        savedRecommendations,
        savedOnboarding,
        savedNotifications,
        savedHideNotNeeded,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE_SELECTED),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.RECOMMENDATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
        AsyncStorage.getItem(STORAGE_KEYS.HIDE_NOT_NEEDED),
      ]);

      if (savedLanguage) {
        setLanguageState(savedLanguage as Language);
        const rtl = isRTL(savedLanguage as Language);
        if (I18nManager.isRTL !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
        }
      }
      if (savedLanguageSelected === "true") {
        setHasSelectedLanguage(true);
      }
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUserState(parsedUser);
        // Load surveys from server for logged-in user
        try {
          const response = await apiRequest("GET", `/api/surveys/${parsedUser.id}`);
          const data = await response.json();
          if (data.surveys) {
            const mappedSurveys: SurveyResponse[] = data.surveys.map((s: any) => ({
              id: s.id,
              date: s.date,
              feeling: s.feeling,
              symptoms: typeof s.symptoms === 'string' ? JSON.parse(s.symptoms) : s.symptoms,
              timing: s.timing,
              painLevel: s.painLevel,
              notes: s.notes,
              deletedAt: s.deletedAt,
            }));
            setSurveys(mappedSurveys);
          }
        } catch (surveyError) {
          console.error("Error loading surveys from server:", surveyError);
        }
      }
      if (savedRecommendations) setRecommendations(JSON.parse(savedRecommendations));
      if (savedOnboarding) setOnboardingCompleteState(savedOnboarding === "true");
      if (savedNotifications !== null) setNotificationsEnabledState(savedNotifications === "true");
      if (savedHideNotNeeded !== null) setHideNotNeededState(savedHideNotNeeded === "true");
    } catch (error) {
      console.error("Error loading app state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE_SELECTED, "true");
      setLanguageState(lang);
      setHasSelectedLanguage(true);
      const rtl = isRTL(lang);
      if (I18nManager.isRTL !== rtl) {
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      }
    } catch (error) {
      console.error("Error setting language:", error);
    }
  }, []);

  const setUser = useCallback(async (newUser: User | null) => {
    try {
      if (newUser) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      }
      setUserState(newUser);
    } catch (error) {
      console.error("Error setting user:", error);
    }
  }, []);

  const registerUser = useCallback(async (userData: {
    firstName: string;
    lastName: string;
    idNumber: string;
    phoneNumber: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiRequest("POST", "/api/auth/register", userData);
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.includes("already exists")) {
          return { success: false, error: "alreadyRegistered" };
        }
        return { success: false, error: data.error || "unknown" };
      }

      const serverUser = data.user;
      const newUser: User = {
        id: serverUser.id,
        firstName: serverUser.firstName,
        lastName: serverUser.lastName,
        idNumberHash: simpleHash(userData.idNumber),
        idNumberMasked: maskIdNumber(userData.idNumber),
        phoneNumber: serverUser.phoneNumber,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      setUserState(newUser);

      return { success: true };
    } catch (error) {
      console.error("Error registering user:", error);
      return { success: false, error: "unknown" };
    }
  }, []);

  const loginUser = useCallback(async (
    idNumber: string,
    phoneNumber: string
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { idNumber, phoneNumber });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: "userNotFound" };
        }
        return { success: false, error: data.error || "unknown" };
      }

      const serverUser = data.user;
      const foundUser: User = {
        id: serverUser.id,
        firstName: serverUser.firstName,
        lastName: serverUser.lastName,
        idNumberHash: simpleHash(idNumber),
        idNumberMasked: maskIdNumber(idNumber),
        phoneNumber: serverUser.phoneNumber,
        createdAt: serverUser.createdAt || new Date().toISOString(),
        dateOfBirth: serverUser.dateOfBirth,
        gender: serverUser.gender,
      };

      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(foundUser));
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, "true");
      setUserState(foundUser);
      setOnboardingCompleteState(true);

      // Load surveys from server after login
      try {
        const surveysResponse = await apiRequest("GET", `/api/surveys/${foundUser.id}`);
        const surveysData = await surveysResponse.json();
        if (surveysData.surveys) {
          const mappedSurveys: SurveyResponse[] = surveysData.surveys.map((s: any) => ({
            id: s.id,
            date: s.date,
            feeling: s.feeling,
            symptoms: typeof s.symptoms === 'string' ? JSON.parse(s.symptoms) : s.symptoms,
            timing: s.timing,
            painLevel: s.painLevel,
            notes: s.notes,
            deletedAt: s.deletedAt,
          }));
          setSurveys(mappedSurveys);
        }
      } catch (surveyError) {
        console.error("Error loading surveys after login:", surveyError);
      }

      return { success: true, user: foundUser };
    } catch (error) {
      console.error("Error logging in:", error);
      return { success: false, error: "unknown" };
    }
  }, []);

  const checkUserExists = useCallback(async (
    idNumber: string,
    phoneNumber: string
  ): Promise<{ exists: boolean; user?: User }> => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { idNumber, phoneNumber });
      if (response.ok) {
        const data = await response.json();
        const serverUser = data.user;
        const foundUser: User = {
          id: serverUser.id,
          firstName: serverUser.firstName,
          lastName: serverUser.lastName,
          idNumberHash: simpleHash(idNumber),
          idNumberMasked: maskIdNumber(idNumber),
          phoneNumber: serverUser.phoneNumber,
          createdAt: serverUser.createdAt || new Date().toISOString(),
          dateOfBirth: serverUser.dateOfBirth,
          gender: serverUser.gender,
        };
        return { exists: true, user: foundUser };
      }
      return { exists: false };
    } catch (error) {
      console.error("Error checking user:", error);
      return { exists: false };
    }
  }, []);

  const loadSurveysFromServer = useCallback(async (userId: string) => {
    try {
      const response = await apiRequest("GET", `/api/surveys/${userId}`);
      const data = await response.json();
      if (data.surveys) {
        const mappedSurveys: SurveyResponse[] = data.surveys.map((s: any) => ({
          id: s.id,
          date: s.date,
          feeling: s.feeling,
          symptoms: typeof s.symptoms === 'string' ? JSON.parse(s.symptoms) : s.symptoms,
          timing: s.timing,
          painLevel: s.painLevel,
          notes: s.notes,
          deletedAt: s.deletedAt,
        }));
        setSurveys(mappedSurveys);
      }
    } catch (error) {
      console.error("Error loading surveys from server:", error);
    }
  }, []);

  const addSurvey = useCallback(async (surveyData: Omit<SurveyResponse, "id" | "date">) => {
    if (!user) return;
    try {
      const response = await apiRequest("POST", "/api/surveys", {
        userId: user.id,
        ...surveyData,
      });
      const data = await response.json();
      if (data.success && data.survey) {
        const newSurvey: SurveyResponse = {
          id: data.survey.id,
          date: data.survey.date,
          feeling: data.survey.feeling,
          symptoms: data.survey.symptoms,
          timing: data.survey.timing,
          painLevel: data.survey.painLevel,
          notes: data.survey.notes,
          deletedAt: data.survey.deletedAt,
        };
        setSurveys(prev => [newSurvey, ...prev]);
      }
    } catch (error) {
      console.error("Error adding survey:", error);
    }
  }, [user]);

  const deleteSurvey = useCallback(async (surveyId: string) => {
    try {
      const response = await apiRequest("DELETE", `/api/surveys/${surveyId}`);
      const data = await response.json();
      if (data.success) {
        setSurveys(prev => prev.map((survey) => {
          if (survey.id === surveyId) {
            return { ...survey, deletedAt: new Date().toISOString() };
          }
          return survey;
        }));
      }
    } catch (error) {
      console.error("Error deleting survey:", error);
    }
  }, []);

  const setHideNotNeeded = useCallback(async (hide: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HIDE_NOT_NEEDED, hide.toString());
      setHideNotNeededState(hide);
    } catch (error) {
      console.error("Error setting hide not needed:", error);
    }
  }, []);

  const addRecommendation = useCallback(async (
    recommendationData: Omit<Recommendation, "id" | "userId" | "createdAt" | "updatedAt">
  ) => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      const newRecommendation: Recommendation = {
        ...recommendationData,
        id: Date.now().toString(),
        userId: user.id,
        createdAt: now,
        updatedAt: now,
      };
      const updatedRecommendations = [newRecommendation, ...recommendations];
      await AsyncStorage.setItem(STORAGE_KEYS.RECOMMENDATIONS, JSON.stringify(updatedRecommendations));
      setRecommendations(updatedRecommendations);
    } catch (error) {
      console.error("Error adding recommendation:", error);
    }
  }, [user, recommendations]);

  const updateRecommendationStatus = useCallback(async (
    id: string,
    status: RecommendationStatus,
    options?: { completedAt?: string; userNote?: string; statusReason?: string }
  ) => {
    try {
      const updatedRecommendations = recommendations.map((rec) => {
        if (rec.id === id) {
          return {
            ...rec,
            status,
            completedAt: options?.completedAt ?? rec.completedAt,
            userNote: options?.userNote ?? rec.userNote,
            statusReason: options?.statusReason ?? rec.statusReason,
            updatedAt: new Date().toISOString(),
          };
        }
        return rec;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.RECOMMENDATIONS, JSON.stringify(updatedRecommendations));
      setRecommendations(updatedRecommendations);
    } catch (error) {
      console.error("Error updating recommendation status:", error);
    }
  }, [recommendations]);

  const deleteRecommendation = useCallback(async (id: string) => {
    try {
      const updatedRecommendations = recommendations.filter((rec) => rec.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.RECOMMENDATIONS, JSON.stringify(updatedRecommendations));
      setRecommendations(updatedRecommendations);
    } catch (error) {
      console.error("Error deleting recommendation:", error);
      throw error;
    }
  }, [recommendations]);

  const clearRecommendations = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS);
      setRecommendations([]);
    } catch (error) {
      console.error("Error clearing recommendations:", error);
    }
  }, []);

  const setOnboardingComplete = useCallback(async (complete: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, complete.toString());
      setOnboardingCompleteState(complete);
    } catch (error) {
      console.error("Error setting onboarding complete:", error);
    }
  }, []);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled.toString());
      setNotificationsEnabledState(enabled);
    } catch (error) {
      console.error("Error setting notifications:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    setUserState(null);
    setOnboardingCompleteState(false);
    setHasSelectedLanguage(false);
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
        AsyncStorage.removeItem(STORAGE_KEYS.LANGUAGE_SELECTED),
      ]);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setUserState(null);
    setSurveys([]);
    setRecommendations([]);
    setOnboardingCompleteState(false);
    setNotificationsEnabledState(true);
    setHasSelectedLanguage(false);
    
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.RECOMMENDATIONS),
        AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE),
        AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
        AsyncStorage.removeItem(STORAGE_KEYS.LANGUAGE_SELECTED),
      ]);
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  }, []);

  const updateUserDemographics = useCallback(async (demographics: { dateOfBirth?: string; gender?: Gender }) => {
    if (!user) return;
    
    try {
      const updatedUser: User = {
        ...user,
        dateOfBirth: demographics.dateOfBirth ?? user.dateOfBirth,
        gender: demographics.gender ?? user.gender,
      };
      
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      setUserState(updatedUser);
      
      try {
        await apiRequest("PUT", `/api/users/${user.id}/demographics`, {
          dateOfBirth: updatedUser.dateOfBirth,
          gender: updatedUser.gender,
        });
      } catch (apiError) {
        console.error("Error syncing demographics to server:", apiError);
      }
    } catch (error) {
      console.error("Error updating demographics:", error);
    }
  }, [user]);

  const value: AppContextType = {
    language,
    setLanguage,
    hasSelectedLanguage,
    t: translations[language],
    isRTL: isRTL(language),
    user,
    setUser,
    surveys,
    activeSurveys,
    addSurvey,
    deleteSurvey,
    recommendations,
    addRecommendation,
    updateRecommendationStatus,
    deleteRecommendation,
    clearRecommendations,
    hideNotNeeded,
    setHideNotNeeded,
    isOnboardingComplete,
    setOnboardingComplete,
    notificationsEnabled,
    setNotificationsEnabled,
    isLoading,
    logout,
    deleteAccount,
    registerUser,
    loginUser,
    checkUserExists,
    updateUserDemographics,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
