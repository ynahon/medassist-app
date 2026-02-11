import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import twilio from "twilio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import documentRoutes, { getDocumentsForRecommendations } from "./documentRoutes";
import heartRateRoutes from "./heartRateRoutes";
import { registerChatRoutes } from "./replit_integrations/chat";
import { getSystemPrompt, updateSystemPrompt, getAllSystemPrompts, seedDefaultPrompts, processPromptTemplate } from "./systemPrompts";
import { storage, hashIdNumber, db } from "./storage";
import { otpCodes, PromptType, PromptLanguage } from "../shared/schema";

function getVersion(): string {
  try {
    const versionPath = resolve(process.cwd(), "server", "version.txt");
    return readFileSync(versionPath, "utf-8").trim();
  } catch {
    return "0.0.0";
  }
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

console.log("Key starting with:", apiKey.substring(0, 5) + "...");
// Only initialize Twilio if credentials are configured
const twilioEnabled = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
const twilioClient = twilioEnabled 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

type PhoneNormalizeResult =
  | { ok: true; value: string; type: "IL" | "US516" }
  | { ok: false; error: string };

function normalizePhone(input: string): PhoneNormalizeResult {
  const cleaned = input.replace(/[\s\-\(\)]/g, "");
  
  if (cleaned.startsWith("+972")) {
    const rest = cleaned.slice(4);
    const localNumber = "0" + rest;
    if (/^05\d{8}$/.test(localNumber)) {
      const formatted = localNumber.slice(0, 3) + "-" + localNumber.slice(3);
      return { ok: true, value: formatted, type: "IL" };
    }
    return { ok: false, error: "Invalid Israel phone format" };
  }
  
  if (cleaned.startsWith("972") && cleaned.length >= 12) {
    const rest = cleaned.slice(3);
    const localNumber = "0" + rest;
    if (/^05\d{8}$/.test(localNumber)) {
      const formatted = localNumber.slice(0, 3) + "-" + localNumber.slice(3);
      return { ok: true, value: formatted, type: "IL" };
    }
    return { ok: false, error: "Invalid Israel phone format" };
  }
  
  if (cleaned.startsWith("+1")) {
    const digits = cleaned.slice(2);
    if (digits.length === 10 && digits.startsWith("516")) {
      const formatted = "516-" + digits.slice(3);
      return { ok: true, value: formatted, type: "US516" };
    }
    return { ok: false, error: "Invalid US phone format (only area code 516 supported)" };
  }
  
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    const digits = cleaned.slice(1);
    if (digits.startsWith("516")) {
      const formatted = "516-" + digits.slice(3);
      return { ok: true, value: formatted, type: "US516" };
    }
    return { ok: false, error: "Invalid US phone format (only area code 516 supported)" };
  }
  
  if (/^05\d{8}$/.test(cleaned)) {
    const formatted = cleaned.slice(0, 3) + "-" + cleaned.slice(3);
    return { ok: true, value: formatted, type: "IL" };
  }
  
  if (/^516\d{7}$/.test(cleaned)) {
    const formatted = "516-" + cleaned.slice(3);
    return { ok: true, value: formatted, type: "US516" };
  }
  
  return { ok: false, error: "Invalid phone format" };
}

function normalizePhoneNumber(phone: string): string {
  const result = normalizePhone(phone);
  if (result.ok) {
    return result.value;
  }
  return phone.replace(/[\s\-\(\)]/g, "");
}

