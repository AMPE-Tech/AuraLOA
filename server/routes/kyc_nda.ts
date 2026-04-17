/**
 * KYC + NDA + Billing — AuraLOA Marketplace
 *
 * Fluxo obrigatório do cliente:
 *   1. Cadastro básico (email + senha + dados)
 *   2. Upload KYC (CNH, comprovante endereço, contrato social)
 *   3. Captura de selfie + liveness
 *   4. Assinatura NDA (obrigatória)
 *   5. Aprovação admin (Marcos)
 *   6. Checkout Stripe (USD 100/mês)
 *   7. Acesso liberado
 *
 * REGRA CRÍTICA: Todos os documentos KYC ficam em /var/www/auraloa/kyc-storage/
 *                SOMENTE o admin acessa via /api/admin/kyc/*
 *                Cliente faz upload mas NUNCA baixa de volta.
 */

import { Router, type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { query } from "../db";

const router = Router();
const SESSION_SECRET = process.env.SESSION_SECRET!;
if (!SESSION_SECRET) throw new Error("[KYC] SESSION_SECRET não definido no .env");

// ── Diretório protegido de KYC ───────────────────────────────────────────────
// Fora de dist/public — Nginx NÃO serve como estático
const KYC_STORAGE_DIR = process.env.KYC_STORAGE_DIR || path.resolve("kyc-storage");
if (!fs.existsSync(KYC_STORAGE_DIR)) {
  fs.mkdirSync(KYC_STORAGE_DIR, { recursive: true });
}

// ── NDA — versão atual ────────────────────────────────────────────────────────
const NDA_VERSAO = "1.0.0";
const NDA_TEXTO_PATH = path.resolve("docs/contratos-modelos/nda_auraloa_v1.0.0.md");

function carregarTextoNDA(): string {
  if (!fs.existsSync(NDA_TEXTO_PATH)) {
    throw new Error(`[KYC] NDA template não encontrado em ${NDA_TEXTO_PATH}`);
  }
  return fs.readFileSync(NDA_TEXTO_PATH, "utf-8");
}

// ── Multer — upload com validação ────────────────────────────────────────────
const upload = multer({
  dest: path.join(KYC_STORAGE_DIR, "_temp"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Formato inválido. Apenas JPG, PNG, WEBP ou PDF."));
    }
    cb(null, true);
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function gerarSlugCliente(nome: string, cpfCnpj: string): string {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 30);
  const hash = crypto.createHash("sha256").update(cpfCnpj).digest("hex").slice(0, 6);
  return `${base}_${hash}`;
}

function calcularSHA256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function registrarAcesso(clienteSlug: string | null, tipo: string, rota: string, sucesso: boolean, detalhes: any, req: Request): void {
  query(
    `INSERT INTO kyc_acessos (cliente_slug, tipo, rota, sucesso, detalhes, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [clienteSlug, tipo, rota, sucesso, JSON.stringify(detalhes), req.ip, req.headers["user-agent"] || null]
  ).catch((e) => console.error("[KYC] Erro ao registrar acesso:", e.message));
}

function verificarTokenCliente(req: Request): { valid: boolean; cliente_slug?: string } {
  const rawToken = req.query["t"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const token = rawToken ? String(rawToken) : undefined;
  if (!token) return { valid: false };
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    if (decoded.kycAccess === true && decoded.cliente_slug) {
      return { valid: true, cliente_slug: decoded.cliente_slug };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

function verificarAdmin(req: Request): boolean {
  const rawToken = req.query["t"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const token = rawToken ? String(rawToken) : undefined;
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    return decoded.role === "admin" && decoded.email === "marcos@auradue.com";
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS — CADASTRO E UPLOAD KYC (CLIENTE)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/kyc/cadastro — cadastro inicial do cliente
router.post("/api/kyc/cadastro", async (req: Request, res: Response) => {
  const { nome_completo, cpf_cnpj, tipo, email, telefone, whatsapp, endereco, razao_social, nome_fantasia, perfil_atuacao, senha } = req.body;

  if (!nome_completo || !cpf_cnpj || !tipo || !email || !senha) {
    return res.status(400).json({ error: "Campos obrigatórios: nome_completo, cpf_cnpj, tipo, email, senha" });
  }
  if (!["PF", "PJ"].includes(tipo)) return res.status(400).json({ error: "tipo deve ser PF ou PJ" });
  if (senha.length < 8) return res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });

  const cpfCnpjLimpo = String(cpf_cnpj).replace(/\D/g, "");
  const clienteSlug = gerarSlugCliente(nome_completo, cpfCnpjLimpo);

  try {
    // Verificar duplicidade
    const existe = await query(`SELECT id FROM kyc_clientes WHERE cpf_cnpj = $1 OR email = $2`, [cpfCnpjLimpo, email]);
    if (existe.length > 0) {
      registrarAcesso(null, "cadastro_duplicado", "/api/kyc/cadastro", false, { cpf_cnpj: cpfCnpjLimpo, email }, req);
      return res.status(409).json({ error: "CPF/CNPJ ou email já cadastrado" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await query(
      `INSERT INTO kyc_clientes (cliente_slug, nome_completo, cpf_cnpj, tipo, email, telefone, whatsapp, endereco, razao_social, nome_fantasia, perfil_atuacao, ip_cadastro, user_agent_cadastro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        clienteSlug, nome_completo, cpfCnpjLimpo, tipo, email, telefone || null, whatsapp || null,
        endereco ? JSON.stringify(endereco) : null, razao_social || null, nome_fantasia || null,
        perfil_atuacao || null, req.ip, req.headers["user-agent"] || null
      ]
    );

    // Criar diretório do cliente
    const pastaCliente = path.join(KYC_STORAGE_DIR, clienteSlug);
    fs.mkdirSync(pastaCliente, { recursive: true });

    // Salvar senha hash em arquivo separado (fora de dist/public)
    fs.writeFileSync(path.join(pastaCliente, ".auth"), senhaHash, { mode: 0o600 });

    // Gerar token temporário (válido 24h) para continuar onboarding
    const token = jwt.sign(
      { kycAccess: true, cliente_slug: clienteSlug, onboarding: true },
      SESSION_SECRET,
      { expiresIn: "24h" }
    );

    registrarAcesso(clienteSlug, "cadastro_sucesso", "/api/kyc/cadastro", true, {}, req);

    return res.status(201).json({
      ok: true,
      cliente_slug: clienteSlug,
      token,
      proxima_etapa: "upload_documentos",
      mensagem: "Cadastro realizado. Faça upload dos documentos (CNH, comprovante de endereço).",
    });
  } catch (err: any) {
    console.error("[KYC] Erro cadastro:", err);
    return res.status(500).json({ error: "Erro interno no cadastro", detalhe: err.message });
  }
});

