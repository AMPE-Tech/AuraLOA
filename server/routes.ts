import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import loaUniaoA2Router from "./routes/loa_uniao_a2";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(loaUniaoA2Router);

  return httpServer;
}