export async function registerRoutes(app: Express): Promise<Server> {
  registerChatRoutes(app);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: getVersion(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "medassist-api",
    });
  });

  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      
      // Upsert OTP in database (delete existing first, then insert)
      await db.delete(otpCodes).where(eq(otpCodes.phoneNumber, normalizedPhone));
      await db.insert(otpCodes).values({
        phoneNumber: normalizedPhone,
        code: otp,
        expiresAt,
      });

      // If Twilio is not configured, use dev mode
      if (!twilioClient) {
        console.log(`[DEV MODE] Twilio not configured. OTP for ${normalizedPhone}: ${otp}`);
        return res.json({ 
          success: true, 
          message: "OTP sent (dev mode - check screen for code)", 
          devCode: otp 
        });
      }

      try {
        await twilioClient.messages.create({
          body: `Your MedAssist verification code is: ${otp}. This code expires in 5 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: normalizedPhone,
        });

        console.log(`OTP sent to ${normalizedPhone}`);
        res.json({ success: true, message: "OTP sent successfully" });
      } catch (twilioError: any) {
        console.error("Twilio error:", twilioError.message);
        console.log(`[DEV MODE] OTP for ${normalizedPhone}: ${otp}`);
        
        // Always provide devCode when Twilio fails (for testing)
        // In production with a properly configured Twilio account, SMS would work
        res.json({ 
          success: true, 
          message: "OTP sent (dev mode - check screen for code)", 
          devCode: otp 
        });
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phoneNumber, code } = req.body;

      if (!phoneNumber || !code) {
        return res.status(400).json({ error: "Phone number and code are required" });
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      console.log(`[VERIFY] Input: ${phoneNumber}, Normalized: ${normalizedPhone}, Code: ${code}`);
      
      // Get OTP from database
      const [storedOtp] = await db.select().from(otpCodes).where(eq(otpCodes.phoneNumber, normalizedPhone));

      if (!storedOtp) {
        console.log(`[VERIFY] No OTP found for ${normalizedPhone}`);
        return res.status(400).json({ error: "No OTP found. Please request a new code." });
      }

      if (new Date() > storedOtp.expiresAt) {
        await db.delete(otpCodes).where(eq(otpCodes.phoneNumber, normalizedPhone));
        return res.status(400).json({ error: "OTP expired. Please request a new code." });
      }

      if (storedOtp.code !== code) {
        return res.status(400).json({ error: "Invalid code" });
      }

      // Delete OTP after successful verification
      await db.delete(otpCodes).where(eq(otpCodes.phoneNumber, normalizedPhone));

      res.json({ success: true, message: "OTP verified successfully" });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { firstName, lastName, idNumber, phoneNumber } = req.body;

      if (!firstName || !lastName || !idNumber || !phoneNumber) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const hashedId = hashIdNumber(idNumber);

      const existingUser = await storage.getUserByPhone(normalizedPhone);
      if (existingUser) {
        return res.status(400).json({ error: "User with this phone number already exists" });
      }

      const existingIdUser = await storage.getUserByHashedId(hashedId);
      if (existingIdUser) {
        return res.status(400).json({ error: "User with this ID already exists" });
      }

      const user = await storage.createUser({
        firstName,
        lastName,
        hashedIdNumber: hashedId,
        phoneNumber: normalizedPhone,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { idNumber, phoneNumber } = req.body;

      if (!idNumber || !phoneNumber) {
        return res.status(400).json({ error: "ID number and phone number are required" });
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const hashedId = hashIdNumber(idNumber);

      const user = await storage.getUserByPhone(normalizedPhone);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.hashedIdNumber !== hashedId) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/users/:userId/demographics", async (req, res) => {
    try {
      const { userId } = req.params;
      const { dateOfBirth, gender } = req.body;

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updatedUser = await storage.updateUserDemographics(userId, { dateOfBirth, gender });
      res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Update demographics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Survey endpoints
  app.get("/api/surveys/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const userSurveys = await storage.getSurveysByUserId(userId);
      res.json({ surveys: userSurveys });
    } catch (error) {
      console.error("Get surveys error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/surveys", async (req, res) => {
    try {
      const { userId, feeling, symptoms, timing, painLevel, notes } = req.body;

      if (!userId || !feeling || !timing || painLevel === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const survey = await storage.createSurvey({
        userId,
        feeling,
        symptoms: JSON.stringify(symptoms || []),
        timing,
        painLevel,
        notes: notes || null,
      });

      res.json({
        success: true,
        survey: {
          ...survey,
          symptoms: JSON.parse(survey.symptoms),
        },
      });
    } catch (error) {
      console.error("Create survey error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/surveys/:surveyId", async (req, res) => {
    try {
      const { surveyId } = req.params;
      const survey = await storage.deleteSurvey(surveyId);
      
      if (!survey) {
        return res.status(404).json({ error: "Survey not found" });
      }

      res.json({ success: true, survey });
    } catch (error) {
      console.error("Delete survey error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.use("/api/medical-documents", documentRoutes);
  app.use("/api/cardio", heartRateRoutes);

  // System prompts management endpoints (for admin use)
  app.get("/api/admin/system-prompts", async (req, res) => {
    try {
      const prompts = await getAllSystemPrompts();
      res.json({ success: true, prompts });
    } catch (error) {
      console.error("Error fetching system prompts:", error);
      res.status(500).json({ error: "Failed to fetch system prompts" });
    }
  });

  app.get("/api/admin/system-prompts/:type/:language", async (req, res) => {
    try {
      const { type, language } = req.params;
      const prompt = await getSystemPrompt(type as PromptType, language as PromptLanguage);
      res.json({ success: true, prompt });
    } catch (error) {
      console.error("Error fetching system prompt:", error);
      res.status(500).json({ error: "Failed to fetch system prompt" });
    }
  });

  app.put("/api/admin/system-prompts/:type/:language", async (req, res) => {
    try {
      const { type, language } = req.params;
      const { promptText, description } = req.body;

      if (!promptText) {
        return res.status(400).json({ error: "promptText is required" });
      }

      const success = await updateSystemPrompt(
        type as PromptType,
        language as PromptLanguage,
        promptText,
        description
      );

      if (success) {
        res.json({ success: true, message: "System prompt updated" });
      } else {
        res.status(500).json({ error: "Failed to update system prompt" });
      }
    } catch (error) {
      console.error("Error updating system prompt:", error);
      res.status(500).json({ error: "Failed to update system prompt" });
    }
  });

  app.post("/api/recommendations/generate", async (req, res) => {
    try {
      const { userProfile, surveys: rawSurveys, existingRecommendations, language, userId } = req.body;

      if (!userProfile) {
        return res.status(400).json({ error: "User profile is required" });
      }

      const isHebrew = language === "he";
      
      // Sort surveys by date descending (newest first)
      const surveys = (rawSurveys || []).slice().sort((a: any, b: any) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return dateB - dateA; // Newest first
      });
      
      console.log("[Recommendations] Raw surveys received:", rawSurveys?.length || 0);
      console.log("[Recommendations] Sorted surveys (newest first):", surveys.map((s: any) => s.date || s.createdAt));

      const addressedTitles = new Set(
        (existingRecommendations || [])
          .filter((r: any) => r.status === "done" || r.status === "irrelevant" || r.status === "not_needed")
          .map((r: any) => r.title?.toLowerCase().trim())
      );

      const pendingTitles = new Set(
        (existingRecommendations || [])
          .filter((r: any) => r.status === "pending")
          .map((r: any) => r.title?.toLowerCase().trim())
      );

      const allExistingTitles = [...addressedTitles, ...pendingTitles];
      const existingTitlesList = allExistingTitles.join(", ") || (isHebrew ? "אין" : "None");

      let documentContext = "";
      let documentCount = 0;
      let hasCriticalFindings = false;

      if (userId) {
        try {
          const docData = await getDocumentsForRecommendations(userId);
          documentCount = docData.documentCount || 0;
          
          if (docData.labs.length > 0 || docData.summaries.length > 0) {
            hasCriticalFindings = docData.hasCriticalFindings;

            if (docData.labs.length > 0) {
              documentContext += isHebrew
                ? `\n\nתוצאות בדיקות (ממסמכים שהועלו):\n`
                : `\n\nLab Results (from uploaded documents):\n`;
              documentContext += docData.labs
                .slice(0, 20)
                .map((lab: any) => `- ${lab.testName}: ${lab.value} ${lab.unit || ""} ${lab.flag ? `(${lab.flag})` : ""}`)
                .join("\n");
            }

            if (docData.summaries.length > 0) {
              documentContext += isHebrew
                ? `\n\nסיכומי מסמכים:\n`
                : `\n\nDocument Summaries:\n`;
              documentContext += docData.summaries.slice(0, 5).join("\n");
            }
          }
        } catch (docError) {
          console.error("Error fetching document data:", docError);
        }
      }

      const criticalWarning = hasCriticalFindings
        ? isHebrew
          ? "\n\nאזהרה: נמצאו ממצאים קריטיים במסמכים. הוסף המלצה דחופה ליצור קשר עם רופא."
          : "\n\nWARNING: Critical findings detected in documents. Include an urgent recommendation to contact a clinician."
        : "";

      const hasSurveyData = surveys && surveys.length > 0;
      const hasDocumentData = documentContext.length > 0;
      const hasDemographicData = userProfile.dateOfBirth || userProfile.gender;

      const promptLanguage = isHebrew ? "he" : "en";
      const basePrompt = await getSystemPrompt("recommendations", promptLanguage as PromptLanguage);
      
      const systemPrompt = processPromptTemplate(basePrompt, {
        hasSurveyData,
        surveyCount: surveys?.length || 0,
        hasDocumentData,
        hasDemographicData,
        existingTitlesList,
        criticalWarning,
      });


      let surveyInsights = "";
      if (hasSurveyData && surveys.length > 0) {
        // surveys are now sorted newest first, so [0] is the latest
        const latestSurvey = surveys[0];
        const surveyData = latestSurvey.responses || latestSurvey;
        
        const painLevel = surveyData.painLevel ?? surveyData.pain_level ?? null;
        const feeling = surveyData.feeling || surveyData.mood || null;
        const symptoms = surveyData.symptoms || [];
        const timing = surveyData.timing || null;
        const notes = surveyData.notes || null;
        
        surveyInsights = `
IMPORTANT - User's Latest Survey Data (${latestSurvey.date || "recent"}):
- Pain Level: ${painLevel !== null ? `${painLevel}/10` : "Not reported"}${painLevel !== null && painLevel >= 5 ? " (HIGH - requires attention)" : ""}
- Current Feeling/Mood: ${feeling || "Not reported"}${feeling === "bad" || feeling === "very_bad" ? " (LOW - requires attention)" : ""}
- Reported Symptoms: ${symptoms.length > 0 ? symptoms.join(", ") : "None reported"}
- Symptom Duration: ${timing || "Not specified"}${timing === "more_than_week" || timing === "more_than_month" ? " (PERSISTENT - requires attention)" : ""}
- Additional Notes: ${notes || "None"}

YOU MUST create at least one recommendation with source="survey" based on this data if any of the following is true:
- Pain level is 3 or higher
- Mood/feeling is "bad" or "very_bad"
- Any symptoms are reported
- Duration is more than a week
`;
      }

      const userContext = `
User Profile:
- Date of Birth: ${userProfile.dateOfBirth || "Not provided"}
- Gender: ${userProfile.gender || "Not provided"}
${surveyInsights}
Survey History (${surveys?.length || 0} total surveys, showing 3 most recent):
${surveys?.slice(0, 3).map((s: any, i: number) => {
  const data = s.responses || s;
  return `Survey ${i + 1} (${s.date || "recent"}): Pain=${data.painLevel ?? "N/A"}, Feeling=${data.feeling || "N/A"}, Symptoms=${(data.symptoms || []).join(", ") || "none"}, Duration=${data.timing || "N/A"}`;
}).join("\n") || "No surveys completed"}${documentContext}
`;

      const prompt = `${systemPrompt}\n\n${userContext}\n\nRespond with valid JSON only.`;
      
      // Log full context being sent to Gemini
      console.log("\n========== GEMINI RECOMMENDATIONS REQUEST ==========");
      console.log("[Recommendations] Survey data available:", hasSurveyData ? surveys.length : 0);
      console.log("[Recommendations] Document data available:", hasDocumentData);
      console.log("[Recommendations] Demographic data available:", hasDemographicData);
      if (hasSurveyData) {
        console.log("[Recommendations] Latest survey (newest):", JSON.stringify(surveys[0]));
      }
      console.log("[Recommendations] Existing titles to exclude:", existingTitlesList);
      console.log("\n----- FULL PROMPT TO GEMINI -----");
      console.log(prompt);
      console.log("----- END PROMPT -----\n");
      
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
        },
      });

      const content = result.response.text() || "{}";
      const parsed = JSON.parse(content);
      
      console.log("[Recommendations] AI raw response sources:", 
        (parsed.recommendations || []).map((r: any) => ({ title: r.title?.substring(0, 30), source: r.source }))
      );
      console.log("[Recommendations] AI raw possibleConditions:", JSON.stringify(parsed.possibleConditions || [], null, 2));

      const sourcePriority: Record<string, number> = {
        survey: 1,
        document: 2,
        demographic: 3,
        general: 4,
      };

      const newRecommendations = (parsed.recommendations || [])
        .filter((rec: any) => {
          const titleLower = rec.title?.toLowerCase().trim() || "";
          return !addressedTitles.has(titleLower) && !pendingTitles.has(titleLower);
        })
        .map((rec: any) => ({
          ...rec,
          source: rec.source || "general",
        }))
        .sort((a: any, b: any) => {
          const aPriority = sourcePriority[a.source] || 4;
          const bPriority = sourcePriority[b.source] || 4;
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          return (a.priority || 3) - (b.priority || 3);
        });

      // Extract conditions from top-level possibleConditions array
      let allConditions: any[] = parsed.possibleConditions || [];
      
      // Also extract conditions embedded inside each recommendation
      for (const rec of (parsed.recommendations || [])) {
        if (rec.possibleConditions && Array.isArray(rec.possibleConditions)) {
          allConditions = allConditions.concat(rec.possibleConditions);
        }
      }
      
      // Map confidence strings to numeric probabilities
      const confidenceToNumber = (conf: string | number | undefined): number => {
        if (typeof conf === 'number') return conf;
        if (conf === 'high') return 0.75;
        if (conf === 'moderate') return 0.5;
        if (conf === 'low') return 0.25;
        return 0.5;
      };
      
      // Normalize conditions to standard format
      const possibleConditions = allConditions.map((c: any) => ({
        id: c.id || c.condition || c.name,
        name: c.condition || c.name,
        probability: typeof c.probability === 'number' ? c.probability : confidenceToNumber(c.confidence),
        severity: c.urgency === 'urgent' ? 'high' : (c.urgency === 'moderate' || c.urgency === 'moderate to urgent') ? 'moderate' : (c.severity || 'low'),
        summary: c.typicalPresentation || c.summary || '',
        whyItFits: c.matchingSymptoms || c.whyItFits || [],
        redFlagsToWatch: c.redFlagsToWatch || [],
        selfCare: c.selfCare || [],
        whenToSeeDoctor: c.recommendation || c.whenToSeeDoctor || '',
        suggestedTests: c.suggestedTests || [],
        hebrewName: c.hebrewName || '',
      }));
      
      console.log("[Recommendations] Possible conditions returned:", possibleConditions.length);
      if (possibleConditions.length > 0) {
        console.log("[Recommendations] Conditions:", JSON.stringify(possibleConditions, null, 2));
      }

      res.json({
        success: true,
        recommendations: newRecommendations,
        possibleConditions,
        documentCount,
        noMoreRecommendations: newRecommendations.length === 0,
      });
    } catch (error: any) {
      console.error("Generate recommendations error:", error);
      
      if (error.status === 429 || error.message?.includes("quota") || error.message?.includes("429")) {
        res.status(429).json({ 
          error: "AI service quota exceeded. Please try again later or check your API billing.",
          quotaExceeded: true
        });
      } else {
        res.status(500).json({ error: error.message || "Failed to generate recommendations" });
      }
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
