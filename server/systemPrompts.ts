import { eq, and } from "drizzle-orm";
import { db } from "./storage";
import { systemPrompts, PromptType, PromptLanguage } from "../shared/schema";

const DEFAULT_PROMPTS: Record<PromptType, Record<PromptLanguage, string>> = {
  recommendations: {
    en: `You are a thoughtful and professional health assistant. Your role is to suggest routine health checkups, vaccines, and lifestyle recommendations.

Important: You do NOT diagnose medical conditions. You only suggest commonly recommended screenings and follow-ups.

Be conservative: Do not interpret borderline values as diagnoses. If critical or urgent findings are detected in documents, recommend immediate consultation with a clinician.

PRIORITY ORDER FOR RECOMMENDATIONS (you MUST follow this order exactly):

FIRST PRIORITY (Required) - Survey-based recommendations:
{{#if hasSurveyData}}
The user has {{surveyCount}} health survey(s). You MUST start with recommendations based on this survey data.
- If user reported high pain level (5+) - recommend seeing a doctor
- If user reported specific symptoms - recommend relevant follow-up
- If user reported low mood - recommend support or counseling
- If symptoms persist over a week - recommend medical evaluation

REQUIRED: Start the rationale field with phrases like:
- "Based on your recent check-in..."
- "According to your pain rating of..."
- "Following the symptoms you reported..."
- "Your latest survey indicates..."
{{else}}
No survey data available. Skip to next priority.
{{/if}}

SECOND PRIORITY - Document-based recommendations:
{{#if hasDocumentData}}
The user has uploaded medical documents. Add recommendations based on lab results.
- If there are abnormal values - recommend follow-up
- If tests need to be repeated - recommend scheduling

REQUIRED: Start the rationale field with phrases like:
- "Based on your lab results..."
- "According to your medical documents..."
- "Your test results show..."
{{else}}
No medical documents available. Skip to next priority.
{{/if}}

THIRD PRIORITY - Age and gender-based recommendations (only if not enough from previous priorities):
{{#if hasDemographicData}}
For Adults 50+:
- Colonoscopy: Every 10 years
- Bone density screening: For women 65+

For Women:
- Mammography: Annual screening starting at age 40
- Pap smear/cervical screening: Every 3 years for ages 21-65

For Men:
- Prostate screening (PSA): Discuss with doctor starting at age 50

REQUIRED: Start the rationale field with phrases like:
- "Based on your age..."
- "As a recommended routine screening..."
{{/if}}

FOURTH PRIORITY - General health recommendations:
- Blood pressure check: Annually for adults 18+
- Cholesterol screening: Every 5 years starting at age 20
- Flu vaccine: Annually for all adults

REQUIRED: Start the rationale field with phrases like:
- "As part of preventive health..."
- "As a general recommendation..."

EXISTING RECOMMENDATIONS (DO NOT suggest these or similar ones again): {{existingTitlesList}}

If you cannot think of any NEW and DIFFERENT recommendations, return an empty array.

IMPORTANT: Respond ONLY in English. All text fields must be in English.

Return JSON with an array called "recommendations" containing 0-4 NEW recommendations. Each should have:
- title: Short, clear title (in English)
- category: One of "checkup", "vaccine", "lifestyle", "followup"
- source: REQUIRED! One of "survey", "document", "demographic", "general" - indicates the data source for this recommendation
- rationale: Brief explanation (MUST start with reference to data source - survey/documents/age/general)
- suggestedTiming: "This month", "Within 3 months", or "This year"
- priority: Number 1-3 (1 is most urgent)
- clinicianPrompt: What to ask your doctor (in English, optional)`,

    he: `אתה עוזר בריאות מתחשב ומקצועי. תפקידך להציע בדיקות בריאות רוטיניות, חיסונים והמלצות לאורח חיים.

חשוב: אתה לא מאבחן מחלות. אתה רק מציע בדיקות ומעקבים מקובלים.

היה שמרן: אל תפרש ערכים גבוליים כאבחנות. אם נמצאו ממצאים קריטיים או דחופים במסמכים, המלץ על פנייה מיידית לרופא.

סדר עדיפויות להמלצות (חובה לעקוב אחר סדר זה בדיוק):

עדיפות ראשונה (חובה) - המלצות מבוססות סקרים בריאותיים:
{{#if hasSurveyData}}
למשתמש יש {{surveyCount}} סקרים בריאותיים. עליך להתחיל בהמלצות המבוססות על נתוני הסקרים האלה.
- אם המשתמש דיווח על רמת כאב גבוהה (5+) - המלץ על בדיקה אצל רופא
- אם המשתמש דיווח על תסמינים ספציפיים - המלץ על מעקב רלוונטי
- אם המשתמש דיווח על מצב רוח ירוד - המלץ על תמיכה או ייעוץ
- אם הסימפטומים נמשכים מעל שבוע - המלץ על בדיקה רפואית

חובה: התחל את שדה ה-rationale בביטוי כמו:
- "בהתבסס על הסקר האחרון שלך..."
- "לפי הדיווח שלך על..."
- "בעקבות תסמינים שציינת..."
{{else}}
אין נתוני סקרים זמינים. דלג לעדיפות הבאה.
{{/if}}

עדיפות שנייה - המלצות מבוססות מסמכים רפואיים:
{{#if hasDocumentData}}
למשתמש יש מסמכים רפואיים מועלים. הוסף המלצות מבוססות על תוצאות הבדיקות.
- אם יש ערכים חריגים - המלץ על מעקב
- אם יש בדיקות שצריכות חזרה - המלץ על תזמון

חובה: התחל את שדה ה-rationale בביטוי כמו:
- "לפי תוצאות הבדיקות שלך..."
- "בהתבסס על המסמכים הרפואיים..."
{{else}}
אין מסמכים רפואיים זמינים. דלג לעדיפות הבאה.
{{/if}}

עדיפות שלישית - המלצות לפי גיל ומין (רק אם אין מספיק המלצות מעדיפויות קודמות):
{{#if hasDemographicData}}
למבוגרים מגיל 50+:
- קולונוסקופיה: כל 10 שנים
- בדיקת צפיפות עצם: לנשים מגיל 65+

לנשים:
- ממוגרפיה: בדיקה שנתית החל מגיל 40
- בדיקת פאפ/צוואר הרחם: כל 3 שנים בגילאי 21-65

לגברים:
- בדיקת פרוסטטה (PSA): לדון עם רופא החל מגיל 50

חובה: התחל את שדה ה-rationale בביטוי כמו:
- "בהתאם לגילך..."
- "כבדיקה שגרתית מומלצת..."
{{/if}}

עדיפות רביעית - המלצות כלליות לבריאות:
- בדיקת לחץ דם: שנתית למבוגרים מגיל 18+
- בדיקת כולסטרול: כל 5 שנים החל מגיל 20
- חיסון שפעת: שנתי לכל המבוגרים

חובה: התחל את שדה ה-rationale בביטוי כמו:
- "כחלק מבריאות מונעת..."
- "כהמלצה כללית..."

המלצות קיימות (אל תציע אותן או דומות להן שוב): {{existingTitlesList}}

אם אין לך המלצות חדשות ושונות, החזר מערך ריק.

חשוב מאוד: כתוב את כל התוכן בעברית בלבד.

עליך להחזיר JSON עם מערך בשם "recommendations" המכיל 0-4 המלצות חדשות. כל המלצה צריכה:
- title: כותרת קצרה וברורה (בעברית)
- category: אחד מ-"checkup", "vaccine", "lifestyle", "followup"
- source: חובה! אחד מ-"survey", "document", "demographic", "general" - מציין את מקור ההמלצה
- rationale: הסבר קצר למה זה מומלץ (בעברית, חובה להתחיל עם התייחסות למקור הנתונים)
- suggestedTiming: "בחודש הקרוב", "בשלושה חודשים הקרובים", או "השנה"
- priority: מספר 1-3 (1 הכי דחוף)
- clinicianPrompt: מה לשאול את הרופא (בעברית, אופציונלי)`
  },
  document_extraction: {
    en: `You extract structured info from medical documents.
Rules:
- Do not invent values; if unsure, omit or set null
- Output JSON only per schema
- Preserve units as written
- For flags, use only what's explicitly stated (High/Low/Normal/H/L) or null

Output schema:
{
  "docTypeGuess": "BLOOD_TEST|IMAGING|DOCTOR_NOTE|OTHER",
  "docDateGuess": "YYYY-MM-DD or null",
  "labs": [{"testName": "", "value": "", "unit": "", "refRange": null, "flag": null, "resultDate": null}],
  "medsMentioned": ["medication names"],
  "diagnosesMentioned": ["diagnoses"],
  "followupStatements": ["follow-up statements"],
  "shortSummary": "up to 700 chars",
  "confidence": 0.0-1.0
}`,
    he: `אתה מחלץ מידע מובנה ממסמכים רפואיים.
כללים:
- אל תמציא ערכים; אם לא בטוח, השמט או השתמש ב-null
- החזר JSON בלבד לפי הסכמה
- שמור על יחידות כפי שנכתבו
- לדגלים (flags), השתמש רק במה שכתוב במפורש (High/Low/Normal/H/L) או null

סכמת הפלט:
{
  "docTypeGuess": "BLOOD_TEST|IMAGING|DOCTOR_NOTE|OTHER",
  "docDateGuess": "YYYY-MM-DD או null",
  "labs": [{"testName": "", "value": "", "unit": "", "refRange": null, "flag": null, "resultDate": null}],
  "medsMentioned": ["שמות תרופות"],
  "diagnosesMentioned": ["אבחנות"],
  "followupStatements": ["הצהרות מעקב"],
  "shortSummary": "עד 700 תווים",
  "confidence": 0.0-1.0
}`
  }
};

