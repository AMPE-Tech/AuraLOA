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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'Inter',system-ui,sans-serif;
      background:#0d0f14;
      color:#f1f5f9;
      min-height:100vh;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:32px 16px 64px;
      -webkit-font-smoothing:antialiased;
    }
    /* Ícone + título fora do card */
    .brand{display:flex;flex-direction:column;align-items:center;margin-bottom:28px;}
    .brand-icon{
      width:72px;height:72px;border-radius:18px;
      background:linear-gradient(135deg,#1d6fe8,#2563eb);
      display:flex;align-items:center;justify-content:center;
      margin-bottom:16px;
      box-shadow:0 8px 24px rgba(37,99,235,0.35);
    }
    .brand-icon svg{width:34px;height:34px;}
    .brand-name{font-size:26px;font-weight:700;color:#fff;letter-spacing:-.02em;margin-bottom:4px;}
    .brand-sub{font-size:13px;color:#64748b;font-weight:400;letter-spacing:0.03em;}
    /* Card */
    .card{
      background:#161b22;
      border:1px solid rgba(255,255,255,0.08);
      border-radius:14px;
      padding:36px 32px 28px;
      width:100%;
      max-width:480px;
    }
    .card-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:28px;}
    /* Processo */
    .processo-row{
      display:flex;align-items:center;gap:8px;
      background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);
      border-radius:8px;padding:9px 13px;margin-bottom:24px;
    }
    .processo-row svg{width:14px;height:14px;flex-shrink:0;color:#3b82f6;}
    .processo-num{font-size:12px;color:#93c5fd;font-family:Menlo,'Courier New',monospace;letter-spacing:.02em;}
    /* Erro */
    .error-box{
      background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
      color:#f87171;padding:11px 14px;border-radius:8px;font-size:13px;margin-bottom:20px;
    }
    /* Form */
    .field{margin-bottom:20px;}
    label{display:block;font-size:14px;font-weight:500;color:#f1f5f9;margin-bottom:8px;}
    .input-wrap{position:relative;}
    input[type="password"],input[type="text"]{
      width:100%;padding:13px 44px 13px 14px;
      background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:8px;
      color:#f1f5f9;font-size:14px;font-family:'Inter',system-ui,sans-serif;
      outline:none;transition:border-color .15s;
    }
    input[type="password"]:focus,input[type="text"]:focus{border-color:#3b82f6;}
    input::placeholder{color:#475569;}
    .eye-btn{
      position:absolute;right:14px;top:50%;transform:translateY(-50%);
      background:none;border:none;cursor:pointer;padding:0;
      color:#475569;transition:color .15s;width:auto;
    }
    .eye-btn:hover{color:#94a3b8;}
    button[type="submit"]{
      width:100%;padding:14px;
      background:#2563eb;border:none;border-radius:8px;
      color:white;font-size:15px;font-weight:600;cursor:pointer;
      transition:background .15s,transform .1s;
      font-family:'Inter',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;gap:8px;
      margin-top:4px;
    }
    button[type="submit"]:hover:not(:disabled){background:#1d4ed8;}
    button[type="submit"]:active:not(:disabled){transform:scale(0.99);}
    button[type="submit"]:disabled{opacity:0.4;cursor:not-allowed;}
    /* Aceite */
    .aceite{
      margin-top:18px;padding-top:16px;
      border-top:1px solid rgba(255,255,255,0.06);
      display:flex;align-items:flex-start;gap:10px;
    }
    .aceite input[type="checkbox"]{
      width:16px;height:16px;margin-top:2px;flex-shrink:0;
      accent-color:#2563eb;cursor:pointer;
    }
    .aceite-text{
      font-size:11px;color:#64748b;line-height:1.6;
    }
    .aceite-text a{color:#3b82f6;text-decoration:none;}
    .aceite-text a:hover{text-decoration:underline;}
  </style>
</head>
<body>

  <!-- Marca acima do card -->
  <div class="brand">
    <div class="brand-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </div>
    <div class="brand-name">AuraDUE</div>
    <div class="brand-sub">Plataforma de Due Diligence</div>
  </div>

  <!-- Card de login -->
  <div class="card">
    <div class="card-title">Acessar Relatório</div>

    <!-- Número do processo -->
    <div class="processo-row">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
      <span class="processo-num">${numeroCNJ}</span>
    </div>

    ${erro ? '<div class="error-box">Senha incorreta. Verifique as credenciais e tente novamente.</div>' : ""}

    <form method="POST" action="/due-diligence/${processoId}/auth">
      <div class="field">
        <label for="senha">Senha</label>
        <div class="input-wrap">
          <input type="password" id="senha" name="senha" placeholder="Digite sua senha" autofocus required>
          <button type="button" class="eye-btn" onclick="toggleSenha()" title="Mostrar/ocultar senha">
            <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <button type="submit" id="btnEntrar" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Entrar
      </button>

      <div class="aceite">
        <input type="checkbox" id="aceite" onchange="document.getElementById('btnEntrar').disabled=!this.checked">
        <label class="aceite-text" for="aceite">
          Li e concordo com a <a href="/politica-confidencialidade" target="_blank">Pol&iacute;tica de Confidencialidade e Uso</a>
          &mdash; LGPD (Lei 13.709/2018) e art. 154-A do C&oacute;digo Penal
        </label>
      </div>
    </form>
  </div>

  <!-- footer removido -->

  <script>
    function toggleSenha() {
      const inp = document.getElementById('senha');
      const icon = document.getElementById('eye-icon');
      if (inp.type === 'password') {
        inp.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
      } else {
        inp.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    }
  </script>
</body>
</html>`;
}

// ── Política de Confidencialidade ─────────────────────────────────────────

router.get("/politica-confidencialidade", (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pol&iacute;tica de Confidencialidade e Uso &mdash; AuraDUE</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;background:#0d0f14;color:#e2e8f0;min-height:100vh;padding:40px 20px 60px;-webkit-font-smoothing:antialiased}
    .container{max-width:720px;margin:0 auto}
    .brand{display:flex;align-items:center;gap:10px;margin-bottom:32px}
    .brand-icon{width:28px;height:28px;border-radius:7px;background:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .brand-name{font-size:14px;font-weight:700;color:#f1f5f9}
    h1{font-size:22px;font-weight:700;color:#fff;margin-bottom:8px;letter-spacing:-0.02em}
    .subtitle{font-size:13px;color:#64748b;margin-bottom:32px}
    h2{font-size:15px;font-weight:700;color:#93c5fd;margin:28px 0 12px;display:flex;align-items:center;gap:8px}
    h2::before{content:'';width:3px;height:16px;border-radius:2px;background:#2563eb;display:block}
    p,li{font-size:13px;color:#94a3b8;line-height:1.8;margin-bottom:10px}
    ul{padding-left:20px;margin-bottom:14px}
    li{margin-bottom:6px}
    strong{color:#e2e8f0}
    .highlight{background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:8px;padding:16px 20px;margin:20px 0}
    .highlight p{color:#93c5fd;margin-bottom:0}
    .legal-ref{font-family:Menlo,monospace;font-size:11px;color:#64748b;background:rgba(255,255,255,0.04);padding:2px 6px;border-radius:4px}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#475569;text-align:center;line-height:1.8}
    .back{display:inline-flex;align-items:center;gap:6px;margin-top:24px;padding:8px 16px;background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);border-radius:8px;color:#3b82f6;font-size:12px;font-weight:600;text-decoration:none;transition:background .15s}
    .back:hover{background:rgba(37,99,235,0.18)}
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-icon"><svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M8 1.5L2 4v5c0 3.3 2.6 6.2 6 6.5 3.4-.3 6-3.2 6-6.5V4L8 1.5z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" stroke-width="1"/><path d="M5.5 8l1.8 1.8L11 6" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <span class="brand-name">AuraDUE</span>
    </div>

    <h1>Pol&iacute;tica de Confidencialidade e Uso</h1>
    <p class="subtitle">&Uacute;ltima atualiza&ccedil;&atilde;o: 02 de abril de 2026</p>

    <h2>1. Objeto</h2>
    <p>Esta pol&iacute;tica regulamenta o acesso, uso e tratamento de dados disponibilizados pela plataforma <strong>AuraDUE</strong>, m&oacute;dulo de Due Diligence Criminal do ecossistema AuraTECH, destinado exclusivamente &agrave; equipe de defesa formalmente constitu&iacute;da nos autos do processo judicial correspondente.</p>

    <h2>2. Sigilo Judicial</h2>
    <p>Os relat&oacute;rios e documentos acess&iacute;veis por meio desta plataforma est&atilde;o protegidos por <strong>sigilo judicial</strong>, nos termos do <span class="legal-ref">art. 5&ordm;, LX, da Constitui&ccedil;&atilde;o Federal</span> e do <span class="legal-ref">art. 201, &sect;6&ordm;, do C&oacute;digo de Processo Penal</span>.</p>
    <div class="highlight">
      <p><strong>A divulga&ccedil;&atilde;o, compartilhamento ou reprodu&ccedil;&atilde;o n&atilde;o autorizada do conte&uacute;do configura viola&ccedil;&atilde;o de sigilo judicial e pode caracterizar crime nos termos do art. 154-A do C&oacute;digo Penal.</strong></p>
    </div>

    <h2>3. Prote&ccedil;&atilde;o de Dados &mdash; LGPD</h2>
    <p>O tratamento de dados pessoais realizado pela plataforma AuraDUE observa a <strong>Lei Geral de Prote&ccedil;&atilde;o de Dados</strong> <span class="legal-ref">Lei 13.709/2018</span>, em especial:</p>
    <ul>
      <li><strong>Art. 7&ordm;, II e VI</strong> &mdash; Tratamento necess&aacute;rio para o exerc&iacute;cio regular de direitos em processo judicial e para o cumprimento de obriga&ccedil;&atilde;o legal</li>
      <li><strong>Art. 11, II, &ldquo;d&rdquo;</strong> &mdash; Tratamento de dados sens&iacute;veis para o exerc&iacute;cio regular de direitos, inclusive em contrato e em processo judicial</li>
      <li><strong>Art. 46</strong> &mdash; Medidas de seguran&ccedil;a t&eacute;cnicas e administrativas para prote&ccedil;&atilde;o dos dados pessoais</li>
    </ul>

    <h2>4. Medidas de Seguran&ccedil;a</h2>
    <p>A plataforma implementa as seguintes medidas t&eacute;cnicas:</p>
    <ul>
      <li>Autentica&ccedil;&atilde;o por senha com hash <strong>bcrypt</strong> (12 rounds)</li>
      <li>Sess&atilde;o protegida por <strong>JWT</strong> com expira&ccedil;&atilde;o de 8 horas</li>
      <li>Comunica&ccedil;&atilde;o exclusivamente via <strong>HTTPS/TLS</strong></li>
      <li>Registro de todos os acessos com <strong>timestamp e IP</strong> (log de auditoria)</li>
      <li>Cadeia de cust&oacute;dia digital com <strong>SHA-256</strong> em todos os documentos</li>
      <li>Infraestrutura hospedada em servidor dedicado com acesso restrito</li>
    </ul>

    <h2>5. Responsabilidades do Usu&aacute;rio</h2>
    <p>Ao acessar a plataforma, o usu&aacute;rio declara e se compromete a:</p>
    <ul>
      <li>Ser membro da <strong>equipe de defesa formalmente constitu&iacute;da</strong> no processo</li>
      <li><strong>N&atilde;o compartilhar</strong> credenciais de acesso com terceiros</li>
      <li><strong>N&atilde;o reproduzir, copiar ou distribuir</strong> o conte&uacute;do sem autoriza&ccedil;&atilde;o expressa</li>
      <li>Utilizar as informa&ccedil;&otilde;es <strong>exclusivamente para fins de defesa processual</strong></li>
      <li>Comunicar imediatamente qualquer suspeita de acesso n&atilde;o autorizado</li>
    </ul>

    <h2>6. Cadeia de Cust&oacute;dia Digital</h2>
    <p>Todos os documentos processados pela plataforma AuraDUE possuem registro de integridade via <strong>SHA-256</strong>, em conformidade com a <span class="legal-ref">Lei 13.964/2019</span> (Pacote Anticrime &mdash; arts. 158-A a 158-F do CPP), garantindo rastreabilidade e n&atilde;o-repudia&ccedil;&atilde;o das evid&ecirc;ncias digitais.</p>

    <h2>7. Limita&ccedil;&atilde;o de Responsabilidade</h2>
    <p>Os relat&oacute;rios gerados pela plataforma AuraDUE t&ecirc;m car&aacute;ter <strong>informativo e preliminar</strong>, n&atilde;o substituindo a an&aacute;lise jur&iacute;dica qualificada do advogado respons&aacute;vel. Toda conclus&atilde;o apresentada deve ser <strong>conferida por profissional habilitado</strong> antes de qualquer uso em pe&ccedil;as processuais.</p>

    <h2>8. Disposi&ccedil;&otilde;es Penais</h2>
    <div class="highlight">
      <p>O acesso indevido a este sistema constitui crime tipificado no <span class="legal-ref">art. 154-A do C&oacute;digo Penal</span> (Invas&atilde;o de dispositivo inform&aacute;tico), com pena de reclus&atilde;o de 1 a 4 anos e multa, aumentada de 1/3 a 2/3 se resultar em obten&ccedil;&atilde;o de conte&uacute;do sob sigilo judicial.</p>
    </div>

    <h2>9. Contato</h2>
    <p>Para quest&otilde;es sobre privacidade, prote&ccedil;&atilde;o de dados ou esta pol&iacute;tica:</p>
    <ul>
      <li><strong>DPO / Privacidade:</strong> privacidade@auradue.com</li>
      <li><strong>Suporte t&eacute;cnico:</strong> suporte@auradue.com</li>
    </ul>

    <div class="footer">
      &copy; 2026 AuraTECH &mdash; Todos os direitos reservados<br>
      Cadeia de Cust&oacute;dia Digital &mdash; Lei 13.964/2019
    </div>

    <a class="back" href="javascript:history.back()">
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Voltar
    </a>
  </div>
</body>
</html>`);
});

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

// ── Dashboard v3 protegido (mesma auth premium) ─────────────────────────────
// ⚠️ BLINDADO (14/04/2026) — NÃO alterar sem 3 confirmações de Marcos

const DASHBOARD_V3_PASSWORD = process.env.AURALOA_PASS || "AuraLOA-2026$";

function gerarPaginaLoginDashboard(erro = false, action = "/dashboard-loa-v3/auth", showEmail = false): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuraLOA &mdash; Acesso Restrito</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family:'Inter',system-ui,sans-serif;
      background:#0d0f14;
      color:#f1f5f9;
      min-height:100vh;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:32px 16px 64px;
      -webkit-font-smoothing:antialiased;
    }
    .brand{display:flex;flex-direction:column;align-items:center;margin-bottom:28px;}
    .brand-icon{
      width:72px;height:72px;border-radius:18px;
      background:linear-gradient(135deg,#1d6fe8,#6366f1);
      display:flex;align-items:center;justify-content:center;
      margin-bottom:16px;
      box-shadow:0 8px 24px rgba(37,99,235,0.35);
    }
    .brand-icon svg{width:34px;height:34px;}
    .brand-name{font-size:26px;font-weight:700;color:#fff;letter-spacing:-.02em;margin-bottom:4px;}
    .brand-sub{font-size:13px;color:#64748b;font-weight:400;letter-spacing:0.03em;}
    .card{
      background:#161b22;
      border:1px solid rgba(255,255,255,0.08);
      border-radius:14px;
      padding:36px 32px 28px;
      width:100%;
      max-width:480px;
    }
    .card-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:28px;}
    .processo-row{
      display:flex;align-items:center;gap:8px;
      background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);
      border-radius:8px;padding:9px 13px;margin-bottom:24px;
    }
    .processo-row svg{width:14px;height:14px;flex-shrink:0;color:#22d3ee;}
    .processo-num{font-size:12px;color:#22d3ee;font-family:Menlo,'Courier New',monospace;letter-spacing:.02em;}
    .error-box{
      background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
      color:#f87171;padding:11px 14px;border-radius:8px;font-size:13px;margin-bottom:20px;
    }
    .field{margin-bottom:20px;}
    label{display:block;font-size:14px;font-weight:500;color:#f1f5f9;margin-bottom:8px;}
    .input-wrap{position:relative;}
    input[type="password"],input[type="text"],input[type="email"]{
      width:100%;padding:13px 44px 13px 14px;
      background:#0d1117;border:1px solid rgba(255,255,255,0.12);border-radius:8px;
      color:#f1f5f9;font-size:14px;font-family:'Inter',system-ui,sans-serif;
      outline:none;transition:border-color .15s;
      -webkit-appearance:none;appearance:none;
    }
    input[type="password"]:focus,input[type="text"]:focus,input[type="email"]:focus{border-color:#22d3ee;}
    input::placeholder{color:#475569;}
    /* Remove autofill amarelo/branco do Chrome */
    input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{
      -webkit-text-fill-color:#f1f5f9;
      -webkit-box-shadow:0 0 0 1000px #0d1117 inset;
      transition:background-color 5000s ease-in-out 0s;
      caret-color:#f1f5f9;
    }
    .eye-btn{
      position:absolute;right:14px;top:50%;transform:translateY(-50%);
      background:none;border:none;cursor:pointer;padding:0;
      color:#475569;transition:color .15s;width:auto;
    }
    .eye-btn:hover{color:#94a3b8;}
    button[type="submit"]{
      width:100%;padding:14px;
      background:linear-gradient(135deg,#22d3ee,#6366f1);border:none;border-radius:8px;
      color:white;font-size:15px;font-weight:600;cursor:pointer;
      transition:background .15s,transform .1s;
      font-family:'Inter',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;gap:8px;
      margin-top:4px;
    }
    button[type="submit"]:hover:not(:disabled){filter:brightness(1.1);}
    button[type="submit"]:active:not(:disabled){transform:scale(0.99);}
    button[type="submit"]:disabled{opacity:0.4;cursor:not-allowed;}
    .aceite{
      margin-top:18px;padding-top:16px;
      border-top:1px solid rgba(255,255,255,0.06);
      display:flex;align-items:flex-start;gap:10px;
    }
    .aceite input[type="checkbox"]{
      width:16px;height:16px;margin-top:2px;flex-shrink:0;
      accent-color:#22d3ee;cursor:pointer;
    }
    .aceite-text{font-size:11px;color:#64748b;line-height:1.6;}
    .aceite-text a{color:#22d3ee;text-decoration:none;}
    .aceite-text a:hover{text-decoration:underline;}
  </style>
</head>
<body>
  <div class="brand">
    <div class="brand-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    </div>
    <div class="brand-name">AuraLOA</div>
    <div class="brand-sub">An&aacute;lise Inteligente de Precat&oacute;rios</div>
  </div>

  <div class="card">
    <div class="card-title">Acessar Dashboard</div>

    <div class="processo-row">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span class="processo-num">Dashboard Precat&oacute;rios LOA 2026 &mdash; Confidencial</span>
    </div>

    ${erro ? '<div class="error-box">Senha incorreta. Verifique as credenciais e tente novamente.</div>' : ""}

    <form method="POST" action="${action}">
      ${showEmail ? `<div class="field">
        <label for="email">Email</label>
        <div class="input-wrap">
          <input type="email" id="email" name="email" placeholder="seu@email.com" autocomplete="email" required>
        </div>
      </div>` : ""}
      <div class="field">
        <label for="senha">Senha de Acesso</label>
        <div class="input-wrap">
          <input type="password" id="senha" name="senha" placeholder="Digite sua senha" ${showEmail ? "" : "autofocus"} required>
          <button type="button" class="eye-btn" onclick="toggleSenha()" title="Mostrar/ocultar senha">
            <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <button type="submit" id="btnEntrar" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Entrar
      </button>

      <div class="aceite">
        <input type="checkbox" id="aceite" onchange="document.getElementById('btnEntrar').disabled=!this.checked">
        <label class="aceite-text" for="aceite">
          Li e concordo com os termos de uso. Acesso monitorado e registrado.
          &mdash; LGPD (Lei 13.709/2018)
        </label>
      </div>
    </form>
  </div>

  <script>
    function toggleSenha() {
      const inp = document.getElementById('senha');
      const icon = document.getElementById('eye-icon');
      if (inp.type === 'password') {
        inp.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
      } else {
        inp.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    }
  </script>
</body>
</html>`;
}

// GET /dashboard-loa-v3.html — tela de login
router.get("/dashboard-loa-v3.html", (req: Request, res: Response) => {
  const rawToken = req.query["t"];
  const token = rawToken ? String(rawToken) : undefined;
  if (token) {
    try {
      const decoded = jwt.verify(token, SESSION_SECRET) as any;
      if (decoded.dashboardAccess === true) {
        const filePath = path.resolve("dist/public/dashboard-loa-v3.html");
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
        const altPath = path.resolve("client/public/dashboard-loa-v3.html");
        if (fs.existsSync(altPath)) return res.sendFile(altPath);
        return res.status(404).send("Dashboard não encontrado no servidor.");
      }
    } catch {}
  }
  res.send(gerarPaginaLoginDashboard());
});

// POST /dashboard-loa-v3/auth — validar senha
router.post("/dashboard-loa-v3/auth", (req: Request, res: Response) => {
  const { senha } = req.body as { senha: string };

  if (!senha || senha !== DASHBOARD_V3_PASSWORD) {
    return res.send(gerarPaginaLoginDashboard(true));
  }

  const token = jwt.sign(
    { dashboardAccess: true, role: "admin", email: "marcos@auradue.com" },
    SESSION_SECRET,
    { expiresIn: "8h" }
  );

  const logEntry = `[${new Date().toISOString()}] DASHBOARD_ACCESS ip=${req.ip}\n`;
  try { fs.appendFileSync(path.resolve("Saida/dashboard_acessos.log"), logEntry, "utf-8"); } catch {}

  res.redirect(`/dashboard-loa-v3.html?t=${token}`);
});

// ── Proteção de rotas sensíveis com mesmo token JWT ──────────────────

function verificarTokenDashboard(req: Request): boolean {
  const rawToken = req.query["t"];
  const token = rawToken ? String(rawToken) : undefined;
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    return decoded.dashboardAccess === true;
  } catch {
    return false;
  }
}

// GET /dd-audit.html — protegido
router.get("/dd-audit.html", (req: Request, res: Response) => {
  if (!verificarTokenDashboard(req)) {
    return res.send(gerarPaginaLoginDashboard());
  }
  const filePath = path.resolve(__dirname, "public", "dd-audit.html");
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  const altPath = path.resolve("client/public/dd-audit.html");
  if (fs.existsSync(altPath)) return res.sendFile(altPath);
  return res.status(404).send("Página não encontrada.");
});

// GET /dd-reports/* — protegido
router.get("/dd-reports/:file", (req: Request, res: Response) => {
  if (!verificarTokenDashboard(req)) {
    return res.send(gerarPaginaLoginDashboard());
  }
  const filename = path.basename(req.params.file);
  const filePath = path.resolve(__dirname, "public", "dd-reports", filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).send("Relatório não encontrado.");
});

// GET /dd-audit/*.json — protegido (API também)
router.get("/dd-audit/:file", (req: Request, res: Response) => {
  if (!verificarTokenDashboard(req)) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  const filename = path.basename(req.params.file);
  const filePath = path.resolve(__dirname, "public", "dd-audit", filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return res.status(404).json({ error: "Arquivo não encontrado" });
});

// GET /admin/kyc-pendentes.html — dashboard admin de aprovação KYC (protegido)
router.get("/admin/kyc-pendentes.html", (req: Request, res: Response) => {
  if (!verificarTokenDashboard(req)) {
    return res.send(gerarPaginaLoginDashboard());
  }
  const filePath = path.resolve(__dirname, "public", "admin", "kyc-pendentes.html");
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  const altPath = path.resolve("client/public/admin/kyc-pendentes.html");
  if (fs.existsSync(altPath)) return res.sendFile(altPath);
  return res.status(404).send("Página não encontrada");
});

// ── PORTAL CLIENTE — Acesso restrito por cliente ──────────────────────
// Cliente identifica-se pela senha única (registrada em .env CLIENT_<NOME>_PASS)
// Token JWT inclui { cliente: "ricardo" } — dá acesso apenas aos relatórios da pasta do cliente

// Estrutura: slug → { email, senha }
// Para o dashboard-cliente, exige email+senha. Para portal-cliente, aceita só senha (retrocompat).
const CLIENTES: Record<string, { email: string; senha: string }> = {
  ricardo: {
    email: process.env.CLIENT_RICARDO_EMAIL || "cagiva.industria@gmail.com",
    senha: process.env.CLIENT_RICARDO_PASS || "Ricardo-AuraLOA-2026",
  },
  // Adicionar novos clientes aqui: slug: { email, senha }
};

const RELATORIOS_CLIENTE_DIR = path.resolve("dist/public/relatorios-cliente");

function gerarPaginaLoginCliente(erro = false): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuraLOA · Portal Cliente</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#0d1117;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px}
.brand{display:flex;flex-direction:column;align-items:center;margin-bottom:28px}
.brand-icon{width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#22d3ee,#a78bfa);display:flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 8px 24px rgba(34,211,238,.3)}
.brand-name{font-size:26px;font-weight:800;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.02em}
.brand-sub{font-size:13px;color:#64748b;margin-top:4px}
.card{background:#162032;border:1px solid #1e3a5f;border-radius:14px;padding:36px 32px;width:100%;max-width:440px}
.card-title{font-size:18px;font-weight:700;color:#fff;text-align:center;margin-bottom:24px}
.subtitle{font-size:13px;color:#94a3b8;text-align:center;margin-bottom:24px}
.error-box{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);color:#f87171;padding:11px 14px;border-radius:8px;font-size:13px;margin-bottom:20px}
.field{margin-bottom:20px}
label{display:block;font-size:13px;font-weight:500;color:#e2e8f0;margin-bottom:8px}
input{width:100%;padding:13px 14px;background:#0d1117;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:14px;font-family:'Inter',monospace}
input:focus{outline:none;border-color:#22d3ee}
button{width:100%;padding:13px;background:linear-gradient(135deg,#22d3ee,#a78bfa);color:#0d1117;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.02em}
button:hover{opacity:.9}
.footer{font-size:11px;color:#64748b;text-align:center;margin-top:24px}
</style></head><body>
<div class="brand"><div class="brand-icon"><svg viewBox="0 0 24 24" fill="none" width="36" height="36"><path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" stroke="#0d1117" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="#0d1117" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="brand-name">AuraLOA</div><div class="brand-sub">Portal do Cliente</div></div>
<div class="card">
  <div class="card-title">Acesso ao Portal</div>
  <div class="subtitle">Insira sua senha exclusiva para acessar os relatórios</div>
  ${erro ? '<div class="error-box">Senha incorreta. Tente novamente.</div>' : ""}
  <form method="POST" action="/portal-cliente/auth">
    <div class="field"><label for="senha">Senha</label><input type="password" name="senha" id="senha" required autocomplete="off" placeholder="Digite sua senha"></div>
    <button type="submit">Entrar</button>
  </form>
  <div class="footer">© 2026 AuraTECH · suporte@auradue.com</div>
</div>
</body></html>`;
}

function gerarPortalCliente(cliente: string, relatorios: { nome: string; arquivo: string; tamanho: string; data: string }[]): string {
  const nomeExibicao = cliente.charAt(0).toUpperCase() + cliente.slice(1);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuraLOA · Portal ${nomeExibicao}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#0d1117;color:#e2e8f0;min-height:100vh;-webkit-font-smoothing:antialiased}
.topbar{position:sticky;top:0;z-index:100;background:rgba(17,24,39,.95);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.06);padding:16px 28px;display:flex;align-items:center;gap:1.5rem}
.logo{font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.user-badge{margin-left:auto;font-size:.85rem;color:#94a3b8;display:flex;align-items:center;gap:.5rem}
.user-name{color:#22d3ee;font-weight:600}
.logout{font-size:.75rem;color:#64748b;text-decoration:none;padding:.4rem .8rem;border:1px solid #1e3a5f;border-radius:6px}
.logout:hover{color:#f87171;border-color:rgba(248,113,113,.3)}
.main{max-width:1100px;margin:0 auto;padding:2.5rem 2rem}
.hero{margin-bottom:2.5rem}
.hero h1{font-size:2rem;font-weight:800;margin-bottom:.5rem;color:#fff}
.hero p{font-size:1rem;color:#94a3b8}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:2rem}
.stat{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:1.2rem;position:relative;overflow:hidden}
.stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#22d3ee,transparent)}
.stat-label{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#64748b}
.stat-value{font-size:1.8rem;font-weight:800;margin-top:.3rem;color:#22d3ee;letter-spacing:-1px}
.stat-sub{font-size:.72rem;color:#94a3b8;margin-top:.2rem}
.section-title{font-size:1.1rem;font-weight:700;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem;color:#fff}
.dot{width:8px;height:8px;border-radius:50%;background:#22d3ee}
.reports{display:grid;gap:1rem}
.report-card{background:#162032;border:1px solid #1e3a5f;border-radius:12px;padding:1.5rem;transition:all .2s;cursor:pointer;text-decoration:none;color:inherit;display:flex;align-items:center;gap:1rem}
.report-card:hover{border-color:#22d3ee;box-shadow:0 0 24px rgba(34,211,238,.1);transform:translateY(-2px)}
.report-icon{width:48px;height:48px;border-radius:10px;background:rgba(34,211,238,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.report-info{flex:1;min-width:0}
.report-title{font-size:1rem;font-weight:600;color:#fff;margin-bottom:.2rem}
.report-meta{font-size:.75rem;color:#94a3b8;display:flex;gap:1rem}
.report-arrow{color:#64748b;font-size:1.2rem}
.empty{text-align:center;padding:3rem 2rem;background:#162032;border:1px dashed #1e3a5f;border-radius:12px;color:#94a3b8}
.empty-icon{font-size:3rem;margin-bottom:1rem;opacity:.4}
.footer{border-top:1px solid rgba(255,255,255,.06);padding:1.5rem 2rem;text-align:center;font-size:.75rem;color:#64748b;margin-top:3rem}
</style></head><body>
<header class="topbar">
  <div class="logo">AuraLOA</div>
  <div class="user-badge">Portal · <span class="user-name">${nomeExibicao}</span></div>
  <a href="/portal-cliente" class="logout">Sair</a>
</header>
<main class="main">
  <div class="hero">
    <h1>Olá, ${nomeExibicao}</h1>
    <p>Seus relatórios de Due Diligence estão listados abaixo.</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Relatórios</div><div class="stat-value">${relatorios.length}</div><div class="stat-sub">disponíveis para você</div></div>
    <div class="stat"><div class="stat-label">Última atualização</div><div class="stat-value" style="font-size:1rem">${relatorios[0]?.data || "—"}</div><div class="stat-sub">relatório mais recente</div></div>
    <div class="stat"><div class="stat-label">Acesso</div><div class="stat-value" style="font-size:1rem;color:#34d399">Ativo</div><div class="stat-sub">sessão válida 8h</div></div>
  </div>
  <div class="section-title"><span class="dot"></span> Relatórios Disponíveis</div>
  ${relatorios.length === 0 ? `<div class="empty"><div class="empty-icon">📋</div><div>Nenhum relatório disponível no momento.</div><div style="font-size:.8rem;margin-top:.5rem">Entre em contato com a equipe AuraTECH.</div></div>` : `<div class="reports">${relatorios.map(r => `<a href="/portal-cliente/relatorio/${encodeURIComponent(r.arquivo)}?t=__TOKEN__" class="report-card"><div class="report-icon"><svg viewBox="0 0 24 24" fill="none" width="24" height="24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#22d3ee" stroke-width="1.8"/><path d="M14 2v6h6M8 13h8M8 17h8" stroke="#22d3ee" stroke-width="1.8"/></svg></div><div class="report-info"><div class="report-title">${r.nome}</div><div class="report-meta"><span>${r.data}</span><span>${r.tamanho}</span></div></div><div class="report-arrow">→</div></a>`).join("")}</div>`}
</main>
<footer class="footer">© 2026 AuraTECH · Portal exclusivo para ${nomeExibicao} · suporte@auradue.com</footer>
</body></html>`;
}

function verificarTokenCliente(req: Request): { valid: boolean; cliente?: string } {
  const rawToken = req.query["t"];
  const token = rawToken ? String(rawToken) : undefined;
  if (!token) return { valid: false };
  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as any;
    if (decoded.clienteAccess === true && decoded.cliente) {
      return { valid: true, cliente: decoded.cliente };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

// GET /portal-cliente — tela de login do cliente
router.get("/portal-cliente", (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente) {
    return res.send(gerarPaginaLoginCliente());
  }
  // Listar relatórios da pasta do cliente
  const pastaCliente = path.join(RELATORIOS_CLIENTE_DIR, check.cliente);
  let relatorios: { nome: string; arquivo: string; tamanho: string; data: string }[] = [];
  try {
    if (fs.existsSync(pastaCliente)) {
      const files = fs.readdirSync(pastaCliente).filter((f) => f.endsWith(".html"));
      relatorios = files
        .map((f) => {
          const st = fs.statSync(path.join(pastaCliente, f));
          return {
            nome: f.replace(/\.html$/, "").replace(/_/g, " "),
            arquivo: f,
            tamanho: `${(st.size / 1024).toFixed(0)} KB`,
            data: st.mtime.toLocaleDateString("pt-BR"),
          };
        })
        .sort((a, b) => b.data.localeCompare(a.data));
    }
  } catch {}
  const html = gerarPortalCliente(check.cliente, relatorios).replace(/__TOKEN__/g, String(req.query["t"] || ""));
  res.send(html);
});

// GET /dashboard-cliente — Dashboard v3 restrito (sem Analíticos/DD/Arquivos)
router.get("/dashboard-cliente", (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente) {
    return res.send(gerarPaginaLoginDashboard(false, "/dashboard-cliente/auth", true));
  }
  const htmlPath = path.join(process.cwd(), "client", "public", "dashboard-cliente.html");
  const htmlPathDist = path.join(process.cwd(), "dist", "public", "dashboard-cliente.html");
  const arquivo = fs.existsSync(htmlPathDist) ? htmlPathDist : htmlPath;
  if (!fs.existsSync(arquivo)) {
    return res.status(500).send("Dashboard cliente não encontrado.");
  }
  res.sendFile(arquivo);
});

// POST /dashboard-cliente/auth — validar email + senha e redirecionar com JWT
router.post("/dashboard-cliente/auth", (req: Request, res: Response) => {
  const { email, senha } = req.body as { email?: string; senha?: string };
  if (!email || !senha) return res.send(gerarPaginaLoginDashboard(true, "/dashboard-cliente/auth", true));
  const emailLower = email.trim().toLowerCase();
  const clienteEncontrado = Object.entries(CLIENTES).find(
    ([_, c]) => c.email.toLowerCase() === emailLower && c.senha === senha
  );
  if (!clienteEncontrado) return res.send(gerarPaginaLoginDashboard(true, "/dashboard-cliente/auth", true));
  const [nomeCliente] = clienteEncontrado;
  const token = jwt.sign({ clienteAccess: true, cliente: nomeCliente, cliente_slug: nomeCliente }, SESSION_SECRET, { expiresIn: "8h" });
  try {
    fs.appendFileSync(path.resolve("Saida/dashboard_cliente_acessos.log"),
      `[${new Date().toISOString()}] DASHBOARD_CLIENTE_ACCESS cliente=${nomeCliente} email=${emailLower} ip=${req.ip}\n`, "utf-8");
  } catch {}
  res.redirect(`/dashboard-cliente?t=${token}`);
});

// POST /portal-cliente/auth — validar senha do cliente (só senha, retrocompat)
router.post("/portal-cliente/auth", (req: Request, res: Response) => {
  const { senha } = req.body as { senha: string };
  if (!senha) {
    return res.send(gerarPaginaLoginCliente(true));
  }
  // Identificar cliente pela senha
  const clienteEncontrado = Object.entries(CLIENTES).find(([_, c]) => c.senha === senha);
  if (!clienteEncontrado) {
    return res.send(gerarPaginaLoginCliente(true));
  }
  const [nomeCliente] = clienteEncontrado;
  const token = jwt.sign({ clienteAccess: true, cliente: nomeCliente }, SESSION_SECRET, { expiresIn: "8h" });
  const logEntry = `[${new Date().toISOString()}] PORTAL_CLIENTE_ACCESS cliente=${nomeCliente} ip=${req.ip}\n`;
  try {
    fs.appendFileSync(path.resolve("Saida/portal_cliente_acessos.log"), logEntry, "utf-8");
  } catch {}
  res.redirect(`/portal-cliente?t=${token}`);
});

// GET /portal-cliente/relatorio/:arquivo — servir relatório específico do cliente
router.get("/portal-cliente/relatorio/:arquivo", (req: Request, res: Response) => {
  const check = verificarTokenCliente(req);
  if (!check.valid || !check.cliente) {
    return res.redirect("/portal-cliente");
  }
  const filename = path.basename(String(req.params.arquivo));
  const filePath = path.join(RELATORIOS_CLIENTE_DIR, check.cliente, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Relatório não encontrado.");
  }
  res.sendFile(filePath);
});

// GET /api/admin/enviar-relatorio — admin envia relatório para cliente
router.post("/api/admin/enviar-relatorio", (req: Request, res: Response) => {
  if (!verificarTokenDashboard(req)) {
    return res.status(401).json({ error: "Não autenticado como admin" });
  }
  const { arquivo_origem, cliente, renomear_como } = req.body as {
    arquivo_origem: string;
    cliente: string;
    renomear_como?: string;
  };
  if (!arquivo_origem || !cliente) {
    return res.status(400).json({ error: "arquivo_origem e cliente obrigatórios" });
  }
  if (!CLIENTES[cliente]) {
    return res.status(400).json({ error: `Cliente '${cliente}' não cadastrado` });
  }
  const srcName = path.basename(arquivo_origem);
  const origemDir = path.resolve("dist/public/dd-reports");
  const src = path.join(origemDir, srcName);
  if (!fs.existsSync(src)) {
    return res.status(404).json({ error: "Arquivo de origem não encontrado" });
  }
  const destDir = path.join(RELATORIOS_CLIENTE_DIR, cliente);
  fs.mkdirSync(destDir, { recursive: true });
  const destName = renomear_como ? path.basename(renomear_como) : srcName;
  const dest = path.join(destDir, destName);
  fs.copyFileSync(src, dest);
  res.json({ ok: true, cliente, arquivo: destName, tamanho_kb: (fs.statSync(dest).size / 1024).toFixed(0) });
});

export default router;
