/**
 * due_diligence_viewer.ts
 * Viewer web protegido para relatórios de due diligence criminal.
 * Acesso via URL com senha — sem necessidade de conta AuraLOA.
 *
 * Rotas:
 *   GET  /due-diligence/:id           → página de login
 *   POST /due-diligence/:id/auth      → valida senha, redireciona com token
 *   GET  /due-diligence/:id/relatorio → serve o HTML (requer token válido)
 */

import { Router, type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET || "aura-loa-default-secret-key";
const REPORTS_BASE = path.resolve(
  process.env.DUE_DILIGENCE_REPORTS_PATH || "./Saida/due_diligence"
);

// ── Helpers ────────────────────────────────────────────────────────────────

function encontrarRelatorioHTML(pasta: string): string | null {
  if (!fs.existsSync(pasta)) return null;
  const arquivos = fs
    .readdirSync(pasta)
    .filter((f) => f.endsWith(".html") && f.startsWith("due_diligence_"))
    .sort()
    .reverse(); // mais recente primeiro
  if (!arquivos.length) return null;
  return path.join(pasta, arquivos[0]);
}

function carregarAcesso(pasta: string): { senhaHash: string; numeroCNJ: string } | null {
  const acessoPath = path.join(pasta, "acesso.json");
  if (!fs.existsSync(acessoPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(acessoPath, "utf-8"));
  } catch {
    return null;
  }
}

// ── Login Page HTML ────────────────────────────────────────────────────────

function gerarPaginaLogin(processoId: string, numeroCNJ: string, erro = false): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuraDUE — Acesso Restrito</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: 'Segoe UI', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 16px;
      padding: 48px 40px;
      width: 100%;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .logo {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -1px;
      margin-bottom: 4px;
    }
    .logo-sub {
      font-size: 12px;
      color: #484f58;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 32px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      color: #ef4444;
      padding: 6px 14px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 28px;
    }
    .processo-box {
      background: rgba(6,182,212,0.04);
      border: 1px solid rgba(6,182,212,0.15);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 32px;
    }
    .processo-label {
      font-size: 10px;
      color: #484f58;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .processo-num {
      font-size: 15px;
      color: #06b6d4;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .error-box {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      color: #ef4444;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 20px;
    }
    label {
      display: block;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 13px 16px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      color: #e6edf3;
      font-size: 16px;
      letter-spacing: 3px;
      margin-bottom: 20px;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="password"]:focus { border-color: #06b6d4; }
    input[type="password"]::placeholder { letter-spacing: 2px; color: #30363d; }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      letter-spacing: 0.5px;
    }
    button:hover { opacity: 0.92; }
    button:active { transform: scale(0.99); }
    .footer {
      margin-top: 32px;
      font-size: 11px;
      color: #30363d;
      line-height: 1.6;
    }
    .divider {
      border: none;
      border-top: 1px solid #21262d;
      margin: 28px 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AuraDUE</div>
    <div class="logo-sub">Motor de Due Diligence Criminal</div>

    <div class="badge">⚠ Segredo de Justiça</div>

    <div class="processo-box">
      <div class="processo-label">Processo</div>
      <div class="processo-num">${numeroCNJ}</div>
    </div>

    ${erro ? '<div class="error-box">Senha incorreta. Verifique as credenciais e tente novamente.</div>' : ""}

    <form method="POST" action="/due-diligence/${processoId}/auth">
      <label>Senha de Acesso</label>
      <input type="password" name="senha" placeholder="••••••••••••" autofocus required>
      <button type="submit">Acessar Relatório →</button>
    </form>

    <hr class="divider">
    <div class="footer">
      AuraTECH · Acesso monitorado e registrado.<br>
      Uso exclusivo da equipe de defesa autorizada.<br>
      Qualquer acesso indevido é crime (CP art. 154-A).
    </div>
  </div>
</body>
</html>`;
}

// ── Rotas ──────────────────────────────────────────────────────────────────

// GET /due-diligence/:id — página de login
router.get("/due-diligence/:id", (req: Request, res: Response) => {
  const id = String(req.params["id"] ?? "");

  // Sanitizar ID — só alfanumérico, hífens e underscores
  if (!/^[\w\-]+$/.test(id)) return res.status(400).send("ID inválido.");

  const pasta = path.join(REPORTS_BASE, id);
  const acesso = carregarAcesso(pasta);
  if (!acesso) {
    return res.status(404).send("Relatório não encontrado ou acesso não configurado.");
  }

  // Verificar token existente na query
  const rawToken = req.query["t"];
  const token = rawToken ? String(rawToken) : undefined;
  if (token) {
    try {
      const decoded = jwt.verify(token, SESSION_SECRET) as any;
      if (decoded.processoId === id) {
        return res.redirect(`/due-diligence/${id}/relatorio?t=${token}`);
      }
    } catch {}
  }

  res.send(gerarPaginaLogin(id, acesso.numeroCNJ));
});

// POST /due-diligence/:id/auth — validar senha
router.post("/due-diligence/:id/auth", async (req: Request, res: Response) => {
  const id = String(req.params["id"] ?? "");
  const { senha } = req.body as { senha: string };

  if (!/^[\w\-]+$/.test(id)) return res.status(400).send("ID inválido.");

  const pasta = path.join(REPORTS_BASE, id);
  const acesso = carregarAcesso(pasta);
  if (!acesso) return res.status(404).send("Relatório não encontrado.");

  const senhaValida = senha ? await bcrypt.compare(senha, acesso.senhaHash) : false;

  if (!senhaValida) {
    return res.status(401).send(gerarPaginaLogin(id, acesso.numeroCNJ, true));
  }

  // Gerar token JWT válido por 8 horas
  const token = jwt.sign(
    { processoId: id, role: "viewer" },
    SESSION_SECRET,
    { expiresIn: "8h" }
  );

  // Registrar acesso no log
  const logEntry = `[${new Date().toISOString()}] ACESSO: processo=${id} ip=${req.ip}\n`;
  fs.appendFileSync(path.join(pasta, "acessos.log"), logEntry, "utf-8");

  res.redirect(`/due-diligence/${id}/relatorio?t=${token}`);
});

// GET /due-diligence/:id/relatorio — servir HTML do relatório
router.get("/due-diligence/:id/relatorio", (req: Request, res: Response) => {
  const id = String(req.params["id"] ?? "");
  const rawToken = req.query["t"];
  const token = rawToken ? String(rawToken) : undefined;

  if (!/^[\w\-]+$/.test(id)) return res.status(400).send("ID inválido.");

  if (!token) return res.redirect(`/due-diligence/${id}`);

  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    if (decoded.processoId !== id) throw new Error("Token inválido para este processo");
  } catch {
    return res.redirect(`/due-diligence/${id}`);
  }

  const pasta = path.join(REPORTS_BASE, id);
  const htmlPath = encontrarRelatorioHTML(pasta);

  if (!htmlPath) {
    return res.status(404).send("Relatório HTML não encontrado. Execute o motor de due diligence primeiro.");
  }

  res.sendFile(htmlPath);
});

export default router;
