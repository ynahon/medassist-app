import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const genderEnum = ["male", "female", "other", "preferNot"] as const;
export type GenderType = (typeof genderEnum)[number];

export const otpCodes = pgTable("otp_codes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  hashedIdNumber: text("hashed_id_number").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender").$type<GenderType>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const docTypeEnum = ["BLOOD_TEST", "IMAGING", "DOCTOR_NOTE", "OTHER"] as const;
export type DocType = (typeof docTypeEnum)[number];

export const extractionStatusEnum = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;
export type ExtractionStatus = (typeof extractionStatusEnum)[number];

export const surveys = pgTable("surveys", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  feeling: text("feeling").notNull(),
  symptoms: text("symptoms").notNull(), // JSON array stored as text
  timing: text("timing").notNull(),
  painLevel: integer("pain_level").notNull(),
  notes: text("notes"),
  date: timestamp("date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
  source: text("source").default("mobile"), // New column: tracks where survey was submitted from
  priority: text("priority").default("normal"), // Test column for CI/CD migration
});

export const insertSurveySchema = createInsertSchema(surveys).omit({
  id: true,
  date: true,
  deletedAt: true,
});

export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type Survey = typeof surveys.$inferSelect;

export const medicalDocuments = pgTable("medical_documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  docType: text("doc_type").notNull().$type<DocType>(),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  deletedAt: timestamp("deleted_at"),
  extractionStatus: text("extraction_status").notNull().$type<ExtractionStatus>().default("PENDING"),
  extractedJson: text("extracted_json"),
  summaryText: text("summary_text"),
});

export const insertMedicalDocumentSchema = createInsertSchema(medicalDocuments).omit({
  id: true,
  uploadedAt: true,
  deletedAt: true,
});

export type InsertMedicalDocument = z.infer<typeof insertMedicalDocumentSchema>;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;

export interface ExtractedDocumentData {
  docTypeGuess: string;
  docDateGuess: string | null;
  labs: Array<{
    testName: string;
    value: string;
    unit: string;
    refRange: string | null;
    flag: string | null;
    resultDate: string | null;
  }>;
  medsMentioned: string[];
  diagnosesMentioned: string[];
  followupStatements: string[];
  shortSummary: string;
  confidence: number;
}

// Heart Rate Samples from HealthKit/Health Connect
export const heartRateSourceEnum = ["healthkit", "health_connect"] as const;
export type HeartRateSource = (typeof heartRateSourceEnum)[number];

export const heartRateSamples = pgTable("heart_rate_samples", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  bpm: integer("bpm").notNull(),
  source: text("source").notNull().$type<HeartRateSource>(),
  deviceName: text("device_name"),
  workoutContext: text("workout_context"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertHeartRateSampleSchema = createInsertSchema(heartRateSamples).omit({
  id: true,
  createdAt: true,
});

export type InsertHeartRateSample = z.infer<typeof insertHeartRateSampleSchema>;
export type HeartRateSample = typeof heartRateSamples.$inferSelect;

// Health connection status
export const healthConnections = pgTable("health_connections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  source: text("source").notNull().$type<HeartRateSource>(),
  connected: integer("connected").notNull().default(0),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type HealthConnection = typeof healthConnections.$inferSelect;

// System prompts for AI functionality
export const promptTypeEnum = ["recommendations", "document_extraction"] as const;
export type PromptType = (typeof promptTypeEnum)[number];

export const languageEnum = ["en", "he"] as const;
export type PromptLanguage = (typeof languageEnum)[number];

export const systemPrompts = pgTable("system_prompts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  promptType: text("prompt_type").notNull().$type<PromptType>(),
  language: text("language").notNull().$type<PromptLanguage>(),
  promptText: text("prompt_text").notNull(),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertSystemPromptSchema = createInsertSchema(systemPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSystemPrompt = z.infer<typeof insertSystemPromptSchema>;
export type SystemPrompt = typeof systemPrompts.$inferSelect;

export * from "./models/chat";
