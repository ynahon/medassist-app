import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Tesseract from "tesseract.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";
import { db } from "./db";
import { medicalDocuments, type DocType, type ExtractionStatus, type ExtractedDocumentData, PromptLanguage } from "../shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getSystemPrompt } from "./systemPrompts";

type ExtractionMethod = "embedded_text" | "ocr" | "none";
type ExtractionResult = {
  text: string;
  method: ExtractionMethod;
  error?: string;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, JPG, and PNG are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
});

async function extractEmbeddedTextFromPDF(filePath: string): Promise<string> {
  const startTime = Date.now();
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(fileBuffer);
    
    console.log(`[PDF] Loading file: ${filePath}, size: ${fileBuffer.length} bytes`);
    
    const parser = new PDFParse(uint8Array);
    await (parser as any).load();
    const textResult = await parser.getText();
    
    let text = "";
    if (typeof textResult === "string") {
      text = textResult;
    } else if (textResult && typeof textResult === "object") {
      text = (textResult as any).text || JSON.stringify(textResult);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[PDF] Embedded text extraction completed in ${duration}ms, chars: ${text.length}`);
    
    return text;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[PDF] Extraction error after ${duration}ms:`, error?.message || error);
    return "";
  }
}

async function extractTextFromImageOCR(filePath: string): Promise<string> {
  const startTime = Date.now();
  try {
    console.log(`[OCR] Starting OCR on: ${filePath}`);
    
    const result = await Tesseract.recognize(filePath, "eng+heb", {
      logger: (info) => {
        if (info.status === "recognizing text" && info.progress) {
          console.log(`[OCR] Progress: ${Math.round(info.progress * 100)}%`);
        }
      },
    });
    
    const duration = Date.now() - startTime;
    const text = result.data.text || "";
    console.log(`[OCR] Completed in ${duration}ms, chars: ${text.length}, confidence: ${result.data.confidence}%`);
    
    return text;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[OCR] Error after ${duration}ms:`, error?.message || error);
    return "";
  }
}

async function extractTextFromPDFWithFallback(filePath: string): Promise<ExtractionResult> {
  const fileStats = fs.statSync(filePath);
  console.log(`[Extract] Processing PDF: ${filePath}, size: ${fileStats.size} bytes`);
  
  if (!fs.existsSync(filePath)) {
    return { text: "", method: "none", error: "File not found on server" };
  }
  
  if (fileStats.size === 0) {
    return { text: "", method: "none", error: "File is empty" };
  }
  
  const embeddedText = await extractEmbeddedTextFromPDF(filePath);
  const trimmedText = embeddedText.trim();
  
  if (trimmedText.length >= 50) {
    console.log(`[Extract] Embedded text extraction successful: ${trimmedText.length} chars`);
    return { text: trimmedText, method: "embedded_text" };
  }
  
  console.log(`[Extract] Embedded text too short (${trimmedText.length} chars), attempting OCR fallback...`);
  console.log(`[Extract] This PDF appears to be a scanned document. Running OCR...`);
  
  const ocrText = await extractTextFromImageOCR(filePath);
  const trimmedOcrText = ocrText.trim();
  
  if (trimmedOcrText.length >= 20) {
    console.log(`[Extract] OCR fallback successful: ${trimmedOcrText.length} chars`);
    return { text: trimmedOcrText, method: "ocr" };
  }
  
  console.log(`[Extract] Both extraction methods failed or returned insufficient text`);
  return { 
    text: trimmedText || trimmedOcrText, 
    method: "none", 
    error: "Could not extract sufficient text. The document may be unreadable or contain only images without text." 
  };
}

async function extractTextFromImage(filePath: string): Promise<ExtractionResult> {
  console.log(`[Extract] Processing image: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    return { text: "", method: "none", error: "File not found on server" };
  }
  
  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    return { text: "", method: "none", error: "File is empty" };
  }
  
  const ocrText = await extractTextFromImageOCR(filePath);
  const trimmedText = ocrText.trim();
  
  if (trimmedText.length >= 20) {
    return { text: trimmedText, method: "ocr" };
  }
  
  return { 
    text: trimmedText, 
    method: "none", 
    error: "Could not extract text from image. The image may be too blurry or contain no readable text." 
  };
}