// POST /api/kyc/upload/:tipo — upload de documento (cliente autenticado)
const TIPOS_PERMITIDOS = ["cnh_frente", "cnh_verso", "rg_frente", "rg_verso", "comprovante_endereco", "contrato_social", "procuracao", "selfie"];

router.post("/api/kyc/upload/:tipo", upload.single("arquivo"), async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const tipo = String(req.params.tipo);
  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Permitidos: ${TIPOS_PERMITIDOS.join(", ")}` });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Arquivo não enviado (campo 'arquivo')" });
  }

  try {
    const clienteSlug = check.cliente_slug;
    const pastaCliente = path.join(KYC_STORAGE_DIR, clienteSlug);
    fs.mkdirSync(pastaCliente, { recursive: true });

    const sha256 = calcularSHA256(req.file.path);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = path.extname(req.file.originalname) || ".bin";
    const nomeFinal = `${tipo}_${timestamp}_${sha256.slice(0, 8)}${ext}`;
    const caminhoFinal = path.join(pastaCliente, nomeFinal);

    fs.renameSync(req.file.path, caminhoFinal);
    fs.chmodSync(caminhoFinal, 0o600);

    await query(
      `INSERT INTO kyc_documentos (cliente_slug, tipo, nome_original, caminho_arquivo, mime_type, tamanho_bytes, sha256, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [clienteSlug, tipo, req.file.originalname, caminhoFinal, req.file.mimetype, req.file.size, sha256, req.ip, req.headers["user-agent"] || null]
    );

    registrarAcesso(clienteSlug, "upload_documento", `/api/kyc/upload/${tipo}`, true, { tipo, tamanho_kb: (req.file.size / 1024).toFixed(0), sha256 }, req);

    return res.json({
      ok: true,
      tipo,
      tamanho_kb: Math.round(req.file.size / 1024),
      sha256,
      mensagem: `${tipo} recebido. Continue o processo de cadastro.`,
    });
  } catch (err: any) {
    console.error("[KYC] Erro upload:", err);
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
    return res.status(500).json({ error: "Erro ao salvar documento", detalhe: err.message });
  }
});

