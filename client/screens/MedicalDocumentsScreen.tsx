import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type DocType = "BLOOD_TEST" | "IMAGING" | "DOCTOR_NOTE" | "OTHER";
type ExtractionStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

interface MedicalDocument {
  id: string;
  filename: string;
  docType: DocType;
  mimeType?: string;
  sizeBytes: number;
  uploadedAt: string;
  extractionStatus: ExtractionStatus;
  summaryText?: string;
  extractedData?: {
    labs?: Array<{
      testName: string;
      value: string;
      unit: string;
      refRange?: string | null;
      flag?: string | null;
    }>;
    medsMentioned?: string[];
    diagnosesMentioned?: string[];
    followupStatements?: string[];
    shortSummary?: string;
  };
}

export default function MedicalDocumentsScreen() {
  const { theme } = useTheme();
  const { t, isRTL, language, user } = useApp();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<MedicalDocument | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ uri: string; name: string; mimeType: string }[]>([]);
  const [fileViewerLoading, setFileViewerLoading] = useState(true);

  const textAlign = isRTL ? "right" : "left";
  const screenWidth = Dimensions.get("window").width;

  const getFileUrl = useCallback((documentId: string) => {
    const url = new URL(`/api/medical-documents/${documentId}/file`, getApiUrl());
    url.searchParams.set("userId", user?.id || "");
    return url.toString();
  }, [user?.id]);

  const openFileViewer = useCallback((doc: MedicalDocument) => {
    setSelectedDocument(doc);
    setFileViewerLoading(true);
    setShowFileViewer(true);
  }, []);

  const documentsQuery = useQuery<{ documents: MedicalDocument[] }>({
    queryKey: ["/api/medical-documents", user?.id],
    queryFn: async () => {
      const url = new URL("/api/medical-documents", getApiUrl());
      url.searchParams.set("userId", user?.id || "");
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ files, docType }: { files: { uri: string; name: string; mimeType: string }[]; docType: DocType }) => {
      const formData = new FormData();

      for (const file of files) {
        if (Platform.OS === "web") {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          formData.append("files", blob, file.name);
        } else {
          formData.append("files", {
            uri: file.uri,
            name: file.name,
            type: file.mimeType,
          } as any);
        }
      }

      formData.append("userId", user?.id || "");
      formData.append("docType", docType);
      formData.append("language", language);

      const uploadUrl = new URL("/api/medical-documents/upload-multiple", getApiUrl());
      const res = await fetch(uploadUrl.toString(), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-documents", user?.id] });
      setShowDocTypeModal(false);
      setPendingFiles([]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("DELETE", `/api/medical-documents/${documentId}`, {
        userId: user?.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-documents", user?.id] });
      setShowDetailModal(false);
      setSelectedDocument(null);
    },
  });

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const files = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || "application/octet-stream",
        }));
        setPendingFiles(files);
        setShowDocTypeModal(true);
      }
    } catch (error) {
      console.error("Document picker error:", error);
    }
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets.length > 0) {
        const files = result.assets.map(asset => {
          const filename = asset.uri.split("/").pop() || "image.jpg";
          return {
            uri: asset.uri,
            name: filename,
            mimeType: asset.mimeType || "image/jpeg",
          };
        });
        setPendingFiles(files);
        setShowDocTypeModal(true);
      }
    } catch (error) {
      console.error("Image picker error:", error);
    }
  }, []);

  const handleUploadWithType = useCallback((docType: DocType) => {
    if (pendingFiles.length > 0) {
      uploadMutation.mutate({ files: pendingFiles, docType });
    }
  }, [pendingFiles, uploadMutation]);

  const handleDelete = useCallback((document: MedicalDocument) => {
    deleteMutation.mutate(document.id);
  }, [deleteMutation]);

  const reprocessMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("POST", `/api/medical-documents/${documentId}/reprocess`, {
        userId: user?.id,
        language,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-documents", user?.id] });
      Alert.alert(t.documents.retrySuccess);
    },
    onError: () => {
      Alert.alert(t.documents.retryError);
    },
  });

  const handleRetry = useCallback((doc: MedicalDocument) => {
    reprocessMutation.mutate(doc.id);
  }, [reprocessMutation]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: ExtractionStatus): string => {
    switch (status) {
      case "SUCCESS":
        return theme.success;
      case "FAILED":
        return theme.error;
      case "PROCESSING":
        return theme.warning;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusIcon = (status: ExtractionStatus): keyof typeof Feather.glyphMap => {
    switch (status) {
      case "SUCCESS":
        return "check-circle";
      case "FAILED":
        return "alert-circle";
      case "PROCESSING":
        return "loader";
      default:
        return "clock";
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="file-text" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h3" style={[styles.emptyTitle, { textAlign }]}>
        {t.documents.empty}
      </ThemedText>
      <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary, textAlign }]}>
        {t.documents.emptySubtitle}
      </ThemedText>
    </View>
  );

  const renderDocumentCard = (doc: MedicalDocument) => (
    <Card key={doc.id} elevation={1} style={styles.documentCard}>
      <Pressable
        onPress={() => openFileViewer(doc)}
        style={styles.cardContentPressable}
      >
        <View style={[styles.documentHeader, isRTL && styles.documentHeaderRTL]}>
          <View style={[styles.docTypeChip, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              {t.documents.docTypes[doc.docType]}
            </ThemedText>
          </View>
          <View style={[styles.statusChip, { backgroundColor: getStatusColor(doc.extractionStatus) + "20" }]}>
            <Feather
              name={getStatusIcon(doc.extractionStatus)}
              size={12}
              color={getStatusColor(doc.extractionStatus)}
            />
            <ThemedText
              type="small"
              style={{ color: getStatusColor(doc.extractionStatus), marginLeft: 4 }}
            >
              {t.documents.extractionStatus[doc.extractionStatus]}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="body" style={[styles.filename, { textAlign }]} numberOfLines={1}>
          {doc.filename}
        </ThemedText>

        {doc.summaryText ? (
          <ThemedText
            type="small"
            style={[styles.summary, { color: theme.textSecondary, textAlign }]}
            numberOfLines={2}
          >
            {doc.summaryText}
          </ThemedText>
        ) : null}

        <View style={[styles.documentFooter, isRTL && styles.documentFooterRTL]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatDate(doc.uploadedAt)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatFileSize(doc.sizeBytes)}
            </ThemedText>
          </View>
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        {doc.extractionStatus === "FAILED" && (
          <Pressable
            onPress={() => handleRetry(doc)}
            style={({ pressed }) => [
              styles.cardRetryButton,
              { backgroundColor: theme.primary + "15", opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={reprocessMutation.isPending}
          >
            {reprocessMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Feather name="refresh-cw" size={16} color={theme.primary} />
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => handleDelete(doc)}
          style={({ pressed }) => [
            styles.cardDeleteButton,
            { backgroundColor: theme.error + "15", opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="trash-2" size={16} color={theme.error} />
        </Pressable>
      </View>
    </Card>
  );

  const renderDetailModal = () => {
    if (!selectedDocument) return null;

    const doc = selectedDocument;
    const extractedData = doc.extractedData;

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowDetailModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h4" style={{ flex: 1, textAlign: "center" }}>
              {t.documents.viewDetails}
            </ThemedText>
            <Pressable onPress={() => handleDelete(doc)}>
              <Feather name="trash-2" size={24} color={theme.error} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
          >
            <Card elevation={1} style={styles.detailCard}>
              <ThemedText type="body" style={[styles.detailLabel, { textAlign }]}>
                {doc.filename}
              </ThemedText>
              <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.documents.docTypes[doc.docType]}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {formatDate(doc.uploadedAt)}
                </ThemedText>
              </View>
              <View style={styles.detailButtonRow}>
                <Pressable
                  style={[styles.viewFileButton, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={() => openFileViewer(doc)}
                >
                  <Feather name="eye" size={18} color="#fff" />
                  <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
                    {t.documents.viewFile || "View File"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.deleteButton, { backgroundColor: theme.error }]}
                  onPress={() => handleDelete(doc)}
                >
                  <Feather name="trash-2" size={18} color="#fff" />
                  <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
                    {t.documents.deleteButton || "Delete"}
                  </ThemedText>
                </Pressable>
              </View>
            </Card>

            {doc.extractionStatus === "FAILED" || !extractedData ? (
              <Card elevation={1} style={styles.detailCard}>
                <View style={styles.noDataContainer}>
                  <Feather name="alert-circle" size={32} color={theme.textSecondary} />
                  <ThemedText type="body" style={[styles.noDataText, { color: theme.textSecondary, textAlign }]}>
                    {t.documents.noDataExtracted}
                  </ThemedText>
                </View>
              </Card>
            ) : (
              <>
                {extractedData.shortSummary ? (
                  <Card elevation={1} style={styles.detailCard}>
                    <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary, textAlign }]}>
                      {t.documents.summary}
                    </ThemedText>
                    <ThemedText type="body" style={{ textAlign }}>
                      {extractedData.shortSummary}
                    </ThemedText>
                  </Card>
                ) : null}

                {extractedData.labs && extractedData.labs.length > 0 ? (
                  <Card elevation={1} style={styles.detailCard}>
                    <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary, textAlign }]}>
                      {t.documents.labResults}
                    </ThemedText>
                    {extractedData.labs.map((lab, idx) => (
                      <View key={idx} style={[styles.labRow, { borderBottomColor: theme.border }]}>
                        <ThemedText type="small" style={{ flex: 2, textAlign }}>
                          {lab.testName}
                        </ThemedText>
                        <ThemedText type="small" style={{ flex: 1, textAlign: "center" }}>
                          {lab.value} {lab.unit}
                        </ThemedText>
                        {lab.flag ? (
                          <View style={[styles.flagChip, { backgroundColor: lab.flag.toLowerCase().includes("high") || lab.flag.toLowerCase().includes("h") ? theme.error + "20" : theme.warning + "20" }]}>
                            <ThemedText type="small" style={{ color: lab.flag.toLowerCase().includes("high") || lab.flag.toLowerCase().includes("h") ? theme.error : theme.warning }}>
                              {lab.flag}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </Card>
                ) : null}

                {extractedData.medsMentioned && extractedData.medsMentioned.length > 0 ? (
                  <Card elevation={1} style={styles.detailCard}>
                    <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary, textAlign }]}>
                      {t.documents.medications}
                    </ThemedText>
                    <View style={styles.chipContainer}>
                      {extractedData.medsMentioned.map((med, idx) => (
                        <View key={idx} style={[styles.itemChip, { backgroundColor: theme.backgroundSecondary }]}>
                          <ThemedText type="small">{med}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : null}

                {extractedData.diagnosesMentioned && extractedData.diagnosesMentioned.length > 0 ? (
                  <Card elevation={1} style={styles.detailCard}>
                    <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary, textAlign }]}>
                      {t.documents.diagnoses}
                    </ThemedText>
                    <View style={styles.chipContainer}>
                      {extractedData.diagnosesMentioned.map((diag, idx) => (
                        <View key={idx} style={[styles.itemChip, { backgroundColor: theme.backgroundSecondary }]}>
                          <ThemedText type="small">{diag}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : null}

                {extractedData.followupStatements && extractedData.followupStatements.length > 0 ? (
                  <Card elevation={1} style={styles.detailCard}>
                    <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary, textAlign }]}>
                      {t.documents.followUp}
                    </ThemedText>
                    {extractedData.followupStatements.map((stmt, idx) => (
                      <ThemedText key={idx} type="small" style={[styles.followupItem, { textAlign }]}>
                        {stmt}
                      </ThemedText>
                    ))}
                  </Card>
                ) : null}
              </>
            )}
          </ScrollView>
        </ThemedView>
      </Modal>
    );
  };

  const renderDocTypeModal = () => (
    <Modal
      visible={showDocTypeModal}
      animationType="fade"
      transparent
      onRequestClose={() => {
        setShowDocTypeModal(false);
        setPendingFiles([]);
      }}
    >
      <View style={styles.modalOverlay}>
        <Card elevation={3} style={styles.docTypeModalContent}>
          <ThemedText type="h4" style={[styles.modalTitle, { textAlign }]}>
            {t.documents.selectDocType}
          </ThemedText>

          {pendingFiles.length > 1 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md, textAlign }}>
              {pendingFiles.length} {t.documents.filesSelected || "files selected"}
            </ThemedText>
          ) : null}

          {uploadMutation.isPending ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                {t.documents.uploading}
              </ThemedText>
            </View>
          ) : (
            <>
              {(["BLOOD_TEST", "IMAGING", "DOCTOR_NOTE", "OTHER"] as DocType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.docTypeOption, { borderBottomColor: theme.border }]}
                  onPress={() => handleUploadWithType(type)}
                >
                  <ThemedText type="body">{t.documents.docTypes[type]}</ThemedText>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              ))}

              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowDocTypeModal(false);
                  setPendingFiles([]);
                }}
              >
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {t.common.cancel}
                </ThemedText>
              </Pressable>
            </>
          )}
        </Card>
      </View>
    </Modal>
  );

  const documents = documentsQuery.data?.documents || [];

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing["6xl"],
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card elevation={1} style={{ ...styles.disclaimerCard, borderColor: theme.warning }}>
          <View style={[styles.disclaimerRow, isRTL && styles.disclaimerRowRTL]}>
            <Feather name="info" size={20} color={theme.warning} />
            <ThemedText type="small" style={[styles.disclaimerText, { textAlign }]}>
              {t.documents.disclaimer}
            </ThemedText>
          </View>
        </Card>

        {documentsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : documents.length > 0 ? (
          documents.map(renderDocumentCard)
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      <View style={[styles.uploadButtonContainer, { bottom: insets.bottom + Spacing.xl }]}>
        <Pressable
          style={[styles.uploadButton, { backgroundColor: theme.primary }]}
          onPress={pickDocument}
        >
          <Feather name="file-plus" size={20} color="#fff" />
          <ThemedText type="body" style={styles.uploadButtonText}>
            {t.documents.uploadButton}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.imageButton, { backgroundColor: theme.secondary }]}
          onPress={pickImage}
        >
          <Feather name="image" size={20} color="#fff" />
        </Pressable>
      </View>

      {renderDocTypeModal()}
      {renderDetailModal()}
      {renderFileViewer()}
    </>
  );

  function renderFileViewer() {
    if (!selectedDocument) return null;

    const doc = selectedDocument;
    const fileUrl = getFileUrl(doc.id);
    const isImage = doc.mimeType?.startsWith("image/") || 
      doc.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/);
    const isPdf = doc.mimeType === "application/pdf" || 
      doc.filename.toLowerCase().endsWith(".pdf");

    return (
      <Modal
        visible={showFileViewer}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowFileViewer(false)}
      >
        <ThemedView style={styles.fileViewerContainer}>
          <View style={[styles.fileViewerHeader, { paddingTop: insets.top + Spacing.sm, borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowFileViewer(false)} style={styles.fileViewerCloseButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="body" style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>
              {doc.filename}
            </ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ flex: 1 }}>
            {fileViewerLoading ? (
              <View style={styles.fileViewerLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
                  {t.documents.loadingFile || "Loading file..."}
                </ThemedText>
              </View>
            ) : null}

            {isImage ? (
              <Image
                source={{ uri: fileUrl }}
                style={styles.fileViewerImage}
                resizeMode="contain"
                onLoadStart={() => setFileViewerLoading(true)}
                onLoadEnd={() => setFileViewerLoading(false)}
                onError={() => {
                  setFileViewerLoading(false);
                  Alert.alert(
                    t.common?.error || "Error",
                    t.documents.loadError || "Failed to load file"
                  );
                }}
              />
            ) : isPdf ? (
              <WebView
                source={{ uri: fileUrl }}
                style={[styles.fileViewerWebView, fileViewerLoading && { opacity: 0 }]}
                onLoadStart={() => setFileViewerLoading(true)}
                onLoadEnd={() => setFileViewerLoading(false)}
                onError={() => {
                  setFileViewerLoading(false);
                  Alert.alert(
                    t.common?.error || "Error",
                    t.documents.loadError || "Failed to load file"
                  );
                }}
                originWhitelist={["*"]}
                javaScriptEnabled
                startInLoadingState={false}
              />
            ) : (
              <View style={styles.unsupportedFileContainer}>
                <Feather name="file" size={64} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary, textAlign: "center" }}>
                  {t.documents.unsupportedFormat || "This file format cannot be previewed in the app"}
                </ThemedText>
              </View>
            )}
          </View>
        </ThemedView>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  disclaimerCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  disclaimerRowRTL: {
    flexDirection: "row-reverse",
  },
  disclaimerText: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing["3xl"],
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing["3xl"],
  },
  documentCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  documentHeaderRTL: {
    flexDirection: "row-reverse",
  },
  docTypeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  filename: {
    marginBottom: Spacing.xs,
  },
  summary: {
    marginBottom: Spacing.sm,
  },
  documentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  documentFooterRTL: {
    flexDirection: "row-reverse",
  },
  cardActions: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardRetryButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  cardDeleteButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  cardContentPressable: {
    paddingRight: Spacing.xl + Spacing["2xl"],
  },
  uploadButtonContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  uploadButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  uploadButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  imageButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  docTypeModalContent: {
    width: "100%",
    maxWidth: 400,
    padding: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.lg,
  },
  docTypeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  uploadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  detailCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  detailLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailRowRTL: {
    flexDirection: "row-reverse",
  },
  noDataContainer: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  noDataText: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  labRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  flagChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  itemChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  followupItem: {
    marginBottom: Spacing.xs,
  },
  detailButtonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  viewFileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  fileViewerContainer: {
    flex: 1,
  },
  fileViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  fileViewerCloseButton: {
    padding: Spacing.xs,
  },
  fileViewerLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  fileViewerImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  fileViewerWebView: {
    flex: 1,
  },
  unsupportedFileContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
});