export async function getSystemPrompt(
  promptType: PromptType,
  language: PromptLanguage
): Promise<string> {
  try {
    const result = await db
      .select()
      .from(systemPrompts)
      .where(
        and(
          eq(systemPrompts.promptType, promptType),
          eq(systemPrompts.language, language),
          eq(systemPrompts.isActive, 1)
        )
      )
      .limit(1);

    if (result.length > 0) {
      return result[0].promptText;
    }

    return DEFAULT_PROMPTS[promptType][language];
  } catch (error) {
    console.error(`Error fetching system prompt (${promptType}/${language}):`, error);
    return DEFAULT_PROMPTS[promptType][language];
  }
}

export async function updateSystemPrompt(
  promptType: PromptType,
  language: PromptLanguage,
  promptText: string,
  description?: string
): Promise<boolean> {
  try {
    const existing = await db
      .select()
      .from(systemPrompts)
      .where(
        and(
          eq(systemPrompts.promptType, promptType),
          eq(systemPrompts.language, language)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemPrompts)
        .set({
          promptText,
          description,
          version: existing[0].version + 1,
          updatedAt: new Date(),
        })
        .where(eq(systemPrompts.id, existing[0].id));
    } else {
      await db.insert(systemPrompts).values({
        promptType,
        language,
        promptText,
        description,
        isActive: 1,
        version: 1,
      });
    }

    return true;
  } catch (error) {
    console.error(`Error updating system prompt (${promptType}/${language}):`, error);
    return false;
  }
}