async function extractStructuredData(
  rawText: string,
  docType: DocType,
  language: string
): Promise<ExtractedDocumentData | null> {
  if (!rawText || rawText.trim().length < 10) {
    console.log("Text too short for extraction:", rawText.length, "chars");
    return null;
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set!");
    return null;
  }

  const isHebrew = language === "he";
  const promptLanguage = isHebrew ? "he" : "en";
  
  // Get system prompt from database (falls back to default if not found)
  const systemPrompt = await getSystemPrompt("document_extraction", promptLanguage as PromptLanguage);

  const userMessage = `Document type hint: ${docType}
Locale: ${isHebrew ? "Israel/Hebrew" : "English"}

Extracted text:
${rawText.substring(0, 8000)}`;

  const maxRetries = 3;
  const baseDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `${systemPrompt}\n\n${userMessage}\n\nRespond with valid JSON only.`;
      
      console.log(`[Gemini] API call attempt ${attempt}/${maxRetries}...`);
      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
        },
      });

      const content = result.response.text() || "{}";
      console.log("[Gemini] Response received, parsing JSON...");
      const parsed = JSON.parse(content) as ExtractedDocumentData;

      if (!parsed.labs) parsed.labs = [];
      if (!parsed.medsMentioned) parsed.medsMentioned = [];
      if (!parsed.diagnosesMentioned) parsed.diagnosesMentioned = [];
      if (!parsed.followupStatements) parsed.followupStatements = [];
      if (!parsed.shortSummary) parsed.shortSummary = "";
      if (typeof parsed.confidence !== "number") parsed.confidence = 0.5;

      return parsed;
    } catch (error: any) {
      const isRateLimited = error?.status === 429 || error?.message?.includes("429");
      
      if (isRateLimited && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[Gemini] Rate limited (429). Waiting ${delay / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error(`[Gemini] Extraction error on attempt ${attempt}:`, error?.message || error);
      
      if (attempt === maxRetries) {
        if (isRateLimited) {
          console.error("[Gemini] All retries exhausted due to rate limiting");
        }
        return null;
      }
    }
  }
  
  return null;
}