// POST /api/kyc/biometria — registra selfie + score liveness
router.post("/api/kyc/biometria", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { selfie_sha256, score_liveness, score_match, provider, detalhes } = req.body;
  if (!selfie_sha256) return res.status(400).json({ error: "selfie_sha256 obrigatório (faça upload via /api/kyc/upload/selfie primeiro)" });

  try {
    // Buscar CNH para match facial
    const cnhDocs = await query(
      `SELECT sha256 FROM kyc_documentos WHERE cliente_slug = $1 AND tipo = 'cnh_frente' ORDER BY upload_em DESC LIMIT 1`,
      [check.cliente_slug]
    );
    const cnh_sha256 = cnhDocs[0]?.sha256 || null;

    const aprovado = (score_liveness >= 85 && (!cnh_sha256 || score_match >= 80));

    await query(
      `INSERT INTO kyc_biometria (cliente_slug, tipo, selfie_sha256, cnh_sha256, score_liveness, score_match, aprovado, provider, detalhes, ip)
       VALUES ($1, 'facial_liveness', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [check.cliente_slug, selfie_sha256, cnh_sha256, score_liveness || null, score_match || null, aprovado, provider || "manual", detalhes ? JSON.stringify(detalhes) : null, req.ip]
    );

    await query(`UPDATE kyc_clientes SET status_biometria = $1 WHERE cliente_slug = $2`, [aprovado ? "capturada" : "rejeitada", check.cliente_slug]);

    registrarAcesso(check.cliente_slug, "biometria_capturada", "/api/kyc/biometria", aprovado, { score_liveness, score_match }, req);

    return res.json({ ok: true, aprovado, proxima_etapa: "assinar_nda" });
  } catch (err: any) {
    console.error("[KYC] Erro biometria:", err);
    return res.status(500).json({ error: "Erro ao registrar biometria" });
  }
});

// GET /api/kyc/nda/texto — retorna texto do NDA com placeholders
router.get("/api/kyc/nda/texto", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  try {
    // Tentar banco com retry (ECONNRESET pode ocorrer em conexões longas)
    let cliente: any[] = [];
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        cliente = await query(`SELECT nome_completo, cpf_cnpj, email FROM kyc_clientes WHERE cliente_slug = $1`, [check.cliente_slug]);
        break;
      } catch (dbErr: any) {
        if (tentativa === 3) throw dbErr;
        console.warn(`[KYC] Retry DB tentativa ${tentativa}: ${dbErr.message}`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (cliente.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });

    let texto = carregarTextoNDA();
    const agora = new Date();

    texto = texto
      .replace(/\{\{NOME_COMPLETO\}\}/g, cliente[0].nome_completo)
      .replace(/\{\{CPF_CNPJ\}\}/g, cliente[0].cpf_cnpj)
      .replace(/\{\{EMAIL\}\}/g, cliente[0].email)
      .replace(/\{\{IP\}\}/g, String(req.ip || "N/A"))
      .replace(/\{\{USER_AGENT\}\}/g, String(req.headers["user-agent"] || "N/A"))
      .replace(/\{\{TIMESTAMP_ISO\}\}/g, agora.toISOString());

    const sha256Texto = crypto.createHash("sha256").update(texto).digest("hex");

    return res.json({
      ok: true,
      versao: NDA_VERSAO,
      texto,
      sha256: sha256Texto,
      preview_url: `/portal/nda-preview?t=${req.query.t}`,
    });
  } catch (err: any) {
    console.error("[KYC] Erro NDA texto:", err);
    return res.status(500).json({ error: "Erro ao carregar NDA" });
  }
});

// POST /api/kyc/nda/assinar — registra assinatura do NDA
router.post("/api/kyc/nda/assinar", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { aceite_leitura, aceite_penalidades, aceite_veracidade, aceite_cadeia_custodia, aceite_copia_email, geolocalizacao } = req.body;

  const todosAceites = aceite_leitura && aceite_penalidades && aceite_veracidade && aceite_cadeia_custodia && aceite_copia_email;
  if (!todosAceites) {
    return res.status(400).json({ error: "Todos os 5 aceites são obrigatórios" });
  }

  try {
    const cliente = await query(`SELECT nome_completo, cpf_cnpj, email, status_nda FROM kyc_clientes WHERE cliente_slug = $1`, [check.cliente_slug]);
    if (cliente.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });
    if (cliente[0].status_nda === "assinado") return res.status(409).json({ error: "NDA já assinado anteriormente" });

    let texto = carregarTextoNDA();
    const agora = new Date();
    const timestampIso = agora.toISOString();
    const ip = req.ip || "N/A";
    const userAgent = String(req.headers["user-agent"] || "N/A");

    texto = texto
      .replace(/\{\{NOME_COMPLETO\}\}/g, cliente[0].nome_completo)
      .replace(/\{\{CPF_CNPJ\}\}/g, cliente[0].cpf_cnpj)
      .replace(/\{\{EMAIL\}\}/g, cliente[0].email)
      .replace(/\{\{IP\}\}/g, ip)
      .replace(/\{\{USER_AGENT\}\}/g, userAgent)
      .replace(/\{\{TIMESTAMP_ISO\}\}/g, timestampIso);

    const ndaSha256 = crypto.createHash("sha256").update(texto).digest("hex");

    const aceites = { aceite_leitura, aceite_penalidades, aceite_veracidade, aceite_cadeia_custodia, aceite_copia_email };
    const evidenciaTexto = JSON.stringify({ ndaSha256, nome: cliente[0].nome_completo, cpf_cnpj: cliente[0].cpf_cnpj, ip, userAgent, timestampIso, aceites, geolocalizacao });
    const evidenciaSha256 = crypto.createHash("sha256").update(evidenciaTexto).digest("hex");

    // Salvar PDF/TXT do NDA assinado
    const pastaCliente = path.join(KYC_STORAGE_DIR, check.cliente_slug);
    const nomeArquivoNda = `nda_assinado_${timestampIso.replace(/[:.]/g, "-")}_${evidenciaSha256.slice(0, 8)}.txt`;
    const caminhoNda = path.join(pastaCliente, nomeArquivoNda);
    const conteudoNda = `${texto}\n\n===============================\nEVIDÊNCIA DE ASSINATURA\n===============================\nSHA-256 Texto NDA: ${ndaSha256}\nSHA-256 Evidência: ${evidenciaSha256}\nAceites: ${JSON.stringify(aceites, null, 2)}\nGeolocalização: ${JSON.stringify(geolocalizacao || null)}\n`;
    fs.writeFileSync(caminhoNda, conteudoNda, { mode: 0o600 });

    await query(
      `INSERT INTO nda_assinaturas (cliente_slug, nda_versao, nda_sha256, texto_integral, nome_assinante, cpf_cnpj, email, ip, user_agent, geolocalizacao, aceites_checkboxes, assinado_em_iso, evidencia_sha256, pdf_gerado_caminho)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [check.cliente_slug, NDA_VERSAO, ndaSha256, texto, cliente[0].nome_completo, cliente[0].cpf_cnpj, cliente[0].email, ip, userAgent, geolocalizacao ? JSON.stringify(geolocalizacao) : null, JSON.stringify(aceites), timestampIso, evidenciaSha256, caminhoNda]
    );

    await query(`UPDATE kyc_clientes SET status_nda = 'assinado' WHERE cliente_slug = $1`, [check.cliente_slug]);

    registrarAcesso(check.cliente_slug, "nda_assinado", "/api/kyc/nda/assinar", true, { evidenciaSha256, ndaSha256 }, req);

    return res.json({
      ok: true,
      evidencia_sha256: evidenciaSha256,
      nda_sha256: ndaSha256,
      versao: NDA_VERSAO,
      assinado_em: timestampIso,
      proxima_etapa: "aguardar_aprovacao_admin",
      mensagem: "NDA assinado com sucesso. Documentos enviados para análise do administrador.",
    });
  } catch (err: any) {
    console.error("[KYC] Erro NDA assinar:", err);
    return res.status(500).json({ error: "Erro ao registrar assinatura" });
  }
});

