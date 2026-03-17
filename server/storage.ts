import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { query } from "./db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class PgStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await query<User>(
      "SELECT id, username FROM app_users WHERE id = $1",
      [id],
    );
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await query<User>(
      "SELECT id, username FROM app_users WHERE username = $1",
      [username],
    );
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    await query(
      "INSERT INTO app_users (id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [id, insertUser.username],
    );
    return { id, ...insertUser };
  }
}

export const storage = new PgStorage();