async function processDocument(
  documentId: string,
  filePath: string,
  mimeType: string,
  docType: DocType,
  language: string
): Promise<void> {
  const startTime = Date.now();
  console.log(`[Process] Starting document ${documentId}, type: ${mimeType}, path: ${filePath}`);
  
  try {
    await db
      .update(medicalDocuments)
      .set({ extractionStatus: "PROCESSING" as ExtractionStatus })
      .where(eq(medicalDocuments.id, documentId));

    let extractionResult: ExtractionResult;

    if (mimeType === "application/pdf") {
      console.log("[Process] Extracting text from PDF...");
      extractionResult = await extractTextFromPDFWithFallback(filePath);
    } else if (mimeType.startsWith("image/")) {
      console.log("[Process] Extracting text from image via OCR...");
      extractionResult = await extractTextFromImage(filePath);
    } else {
      extractionResult = { text: "", method: "none", error: "Unsupported file type" };
    }

    console.log(`[Process] Extraction result: method=${extractionResult.method}, chars=${extractionResult.text.length}`);

    if (extractionResult.method === "none" || extractionResult.text.length < 10) {
      const errorMessage = extractionResult.error || "Could not extract text from document";
      console.log(`[Process] Extraction failed: ${errorMessage}`);
      
      await db
        .update(medicalDocuments)
        .set({
          extractionStatus: "FAILED" as ExtractionStatus,
          summaryText: errorMessage,
        })
        .where(eq(medicalDocuments.id, documentId));
      return;
    }

    console.log(`[Process] Text extraction successful via ${extractionResult.method}, proceeding to AI analysis...`);
    const extractedData = await extractStructuredData(extractionResult.text, docType, language);

    const duration = Date.now() - startTime;
    
    if (extractedData) {
      console.log(`[Process] Document ${documentId} processed successfully in ${duration}ms`);
      await db
        .update(medicalDocuments)
        .set({
          extractionStatus: "SUCCESS" as ExtractionStatus,
          extractedJson: JSON.stringify({
            ...extractedData,
            extractionMethod: extractionResult.method,
          }),
          summaryText: extractedData.shortSummary,
        })
        .where(eq(medicalDocuments.id, documentId));
    } else {
      console.log(`[Process] Document ${documentId} - AI analysis returned no structured data after ${duration}ms`);
      await db
        .update(medicalDocuments)
        .set({
          extractionStatus: "FAILED" as ExtractionStatus,
          summaryText: "AI quota exceeded. Please try again later or check your Gemini API billing.",
        })
        .where(eq(medicalDocuments.id, documentId));
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Process] Document ${documentId} error after ${duration}ms:`, error?.message || error);
    await db
      .update(medicalDocuments)
      .set({
        extractionStatus: "FAILED" as ExtractionStatus,
        summaryText: "An unexpected error occurred during processing",
      })
      .where(eq(medicalDocuments.id, documentId));
  }
}

const router = Router();

function handleMulterError(err: any, req: Request, res: Response, next: Function) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        code: "FILE_TOO_LARGE",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files. Maximum is 10 files per upload.",
        code: "TOO_MANY_FILES",
      });
    }
    return res.status(400).json({
      error: err.message,
      code: err.code,
    });
  }
  if (err?.message?.includes("Invalid file type")) {
    return res.status(415).json({
      error: "Invalid file type. Only PDF, JPG, and PNG files are allowed.",
      code: "INVALID_FILE_TYPE",
    });
  }
  next(err);
}

router.post(
  "/upload",
  upload.single("file"),
  handleMulterError,
  async (req: Request, res: Response) => {
    const requestId = crypto.randomBytes(8).toString("hex");
    console.log(`[${requestId}] Upload request received`);

    try {
      const file = req.file;
      const { userId, docType, language } = req.body;

      if (!file) {
        console.log(`[${requestId}] No file in request`);
        return res.status(400).json({
          error: "No file uploaded. Please select a file to upload.",
          code: "NO_FILE",
          requestId,
        });
      }

      console.log(`[${requestId}] File received: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);

      if (!userId) {
        fs.unlinkSync(file.path);
        console.log(`[${requestId}] Missing userId`);
        return res.status(400).json({
          error: "User ID is required",
          code: "MISSING_USER_ID",
          requestId,
        });
      }

      const validDocTypes: DocType[] = ["BLOOD_TEST", "IMAGING", "DOCTOR_NOTE", "OTHER"];
      const selectedDocType: DocType = validDocTypes.includes(docType)
        ? docType
        : "OTHER";

      const [document] = await db
        .insert(medicalDocuments)
        .values({
          userId,
          filename: file.originalname,
          storagePath: file.path,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          docType: selectedDocType,
          extractionStatus: "PENDING",
        })
        .returning();

      processDocument(
        document.id,
        file.path,
        file.mimetype,
        selectedDocType,
        language || "en"
      );

      console.log(`[${requestId}] Successfully uploaded document: ${document.id}`);
      res.json({
        success: true,
        document: {
          id: document.id,
          filename: document.filename,
          docType: document.docType,
          extractionStatus: document.extractionStatus,
          uploadedAt: document.uploadedAt,
        },
        requestId,
      });
    } catch (error: any) {
      console.error(`[${requestId}] Upload error:`, error);
      res.status(500).json({
        error: error.message || "Upload failed. Please try again.",
        code: "UPLOAD_ERROR",
        requestId,
      });
    }
  }
);

