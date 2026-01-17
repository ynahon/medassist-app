import { type User, type InsertUser, users, type GenderType } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

export { db };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByPhone(phoneNumber: string): Promise<User | undefined>;
  getUserByHashedId(hashedIdNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserDemographics(id: string, demographics: { dateOfBirth?: string; gender?: GenderType }): Promise<User | undefined>;
}

export function hashIdNumber(idNumber: string): string {
  return createHash("sha256").update(idNumber).digest("hex");
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByPhone(phoneNumber: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).limit(1);
    return result[0];
  }

  async getUserByHashedId(hashedIdNumber: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.hashedIdNumber, hashedIdNumber)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async updateUserDemographics(id: string, demographics: { dateOfBirth?: string; gender?: GenderType }): Promise<User | undefined> {
    const updateData: Partial<{ dateOfBirth: string | null; gender: GenderType | null }> = {};
    if (demographics.dateOfBirth !== undefined) {
      updateData.dateOfBirth = demographics.dateOfBirth;
    }
    if (demographics.gender !== undefined) {
      updateData.gender = demographics.gender;
    }
    
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
