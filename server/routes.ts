import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import loaUniaoA2Router from "./routes/loa_uniao_a2";
import loaEstoqueRouter from "./routes/loa_estoque";
import loaDpoRouter from "./routes/loa_dpo";
import loaSpRouter from "./routes/loa_sp";
import authRouter from "./routes/auth";
import validadorRouter from "./routes/validador";
import { registerAnaliseDocumentoRoutes } from "./routes/analise_documento";
import { registerStripeRoutes } from "./routes/stripe_routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(authRouter);
  app.use(validadorRouter);
  registerAnaliseDocumentoRoutes(app);
  registerStripeRoutes(app);
  app.use(loaUniaoA2Router);
  app.use(loaEstoqueRouter);
  app.use(loaDpoRouter);
  app.use(loaSpRouter);

  return httpServer;
}