router.post(
  "/upload-multiple",
  uploadMultiple.array("files", 10),
  handleMulterError,
  async (req: Request, res: Response) => {
    const requestId = crypto.randomBytes(8).toString("hex");
    console.log(`[${requestId}] Multiple upload request received`);

    try {
      const files = req.files as Express.Multer.File[];
      const { userId, docType, language } = req.body;

      if (!files || files.length === 0) {
        console.log(`[${requestId}] No files in request`);
        return res.status(400).json({
          error: "No files uploaded. Please select files to upload.",
          code: "NO_FILES",
          requestId,
        });
      }

      console.log(`[${requestId}] ${files.length} file(s) received`);

      if (!userId) {
        files.forEach((file) => fs.unlinkSync(file.path));
        console.log(`[${requestId}] Missing userId`);
        return res.status(400).json({
          error: "User ID is required",
          code: "MISSING_USER_ID",
          requestId,
        });
      }

      const validDocTypes: DocType[] = ["BLOOD_TEST", "IMAGING", "DOCTOR_NOTE", "OTHER"];
      const selectedDocType: DocType = validDocTypes.includes(docType)
        ? docType
        : "OTHER";

      const uploadedDocuments = [];

      for (const file of files) {
        const [document] = await db
          .insert(medicalDocuments)
          .values({
            userId,
            filename: file.originalname,
            storagePath: file.path,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            docType: selectedDocType,
            extractionStatus: "PENDING",
          })
          .returning();

        processDocument(
          document.id,
          file.path,
          file.mimetype,
          selectedDocType,
          language || "en"
        );

        uploadedDocuments.push({
          id: document.id,
          filename: document.filename,
          docType: document.docType,
          extractionStatus: document.extractionStatus,
          uploadedAt: document.uploadedAt,
        });
      }

      console.log(`[${requestId}] Successfully uploaded ${uploadedDocuments.length} file(s)`);
      res.json({
        success: true,
        documents: uploadedDocuments,
        count: uploadedDocuments.length,
        requestId,
      });
    } catch (error: any) {
      console.error(`[${requestId}] Multiple upload error:`, error);
      res.status(500).json({
        error: error.message || "Upload failed. Please try again.",
        code: "UPLOAD_ERROR",
        requestId,
      });
    }
  }
);

router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "User ID is required" });
    }

    const documents = await db
      .select({
        id: medicalDocuments.id,
        filename: medicalDocuments.filename,
        docType: medicalDocuments.docType,
        sizeBytes: medicalDocuments.sizeBytes,
        uploadedAt: medicalDocuments.uploadedAt,
        extractionStatus: medicalDocuments.extractionStatus,
        summaryText: medicalDocuments.summaryText,
      })
      .from(medicalDocuments)
      .where(
        and(
          eq(medicalDocuments.userId, userId),
          isNull(medicalDocuments.deletedAt)
        )
      )
      .orderBy(desc(medicalDocuments.uploadedAt));

    res.json({ documents });
  } catch (error: any) {
    console.error("List documents error:", error);
    res.status(500).json({ error: error.message || "Failed to list documents" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "User ID is required" });
    }

    const [document] = await db
      .select()
      .from(medicalDocuments)
      .where(
        and(
          eq(medicalDocuments.id, id),
          eq(medicalDocuments.userId, userId),
          isNull(medicalDocuments.deletedAt)
        )
      );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    let extractedData = null;
    if (document.extractedJson) {
      try {
        extractedData = JSON.parse(document.extractedJson);
      } catch {
        extractedData = null;
      }
    }

    res.json({
      document: {
        id: document.id,
        filename: document.filename,
        docType: document.docType,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        uploadedAt: document.uploadedAt,
        extractionStatus: document.extractionStatus,
        extractedData,
        summaryText: document.summaryText,
      },
    });
  } catch (error: any) {
    console.error("Get document error:", error);
    res.status(500).json({ error: error.message || "Failed to get document" });
  }
});