// GET /api/kyc/status — cliente consulta status do próprio onboarding
router.get("/api/kyc/status", async (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente_slug) {
    return res.status(401).json({ error: "Token inválido" });
  }

  try {
    const cliente = await query(
      `SELECT cliente_slug, nome_completo, email, tipo, status, status_nda, status_biometria, cadastrado_em, aprovado_em, motivo_rejeicao
       FROM kyc_clientes WHERE cliente_slug = $1`,
      [check.cliente_slug]
    );
    if (cliente.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });

    const docs = await query(`SELECT tipo, upload_em FROM kyc_documentos WHERE cliente_slug = $1 ORDER BY upload_em DESC`, [check.cliente_slug]);
    const ndaCount = await query(`SELECT COUNT(*)::int AS n FROM nda_assinaturas WHERE cliente_slug = $1`, [check.cliente_slug]);

    return res.json({
      ok: true,
      cliente: cliente[0],
      documentos: docs,
      nda_assinado: ndaCount[0]?.n > 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao consultar status" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ENDPOINTS ADMIN — somente Marcos (role: admin)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/kyc/pendentes — lista de clientes aguardando aprovação
router.get("/api/admin/kyc/pendentes", async (req: Request, res: Response) => {
  if (!verificarAdmin(req)) {
    registrarAcesso(null, "tentativa_admin_negada", "/api/admin/kyc/pendentes", false, {}, req);
    return res.status(403).json({ error: "Acesso restrito ao administrador" });
  }

  try {
    const pendentes = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM kyc_documentos WHERE cliente_slug = c.cliente_slug)::int AS total_docs,
        (SELECT assinado_em FROM nda_assinaturas WHERE cliente_slug = c.cliente_slug ORDER BY id DESC LIMIT 1) AS nda_assinado_em
       FROM kyc_clientes c
       WHERE c.status IN ('pendente','em_analise')
       ORDER BY c.cadastrado_em DESC`
    );
    return res.json({ ok: true, total: pendentes.length, pendentes });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao listar pendentes" });
  }
});

// GET /api/admin/kyc/:cliente_slug — detalhes completos do cliente
router.get("/api/admin/kyc/:cliente_slug", async (req: Request, res: Response) => {
  if (!verificarAdmin(req)) {
    registrarAcesso(null, "tentativa_admin_negada", req.path, false, {}, req);
    return res.status(403).json({ error: "Acesso restrito ao administrador" });
  }

  const slug = String(req.params.cliente_slug);
  try {
    const cliente = await query(`SELECT * FROM kyc_clientes WHERE cliente_slug = $1`, [slug]);
    if (cliente.length === 0) return res.status(404).json({ error: "Cliente não encontrado" });

    const docs = await query(`SELECT * FROM kyc_documentos WHERE cliente_slug = $1 ORDER BY upload_em DESC`, [slug]);
    const bio = await query(`SELECT * FROM kyc_biometria WHERE cliente_slug = $1 ORDER BY capturado_em DESC LIMIT 1`, [slug]);
    const nda = await query(`SELECT id, nda_versao, nda_sha256, evidencia_sha256, assinado_em_iso, ip FROM nda_assinaturas WHERE cliente_slug = $1`, [slug]);
    const cotas = await query(`SELECT * FROM billing_cotas WHERE cliente_slug = $1 ORDER BY periodo_inicio DESC LIMIT 1`, [slug]);

    return res.json({ ok: true, cliente: cliente[0], documentos: docs, biometria: bio[0] || null, nda: nda[0] || null, cota_atual: cotas[0] || null });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao buscar cliente" });
  }
});

// GET /api/admin/kyc/:cliente_slug/documento/:doc_id — servir arquivo KYC (admin-only)
router.get("/api/admin/kyc/:cliente_slug/documento/:doc_id", async (req: Request, res: Response) => {
  if (!verificarAdmin(req)) {
    registrarAcesso(null, "tentativa_admin_negada", req.path, false, {}, req);
    return res.status(403).send("Acesso restrito ao administrador");
  }

  const slug = String(req.params.cliente_slug);
  const docId = parseInt(String(req.params.doc_id), 10);
  if (isNaN(docId)) return res.status(400).send("doc_id inválido");

  try {
    const docs = await query(`SELECT caminho_arquivo, mime_type, nome_original FROM kyc_documentos WHERE id = $1 AND cliente_slug = $2`, [docId, slug]);
    if (docs.length === 0) return res.status(404).send("Documento não encontrado");

    const caminho = docs[0].caminho_arquivo;
    if (!fs.existsSync(caminho)) return res.status(404).send("Arquivo físico não encontrado");

    registrarAcesso(slug, "admin_visualizou_documento", req.path, true, { doc_id: docId }, req);

    res.setHeader("Content-Type", docs[0].mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${docs[0].nome_original}"`);
    return res.sendFile(path.resolve(caminho));
  } catch (err: any) {
    return res.status(500).send("Erro ao servir documento");
  }
});

// POST /api/admin/kyc/:cliente_slug/aprovar — admin aprova cliente
router.post("/api/admin/kyc/:cliente_slug/aprovar", async (req: Request, res: Response) => {
  if (!verificarAdmin(req)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador" });
  }
  const slug = String(req.params.cliente_slug);
  try {
    await query(
      `UPDATE kyc_clientes SET status = 'aprovado', aprovado_em = NOW(), aprovado_por = 'marcos@auradue.com' WHERE cliente_slug = $1`,
      [slug]
    );
    registrarAcesso(slug, "admin_aprovou_cliente", req.path, true, {}, req);
    return res.json({ ok: true, mensagem: "Cliente aprovado. Aguardando assinatura Stripe." });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao aprovar cliente" });
  }
});

// POST /api/admin/kyc/:cliente_slug/rejeitar — admin rejeita cliente
router.post("/api/admin/kyc/:cliente_slug/rejeitar", async (req: Request, res: Response) => {
  if (!verificarAdmin(req)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador" });
  }
  const slug = String(req.params.cliente_slug);
  const { motivo } = req.body;
  if (!motivo) return res.status(400).json({ error: "Motivo obrigatório" });
  try {
    await query(
      `UPDATE kyc_clientes SET status = 'rejeitado', motivo_rejeicao = $1 WHERE cliente_slug = $2`,
      [motivo, slug]
    );
    registrarAcesso(slug, "admin_rejeitou_cliente", req.path, true, { motivo }, req);
    return res.json({ ok: true, mensagem: "Cliente rejeitado." });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao rejeitar cliente" });
  }
});

export default router;
