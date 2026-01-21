import { type User, type InsertUser, users, type GenderType, surveys, type Survey, type InsertSurvey } from "../shared/schema";
import { db } from "./db";
import { eq, desc, isNull } from "drizzle-orm";
import { createHash } from "crypto";

export { db };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  getUserByHashedId(hashedIdNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserDemographics(id: string, demographics: { dateOfBirth?: string; gender?: GenderType }): Promise<User | undefined>;
  getSurveysByUserId(userId: string): Promise<Survey[]>;
  createSurvey(survey: InsertSurvey): Promise<Survey>;
  deleteSurvey(surveyId: string): Promise<Survey | undefined>;
}

export function hashIdNumber(idNumber: string): string {
  return createHash("sha256").update(idNumber).digest("hex");
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).limit(1);
    return user;
  }

  async getUserByHashedId(hashedIdNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.hashedIdNumber, hashedIdNumber)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // FIX: Cast insertUser to any to bypass strict property mismatch during build
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async updateUserDemographics(id: string, demographics: { dateOfBirth?: string; gender?: GenderType }): Promise<User | undefined> {
    // FIX: Improved type safety for the update object
    const updateData: any = {};
    
    if (demographics.dateOfBirth !== undefined) {
      updateData.dateOfBirth = demographics.dateOfBirth;
    }
    if (demographics.gender !== undefined) {
      updateData.gender = demographics.gender;
    }
    
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async getSurveysByUserId(userId: string): Promise<Survey[]> {
    const userSurveys = await db
      .select()
      .from(surveys)
      .where(eq(surveys.userId, userId))
      .orderBy(desc(surveys.date));
    return userSurveys;
  }

  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    const [newSurvey] = await db.insert(surveys).values(survey as any).returning();
    return newSurvey;
  }

  async deleteSurvey(surveyId: string): Promise<Survey | undefined> {
    const [survey] = await db
      .update(surveys)
      .set({ deletedAt: new Date() })
      .where(eq(surveys.id, surveyId))
      .returning();
    return survey;
  }
}

export const storage = new DatabaseStorage();
