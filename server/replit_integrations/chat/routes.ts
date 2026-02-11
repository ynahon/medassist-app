import type { Express, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { chatStorage } from "./storage";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const AI_DOCTOR_SYSTEM_PROMPT = `You are a warm, empathetic AI medical assistant called "Dr. MedAssist". You help users understand their health concerns by listening carefully and providing thoughtful, evidence-based guidance.

IMPORTANT RULES:
- You are NOT a real doctor. Always remind users that your advice is informational only and they should consult a real healthcare professional for diagnosis and treatment.
- Keep responses SHORT (2-4 sentences) because they may be spoken aloud via text-to-speech. Use natural, conversational language.
- Ask 1-2 clarifying questions when the user's symptoms are vague.
- Be empathetic and reassuring, but honest.
- NEVER diagnose conditions definitively. Use phrases like "this could suggest", "it might be worth checking", "many people experience this when".
- SAFETY TRIAGE: If the user describes symptoms that could indicate an emergency (chest pain, difficulty breathing, sudden severe headache, signs of stroke, heavy bleeding, suicidal thoughts), respond IMMEDIATELY with: "This could be urgent. Please seek emergency help now by calling emergency services or going to the nearest emergency room." Then provide brief guidance while waiting for help.
- Use simple language that anyone can understand.
- When appropriate, suggest what type of specialist they might want to see.
- Remember previous messages in the conversation for context.`;


export function registerChatRoutes(app: Express): void {
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      await chatStorage.createMessage(conversationId, "user", content);

      const language = req.body.language || "en";

      const messages = await chatStorage.getMessagesByConversation(conversationId);

      const systemInstruction = AI_DOCTOR_SYSTEM_PROMPT + (language === "he"
        ? "\n\nIMPORTANT: Respond in Hebrew. Use simple Hebrew that is easy to understand."
        : "");

      const chatHistory = messages.slice(0, -1).map((m) => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        parts: [{ text: m.content }],
      }));

      const chat = geminiModel.startChat({
        history: chatHistory,
        systemInstruction: {
          role: "user",
          parts: [{ text: systemInstruction }],
        },
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const result = await chat.sendMessageStream(content);

      let fullResponse = "";

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      await chatStorage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}