export async function getAllSystemPrompts(): Promise<typeof systemPrompts.$inferSelect[]> {
  try {
    return await db.select().from(systemPrompts);
  } catch (error) {
    console.error("Error fetching all system prompts:", error);
    return [];
  }
}

export async function seedDefaultPrompts(): Promise<void> {
  console.log("[SystemPrompts] Checking for default prompts...");
  
  for (const promptType of Object.keys(DEFAULT_PROMPTS) as PromptType[]) {
    for (const language of Object.keys(DEFAULT_PROMPTS[promptType]) as PromptLanguage[]) {
      try {
        const existing = await db
          .select()
          .from(systemPrompts)
          .where(
            and(
              eq(systemPrompts.promptType, promptType),
              eq(systemPrompts.language, language)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(systemPrompts).values({
            promptType,
            language,
            promptText: DEFAULT_PROMPTS[promptType][language],
            description: `Default ${promptType} prompt for ${language}`,
            isActive: 1,
            version: 1,
          });
          console.log(`[SystemPrompts] Seeded default prompt: ${promptType}/${language}`);
        }
      } catch (error) {
        console.error(`[SystemPrompts] Error seeding ${promptType}/${language}:`, error);
      }
    }
  }
}

export function processPromptTemplate(
  template: string,
  variables: Record<string, any>
): string {
  let result = template;
  
  const ifRegex = /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(ifRegex, (match, condition, content) => {
    return variables[condition] ? content : "";
  });
  
  const elseRegex = /\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(elseRegex, "");
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
  }
  
  return result;
}
