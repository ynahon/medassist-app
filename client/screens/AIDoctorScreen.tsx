import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Switch,
  Animated as RNAnimated,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Speech from "expo-speech";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AnimatedDoctorAvatar } from "@/components/AnimatedDoctorAvatar";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/contexts/AppContext";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

let speechRecognitionSupported = false;
if (Platform.OS === "web" && typeof window !== "undefined") {
  speechRecognitionSupported = !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

let synthSupported = false;
if (Platform.OS === "web" && typeof window !== "undefined") {
  synthSupported = !!window.speechSynthesis;
}

export default function AIDoctorScreen() {
  const { theme } = useTheme();
  const { t, language, isRTL } = useApp();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const speakingAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  useEffect(() => {
    if (isSpeaking) {
      const pulse = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(speakingAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          RNAnimated.timing(speakingAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      speakingAnim.setValue(1);
    }
  }, [isSpeaking]);

  const createConversation = async (): Promise<number> => {
    if (conversationId) return conversationId;
    try {
      const res = await apiRequest("POST", "/api/conversations", {
        title: "AI Doctor Chat",
      });
      const data = await res.json();
      setConversationId(data.id);
      return data.id;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      throw err;
    }
  };

  const stopSpeaking = useCallback(() => {
    if (Platform.OS === "web" && synthSupported) {
      window.speechSynthesis.cancel();
    } else {
      Speech.stop();
    }
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (!voiceMode) return;

      stopSpeaking();

      if (Platform.OS === "web" && synthSupported) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === "he" ? "he-IL" : "en-US";
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const langCode = language === "he" ? "he" : "en";
          const preferred = voices.filter((v) => v.lang.startsWith(langCode));
          const natural = preferred.find(
            (v) =>
              v.name.includes("Google") ||
              v.name.includes("Siri") ||
              v.name.includes("Daniel") ||
              v.name.includes("Samantha") ||
              v.name.includes("Natural")
          );
          if (natural) {
            utterance.voice = natural;
          } else if (preferred.length > 0) {
            utterance.voice = preferred[0];
          }
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } else if (Platform.OS !== "web") {
        setIsSpeaking(true);
        Speech.speak(text, {
          language: language === "he" ? "he-IL" : "en-US",
          rate: 0.95,
          pitch: 1.0,
          onDone: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
          onStopped: () => setIsSpeaking(false),
        });
      }
    },
    [voiceMode, language, stopSpeaking]
  );

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setInterimTranscript("");
    setIsLoading(true);
    setError(null);

    try {
      const convId = await createConversation();
      const baseUrl = getApiUrl();
      const url = new URL(`/api/conversations/${convId}/messages`, baseUrl);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim(), language }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = (Date.now() + 1).toString();

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              if (voiceMode && assistantContent) {
                speakText(assistantContent);
              }
            } else if (data.content) {
              assistantContent += data.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                )
              );
            } else if (data.error) {
              setError(data.error);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!speechRecognitionSupported || Platform.OS !== "web") return;

    stopSpeaking();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === "he" ? "he-IL" : "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setInterimTranscript("");
        sendMessage(final);
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setInterimTranscript("");
      if (event.error !== "aborted") {
        setError(t.aiDoctor.voiceNotSupported);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleNewChat = async () => {
    stopSpeaking();
    stopListening();
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInterimTranscript("");
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const canUseVoiceInput = Platform.OS === "web" && speechRecognitionSupported;
  const canUseTTS =
    (Platform.OS === "web" && synthSupported) || Platform.OS !== "web";

  const dt = t.aiDoctor;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.sm }]}>
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <View style={[styles.voiceToggle, isRTL ? { flexDirection: "row-reverse" } : null]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {dt.voiceMode}
            </ThemedText>
            <Switch
              value={voiceMode}
              onValueChange={(val) => {
                setVoiceMode(val);
                if (!val) stopSpeaking();
              }}
              trackColor={{ false: theme.border, true: theme.primary + "80" }}
              thumbColor={voiceMode ? theme.primary : theme.textMuted}
            />
          </View>
          <Pressable
            onPress={handleNewChat}
            style={[styles.newChatBtn, { borderColor: theme.border }]}
          >
            <Feather name="plus" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
              {dt.newChat}
            </ThemedText>
          </Pressable>
        </View>

        {isSpeaking ? (
          <View style={[styles.statusBanner, { backgroundColor: theme.infoLight }]}>
            <RNAnimated.View style={{ transform: [{ scale: speakingAnim }] }}>
              <Feather name="volume-2" size={16} color={theme.info} />
            </RNAnimated.View>
            <ThemedText type="small" style={{ color: theme.info, marginLeft: Spacing.sm }}>
              {dt.doctorSpeaking}
            </ThemedText>
            <Pressable
              onPress={stopSpeaking}
              style={[styles.stopBtn, { backgroundColor: theme.info + "20" }]}
            >
              <Feather name="square" size={12} color={theme.info} />
              <ThemedText type="caption" style={{ color: theme.info, marginLeft: 4 }}>
                {dt.stopSpeaking}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {messages.length > 0 ? (
          <View style={[styles.chatAvatarRow, { borderBottomColor: theme.border }]}>
            <AnimatedDoctorAvatar
              state={isSpeaking ? "talking" : isListening ? "listening" : isLoading ? "talking" : "idle"}
              size="small"
            />
            <View style={{ marginLeft: Spacing.md, flex: 1 }}>
              <ThemedText type="bodyLarge" style={{ color: theme.text, fontWeight: "600" }}>
                {dt.title}
              </ThemedText>
              <ThemedText type="caption" style={{ color: isSpeaking ? theme.primary : isListening ? theme.error : theme.textSecondary }}>
                {isSpeaking ? dt.doctorSpeaking : isListening ? dt.listening : dt.subtitle}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <AnimatedDoctorAvatar
                state={isSpeaking ? "talking" : isListening ? "listening" : "idle"}
                size="large"
              />
              <ThemedText type="h3" style={{ textAlign: "center", marginTop: Spacing.lg }}>
                {dt.title}
              </ThemedText>
              <ThemedText
                type="body"
                style={{
                  textAlign: "center",
                  color: theme.textSecondary,
                  marginTop: Spacing.sm,
                  paddingHorizontal: Spacing.xl,
                }}
              >
                {dt.subtitle}
              </ThemedText>
              <View style={[styles.disclaimer, { backgroundColor: theme.warningLight }]}>
                <Feather name="info" size={16} color={theme.warning} />
                <ThemedText
                  type="caption"
                  style={{
                    color: theme.warning,
                    marginLeft: Spacing.sm,
                    flex: 1,
                  }}
                >
                  {dt.disclaimer}
                </ThemedText>
              </View>
              <View style={styles.suggestionsGrid}>
                {[dt.suggestion1, dt.suggestion2, dt.suggestion3].map(
                  (suggestion, idx) => (
                    <Pressable
                      key={idx}
                      style={[
                        styles.suggestionChip,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                      onPress={() => sendMessage(suggestion)}
                    >
                      <ThemedText type="small" style={{ color: theme.text }}>
                        {suggestion}
                      </ThemedText>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          ) : null}

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubbleWrapper,
                msg.role === "user"
                  ? isRTL
                    ? styles.messageLeft
                    : styles.messageRight
                  : isRTL
                    ? styles.messageRight
                    : styles.messageLeft,
              ]}
            >
              {msg.role === "assistant" ? (
                <AnimatedDoctorAvatar state="idle" size="inline" />
              ) : null}
              <View
                style={[
                  styles.messageBubble,
                  msg.role === "user"
                    ? { backgroundColor: theme.primary }
                    : {
                        backgroundColor: theme.backgroundSecondary,
                        borderWidth: 1,
                        borderColor: theme.border,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    {
                      color: msg.role === "user" ? "#FFFFFF" : theme.text,
                      textAlign: isRTL ? "right" : "left",
                      writingDirection: isRTL ? "rtl" : "ltr",
                    },
                  ]}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" ? (
            <View style={[styles.messageBubbleWrapper, isRTL ? styles.messageRight : styles.messageLeft]}>
              <AnimatedDoctorAvatar state="idle" size="inline" />
              <View
                style={[
                  styles.messageBubble,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            </View>
          ) : null}
        </ScrollView>

        {interimTranscript ? (
          <View
            style={[
              styles.interimBar,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
            ]}
          >
            <Feather name="mic" size={14} color={theme.primary} />
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginLeft: Spacing.sm,
                flex: 1,
                fontStyle: "italic",
              }}
            >
              {interimTranscript}
            </ThemedText>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorBar,
              { backgroundColor: theme.errorLight },
            ]}
          >
            <ThemedText type="caption" style={{ color: theme.error, flex: 1 }}>
              {error}
            </ThemedText>
            <Pressable onPress={() => setError(null)}>
              <Feather name="x" size={16} color={theme.error} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm,
            },
          ]}
        >
          {voiceMode && canUseVoiceInput ? (
            <Pressable
              onPress={toggleListening}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.micButton,
                {
                  backgroundColor: isListening ? theme.error : theme.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <RNAnimated.View
                style={
                  isListening
                    ? { transform: [{ scale: pulseAnim }] }
                    : undefined
                }
              >
                <Feather
                  name={isListening ? "mic-off" : "mic"}
                  size={24}
                  color="#FFFFFF"
                />
              </RNAnimated.View>
            </Pressable>
          ) : null}

          {voiceMode && !canUseVoiceInput ? (
            <View style={[styles.voiceUnavailable, { backgroundColor: theme.warningLight }]}>
              <Feather name="alert-circle" size={14} color={theme.warning} />
              <ThemedText type="caption" style={{ color: theme.warning, marginLeft: 4, flex: 1 }}>
                {dt.voiceNotSupported}
              </ThemedText>
            </View>
          ) : null}

          {isListening ? (
            <View style={styles.listeningLabel}>
              <RNAnimated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={[styles.listeningDot, { backgroundColor: theme.error }]} />
              </RNAnimated.View>
              <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm }}>
                {dt.listening}
              </ThemedText>
            </View>
          ) : null}

          {!isListening ? (
            <View style={[styles.textInputRow, isRTL ? { flexDirection: "row-reverse" } : null]}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                    textAlign: isRTL ? "right" : "left",
                  },
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={dt.placeholder}
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={2000}
                editable={!isLoading}
                onSubmitEditing={() => {
                  if (inputText.trim()) sendMessage(inputText);
                }}
              />
              <Pressable
                onPress={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isLoading}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor:
                      inputText.trim() && !isLoading
                        ? theme.primary
                        : theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather
                    name={isRTL ? "arrow-left" : "arrow-right"}
                    size={20}
                    color="#FFFFFF"
                  />
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  voiceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  chatAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["4xl"],
  },
  doctorAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
  },
  suggestionsGrid: {
    marginTop: Spacing.xl,
    width: "100%",
    gap: Spacing.sm,
  },
  suggestionChip: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  messageBubbleWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: Spacing.md,
    maxWidth: "85%",
  },
  messageLeft: {
    alignSelf: "flex-start",
  },
  messageRight: {
    alignSelf: "flex-end",
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    marginBottom: 2,
  },
  messageBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    maxWidth: "100%",
    flexShrink: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  interimBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  inputBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: Spacing.sm,
  },
  voiceUnavailable: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  listeningLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  listeningDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
