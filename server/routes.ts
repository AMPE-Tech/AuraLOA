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
import dueDiligenceViewerRouter from "./routes/due_diligence_viewer";
import ddPipelineRouter from "./routes/dd_pipeline";
import dashboardRouter from "./routes/dashboard";
import lotesRouter from "./routes/lotes";
import ddAuditRouter from "./routes/dd_audit";
import kycNdaRouter from "./routes/kyc_nda";
import billingAuraloaRouter from "./routes/billing_auraloa";
import enriquecimentoRouter from "./routes/enriquecimento";
import v2Router from "./v2/routes_v2";
import v2LoteRouter from "./v2/routes_lote";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(authRouter);
  app.use(dashboardRouter);
  app.use(lotesRouter);
  app.use(dueDiligenceViewerRouter);
  app.use(ddPipelineRouter);
  app.use(ddAuditRouter);
  app.use(kycNdaRouter);
  app.use(billingAuraloaRouter);
  app.use(enriquecimentoRouter);
  app.use(v2Router);
  app.use(v2LoteRouter);
  app.use(validadorRouter);
  registerAnaliseDocumentoRoutes(app);
  registerStripeRoutes(app);
  app.use(loaUniaoA2Router);
  app.use(loaEstoqueRouter);
  app.use(loaDpoRouter);
  app.use(loaSpRouter);

  return httpServer;
}