router.post("/:id/reprocess", async (req: Request, res: Response) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  console.log(`[${requestId}] Reprocess request received`);

  try {
    const { id } = req.params;
    const { userId, language } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const [document] = await db
      .select()
      .from(medicalDocuments)
      .where(
        and(
          eq(medicalDocuments.id, id),
          eq(medicalDocuments.userId, userId),
          isNull(medicalDocuments.deletedAt)
        )
      );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.extractionStatus === "PROCESSING") {
      return res.status(400).json({ error: "Document is already being processed" });
    }

    if (!fs.existsSync(document.storagePath)) {
      return res.status(404).json({ error: "Original file not found on server" });
    }

    await db
      .update(medicalDocuments)
      .set({
        extractionStatus: "PENDING" as ExtractionStatus,
        extractedJson: null,
        summaryText: null,
      })
      .where(eq(medicalDocuments.id, id));

    processDocument(
      document.id,
      document.storagePath,
      document.mimeType,
      document.docType as DocType,
      language || "en"
    );

    console.log(`[${requestId}] Reprocessing started for document ${id}`);
    res.json({
      success: true,
      message: "Document reprocessing started",
      documentId: id,
    });
  } catch (error: any) {
    console.error(`[${requestId}] Reprocess error:`, error);
    res.status(500).json({ error: error.message || "Failed to reprocess document" });
  }
});

router.get("/:id/file", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "User ID is required" });
    }

    const [document] = await db
      .select()
      .from(medicalDocuments)
      .where(
        and(
          eq(medicalDocuments.id, id),
          eq(medicalDocuments.userId, userId),
          isNull(medicalDocuments.deletedAt)
        )
      );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!fs.existsSync(document.storagePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${document.filename}"`);
    
    const fileStream = fs.createReadStream(document.storagePath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error("Get file error:", error);
    res.status(500).json({ error: error.message || "Failed to get file" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const [document] = await db
      .select()
      .from(medicalDocuments)
      .where(
        and(
          eq(medicalDocuments.id, id),
          eq(medicalDocuments.userId, userId),
          isNull(medicalDocuments.deletedAt)
        )
      );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    await db
      .update(medicalDocuments)
      .set({ deletedAt: new Date() })
      .where(eq(medicalDocuments.id, id));

    try {
      if (fs.existsSync(document.storagePath)) {
        fs.unlinkSync(document.storagePath);
      }
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: error.message || "Failed to delete document" });
  }
});

export async function getDocumentsForRecommendations(userId: string): Promise<{
  labs: any[];
  summaries: string[];
  hasCriticalFindings: boolean;
  documentCount: number;
}> {
  const documents = await db
    .select()
    .from(medicalDocuments)
    .where(
      and(
        eq(medicalDocuments.userId, userId),
        eq(medicalDocuments.extractionStatus, "SUCCESS"),
        isNull(medicalDocuments.deletedAt)
      )
    )
    .orderBy(desc(medicalDocuments.uploadedAt))
    .limit(5);

  const labs: any[] = [];
  const summaries: string[] = [];
  let hasCriticalFindings = false;

  for (const doc of documents) {
    if (doc.extractedJson) {
      try {
        const data = JSON.parse(doc.extractedJson) as ExtractedDocumentData;
        
        if (data.labs && data.labs.length > 0) {
          labs.push(...data.labs);
          
          for (const lab of data.labs) {
            if (lab.flag && /critical|urgent|panic/i.test(lab.flag)) {
              hasCriticalFindings = true;
            }
          }
        }

        if (data.shortSummary) {
          summaries.push(data.shortSummary);
          
          if (/critical|urgent|emergency|immediate/i.test(data.shortSummary)) {
            hasCriticalFindings = true;
          }
        }
      } catch {
        continue;
      }
    }
  }

  return { labs, summaries, hasCriticalFindings, documentCount: documents.length };
}

export default router;
