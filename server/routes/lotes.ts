/**
 * lotes.ts — API de Pesquisas em Lote (Precatórios)
 *
 * Apenas admin e usuários com pode_lote=true têm acesso.
 * Usuário comum NÃO vê nada de lotes.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { query } from "../db";
import { requireAuth, requireAdmin } from "./auth";
import { createHash } from "crypto";

const router = Router();

// ── Middleware: requireLoteAccess ────────────────────────────────────────────
export function requireLoteAccess(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    const { role, email } = (req as any).authUser;
    if (role === "admin") return next();

    const rows = await query<{ pode_lote: boolean }>("SELECT pode_lote FROM aura_users WHERE email = $1", [email]);
    if (rows[0]?.pode_lote) return next();

    return res.status(403).json({ message: "Acesso a lotes não autorizado" });
  });
}

// ── POST /api/lotes — Criar lote a partir de CSV parseado ───────────────────
router.post("/api/lotes", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { nome, descricao, ano_exercicio, processos } = req.body;
    const email = (req as any).authUser.email;

    if (!nome || !processos || !Array.isArray(processos) || processos.length === 0) {
      return res.status(400).json({ message: "Nome e lista de processos são obrigatórios" });
    }

    const csvHash = createHash("sha256").update(JSON.stringify(processos)).digest("hex");

    const lotes = await query<{ id: number; uuid: string }>(
      `INSERT INTO lote_pesquisas (criado_por, nome, descricao, ano_exercicio, total_processos, csv_origem_sha256)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, uuid`,
      [email, nome, descricao || null, ano_exercicio || null, processos.length, csvHash]
    );
    const lote = lotes[0];

    for (const p of processos) {
      await query(
        `INSERT INTO lote_processos
         (lote_id, numero_cnj, numero_formatado, tribunal, classe, situacao, valor_original, data_ajuizamento, orgao_julgador, url_esaj, url_eproc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          lote.id,
          p.numero_cnj || "",
          p.numero_formatado || "",
          p.tribunal || "",
          p.classe || "",
          p.situacao || null,
          p.valor_causa ? parseFloat(String(p.valor_causa).replace(/[^\d.,]/g, "").replace(",", ".")) : null,
          p.data_ajuizamento || null,
          p.orgao_julgador || null,
          p.url_esaj || null,
          p.url_eproc || null,
        ]
      );
    }

    return res.json({
      id: lote.id,
      uuid: lote.uuid,
      total_processos: processos.length,
      message: `Lote "${nome}" criado com ${processos.length} processos`,
    });
  } catch (err: any) {
    console.error("[Lotes] Erro ao criar lote:", err.message);
    return res.status(500).json({ message: "Erro ao criar lote" });
  }
});

// ── GET /api/lotes — Listar lotes ───────────────────────────────────────────
router.get("/api/lotes", requireLoteAccess, async (req: Request, res: Response) => {
  try {
    const { role, email } = (req as any).authUser;
    let lotes;

    if (role === "admin") {
      lotes = await query(
        `SELECT id, uuid, nome, descricao, ano_exercicio, status, criado_por,
                total_processos, total_encontrados, total_manuais,
                created_at, updated_at
         FROM lote_pesquisas ORDER BY created_at DESC`
      );
    } else {
      lotes = await query(
        `SELECT id, uuid, nome, descricao, ano_exercicio, status, criado_por,
                total_processos, total_encontrados, total_manuais,
                created_at, updated_at
         FROM lote_pesquisas WHERE criado_por = $1 ORDER BY created_at DESC`,
        [email]
      );
    }

    return res.json({ lotes });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao listar lotes" });
  }
});

// ── GET /api/lotes/:id — Detalhe do lote com processos ─────────────────────
router.get("/api/lotes/:id", requireLoteAccess, async (req: Request, res: Response) => {
  try {
    const loteId = parseInt(String(req.params.id));
    const { role, email } = (req as any).authUser;

    const lotes = await query<any>("SELECT * FROM lote_pesquisas WHERE id = $1", [loteId]);
    const lote = lotes[0];
    if (!lote) return res.status(404).json({ message: "Lote não encontrado" });

    if (role !== "admin" && lote.criado_por !== email) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const processos = await query<any>(
      `SELECT id, numero_cnj, numero_formatado, tribunal, classe, situacao,
              valor_original, valor_enriquecido, fonte_valor, status_valor,
              data_ajuizamento, orgao_julgador, url_esaj, atualizado_por, updated_at
       FROM lote_processos WHERE lote_id = $1 ORDER BY id`,
      [loteId]
    );

    const encontrados = processos.filter(p => p.status_valor === "encontrado").length;
    const manuais = processos.filter(p => p.status_valor === "manual").length;
    const pendentes = processos.filter(p => p.status_valor === "pendente").length;
    const naoEncontrados = processos.filter(p => p.status_valor === "nao_encontrado").length;

    return res.json({
      lote: { ...lote, total_encontrados: encontrados, total_manuais: manuais },
      processos,
      resumo: { total: processos.length, encontrados, manuais, pendentes, nao_encontrados: naoEncontrados },
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao buscar lote" });
  }
});

// ── POST /api/lotes/:id/enriquecer — Disparar enriquecimento eSAJ ──────────
router.post("/api/lotes/:id/enriquecer", requireAdmin, async (req: Request, res: Response) => {
  try {
    const loteId = parseInt(String(req.params.id));
    const { amostra_pct = 100 } = req.body;

    const lotes = await query<any>("SELECT * FROM lote_pesquisas WHERE id = $1", [loteId]);
    if (!lotes[0]) return res.status(404).json({ message: "Lote não encontrado" });

    await query("UPDATE lote_pesquisas SET status = 'enriquecendo', updated_at = NOW() WHERE id = $1", [loteId]);

    const pendentes = await query<any>(
      `SELECT id, numero_formatado, tribunal, classe FROM lote_processos
       WHERE lote_id = $1 AND status_valor = 'pendente' AND classe = 'Precatório' AND tribunal = 'TJSP'
       ORDER BY id`,
      [loteId]
    );

    const tamanhoAmostra = Math.ceil(pendentes.length * (amostra_pct / 100));
    const amostra = pendentes.slice(0, tamanhoAmostra);

    res.json({
      message: `Enriquecimento iniciado para ${amostra.length} de ${pendentes.length} processos pendentes`,
      total_pendentes: pendentes.length,
      amostra: amostra.length,
      lote_id: loteId,
      status: "enriquecendo",
    });

    enriquecerEmBackground(loteId, amostra).catch((err) => {
      console.error(`[Lotes] Erro no enriquecimento do lote ${loteId}:`, err.message);
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao iniciar enriquecimento" });
  }
});

// ── PUT /api/lotes/:id/processo/:procId — Atualizar valor manualmente ───────
router.put("/api/lotes/:id/processo/:procId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const loteId = parseInt(String(req.params.id));
    const procId = parseInt(String(req.params.procId));
    const { valor, fonte } = req.body;
    const email = (req as any).authUser.email;

    if (valor === undefined || valor === null) {
      return res.status(400).json({ message: "Valor é obrigatório" });
    }

    const valorNum = parseFloat(String(valor).replace(/[^\d.,]/g, "").replace(",", "."));
    if (isNaN(valorNum)) {
      return res.status(400).json({ message: "Valor inválido" });
    }

    await query(
      `UPDATE lote_processos
       SET valor_enriquecido = $1, fonte_valor = $2, status_valor = 'manual', atualizado_por = $3, updated_at = NOW()
       WHERE id = $4 AND lote_id = $5`,
      [valorNum, fonte || "manual_admin", email, procId, loteId]
    );

    await atualizarContadoresLote(loteId);
    return res.json({ message: "Valor atualizado", processo_id: procId, valor: valorNum });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao atualizar valor" });
  }
});

// ── GET /api/lotes/:id/csv — Exportar lote como CSV ────────────────────────
router.get("/api/lotes/:id/csv", requireLoteAccess, async (req: Request, res: Response) => {
  try {
    const loteId = parseInt(String(req.params.id));
    const filtro = req.query.filtro as string;

    let sql = `SELECT numero_cnj, numero_formatado, tribunal, classe, situacao,
              valor_original, valor_enriquecido, fonte_valor, status_valor,
              data_ajuizamento, orgao_julgador, url_esaj
       FROM lote_processos WHERE lote_id = $1`;
    if (filtro) sql += ` AND status_valor = '${filtro.replace(/[^a-z_]/g, "")}'`;
    sql += " ORDER BY id";

    const rows = await query<any>(sql, [loteId]);

    const header = "Numero CNJ;Numero Formatado;Tribunal;Classe;Situacao;Valor Original;Valor Enriquecido;Fonte;Status;Data Ajuizamento;Orgao Julgador;URL eSAJ\n";
    const linhas = rows.map((r: any) =>
      [
        r.numero_cnj, r.numero_formatado, r.tribunal, r.classe, r.situacao || "",
        r.valor_original || "", r.valor_enriquecido || "", r.fonte_valor || "",
        r.status_valor, r.data_ajuizamento || "", `"${r.orgao_julgador || ""}"`, r.url_esaj || "",
      ].join(";")
    ).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=lote_${loteId}_${filtro || "completo"}.csv`);
    return res.send(header + linhas);
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao exportar CSV" });
  }
});

// ── DELETE /api/lotes/:id — Excluir lote ────────────────────────────────────
router.delete("/api/lotes/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await query("DELETE FROM lote_pesquisas WHERE id = $1", [parseInt(String(req.params.id))]);
    return res.json({ message: "Lote excluído" });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao excluir lote" });
  }
});

// ── GET /api/lotes/loa/dashboard — Dashboard admin LOA (precatórios acima de R$10M)
router.get("/api/lotes/loa/dashboard", requireAdmin, async (req: Request, res: Response) => {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const csvPath = path.join(process.cwd(), "data", "loa", "precatorios_ACIMA_10M.csv");

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: "Arquivo LOA não encontrado no servidor" });
    }

    // Filtros via query string
    const filtroTribunal = req.query.tribunal as string || "";
    const filtroValorMin = parseInt(req.query.valorMin as string) || 0;
    const filtroValorMax = parseInt(req.query.valorMax as string) || Infinity;
    const filtroAno = req.query.ano as string || "";

    const raw = fs.readFileSync(csvPath, "utf-8");
    const linhas = raw.split("\n").filter(l => l.trim());
    // CSV v2: tribunal;uo_cadastradora_codigo;uo_cadastradora_nome;uo_devedora_codigo;uo_devedora_nome;numero_precatorio;tipo_causa;valor_reais;ano_orcamento;cnj
    // CSV v1 (legado): Tribunal;UO_Devedora;Assunto;Numero_Precatorio;Valor;Ano
    const headerCols = linhas[0].split(";");
    const isV2 = headerCols.includes("valor_reais") || headerCols.includes("ano_orcamento");

    const todosRegistros = linhas.slice(1).map((l, idx) => {
      const cols = l.split(";");
      if (isV2) {
        // CSV v2 (parser_loa_final.py com pdfplumber)
        return {
          id: idx + 1,
          tribunal: cols[0] || "",
          uo_cadastradora_codigo: cols[1] || "",
          uo_cadastradora_nome: cols[2] || "",
          uo_devedora_codigo: cols[3] || "",
          uo_devedora: cols[4] || "",
          numero_precatorio: cols[5] || "",
          assunto: cols[6] || "",
          valor: parseInt(cols[7]) || 0,
          ano: cols[8] || "",
          cnj: cols[9] || "pendente_consulta_tribunal",
        };
      } else {
        // CSV v1 (legado)
        return {
          id: idx + 1,
          tribunal: cols[0] || "",
          uo_cadastradora_codigo: "",
          uo_cadastradora_nome: "",
          uo_devedora_codigo: "",
          uo_devedora: cols[1] || "",
          numero_precatorio: cols[3] || "",
          assunto: cols[2] || "",
          valor: parseInt(cols[4]) || parseInt(cols[1]) || 0,
          ano: cols[5] || cols[2] || "",
          cnj: "pendente_consulta_tribunal",
        };
      }
    }).filter(r => r.valor > 0);

    // Aplicar filtros
    const registros = todosRegistros.filter(r => {
      if (filtroTribunal && !r.tribunal.includes(filtroTribunal)) return false;
      if (r.valor < filtroValorMin) return false;
      if (filtroValorMax < Infinity && r.valor > filtroValorMax) return false;
      if (filtroAno && r.ano !== filtroAno) return false;
      return true;
    });

    // KPIs
    const totalRegistros = registros.length;
    const valorTotal = registros.reduce((s, r) => s + r.valor, 0);
    const acima50M = registros.filter(r => r.valor >= 50000000).length;
    const acima100M = registros.filter(r => r.valor >= 100000000).length;
    const maiorValor = registros.length > 0 ? Math.max(...registros.map(r => r.valor)) : 0;

    // Por tribunal
    const porTribunal: Record<string, { count: number; total: number }> = {};
    registros.forEach(r => {
      const t = r.tribunal || "N/I";
      if (!porTribunal[t]) porTribunal[t] = { count: 0, total: 0 };
      porTribunal[t].count++;
      porTribunal[t].total += r.valor;
    });
    const tribunais = Object.entries(porTribunal)
      .map(([nome, v]) => ({ nome, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);

    // Por UO Devedora
    const porDevedora: Record<string, { count: number; total: number }> = {};
    registros.forEach(r => {
      const d = r.uo_devedora || "N/I";
      if (!porDevedora[d]) porDevedora[d] = { count: 0, total: 0 };
      porDevedora[d].count++;
      porDevedora[d].total += r.valor;
    });
    const devedoras = Object.entries(porDevedora)
      .map(([nome, v]) => ({ nome, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);

    // Por tipo causa
    const porTipoCausa: Record<string, { count: number; total: number }> = {};
    registros.forEach(r => {
      const tc = r.assunto?.substring(0, 40) || "N/I";
      if (!porTipoCausa[tc]) porTipoCausa[tc] = { count: 0, total: 0 };
      porTipoCausa[tc].count++;
      porTipoCausa[tc].total += r.valor;
    });
    const tiposCausa = Object.entries(porTipoCausa)
      .map(([nome, v]) => ({ nome, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);

    // Por faixa de valor
    const faixas = [
      { label: "R$ 10M - 50M", min: 10000000, max: 50000000 },
      { label: "R$ 50M - 100M", min: 50000000, max: 100000000 },
      { label: "R$ 100M - 500M", min: 100000000, max: 500000000 },
      { label: "R$ 500M - 1B", min: 500000000, max: 1000000000 },
      { label: "R$ 1B+", min: 1000000000, max: Infinity },
    ].map(f => ({
      ...f,
      count: registros.filter(r => r.valor >= f.min && r.valor < f.max).length,
      total: registros.filter(r => r.valor >= f.min && r.valor < f.max).reduce((s, r) => s + r.valor, 0),
    }));

    // Todos os registros ordenados por valor
    const todosOrdenados = [...registros].sort((a, b) => b.valor - a.valor);

    // Lista de tribunais disponíveis para filtro (de TODOS os registros, não filtrados)
    const tribunaisDisponiveis = Array.from(new Set(todosRegistros.map(r => r.tribunal).filter(Boolean))).sort();

    // Totais globais (sem filtro) para contexto
    const totalGlobal = todosRegistros.length;
    const valorGlobal = todosRegistros.reduce((s, r) => s + r.valor, 0);

    return res.json({
      kpis: { totalRegistros, valorTotal, acima50M, acima100M, maiorValor },
      global: { total: totalGlobal, valor: valorGlobal },
      tribunais,
      tribunaisDisponiveis,
      devedoras: devedoras.slice(0, 15),
      tiposCausa: tiposCausa.slice(0, 10),
      faixas,
      precatorios: todosOrdenados,
      atualizado_em: fs.statSync(csvPath).mtime.toISOString(),
    });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar dashboard LOA" });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function atualizarContadoresLote(loteId: number) {
  const rows = await query<{ encontrados: string; manuais: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE status_valor = 'encontrado') AS encontrados,
       COUNT(*) FILTER (WHERE status_valor = 'manual') AS manuais
     FROM lote_processos WHERE lote_id = $1`,
    [loteId]
  );
  const c = rows[0];
  await query(
    "UPDATE lote_pesquisas SET total_encontrados = $1, total_manuais = $2, updated_at = NOW() WHERE id = $3",
    [parseInt(c.encontrados), parseInt(c.manuais), loteId]
  );
}

async function enriquecerEmBackground(loteId: number, processos: any[]) {
  let chromium: any;
  try {
    chromium = (await import("playwright")).chromium;
  } catch {
    console.error("[Lotes] Playwright não disponível no servidor. Enriquecimento via script CLI.");
    await query("UPDATE lote_pesquisas SET status = 'erro', updated_at = NOW() WHERE id = $1", [loteId]);
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    slowMo: 100,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled", "--disable-infobars",
      "--disable-extensions", "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["pt-BR", "pt", "en-US"] });
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();
  let encontrados = 0;

  for (const proc of processos) {
    try {
      await page.goto("https://esaj.tjsp.jus.br/cpopg/open.do", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1200 + Math.random() * 800);

      const partesCNJ = proc.numero_formatado.match(/^(\d{7}-\d{2}\.\d{4})\.\d\.\d{2}\.(\d{4})$/);
      const numPrincipal = partesCNJ?.[1] || proc.numero_formatado.substring(0, 15);
      const foro = partesCNJ?.[2] || "0053";

      const campoNumero = page.locator('input[name="numeroDigitoAnoUnificado"]');
      await campoNumero.click();
      await campoNumero.fill("");
      await page.waitForTimeout(200);
      await campoNumero.type(numPrincipal, { delay: 60 });

      const campoForo = page.locator('input[name="foroNumeroUnificado"]');
      await campoForo.click();
      await campoForo.fill("");
      await page.waitForTimeout(150);
      await campoForo.type(foro, { delay: 60 });

      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Consultar" }).click();
      await page.waitForTimeout(2500);
      await page.waitForLoadState("networkidle", { timeout: 30000 });

      const prefixo = proc.numero_formatado.substring(0, 7);
      const link = page.locator(`a[href*="${prefixo}"]`).first();
      if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
        await link.click();
        await page.waitForTimeout(2000);
      }

      const html = await page.content();
      const match = html.match(/id="valorAcaoProcesso"[^>]*>([^<]+)/);
      if (match) {
        const valorTexto = match[1].trim();
        const valorNum = parseFloat(valorTexto.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", "."));

        if (!isNaN(valorNum)) {
          await query(
            `UPDATE lote_processos SET valor_enriquecido = $1, fonte_valor = 'esaj_cpopg', status_valor = 'encontrado', updated_at = NOW() WHERE id = $2`,
            [valorNum, proc.id]
          );
          encontrados++;
        } else {
          await query("UPDATE lote_processos SET status_valor = 'nao_encontrado', updated_at = NOW() WHERE id = $1", [proc.id]);
        }
      } else {
        await query("UPDATE lote_processos SET status_valor = 'nao_encontrado', updated_at = NOW() WHERE id = $1", [proc.id]);
      }

      await page.waitForTimeout(2000 + Math.random() * 3000);
    } catch (err: any) {
      console.error(`[Lotes] Erro no processo ${proc.numero_formatado}:`, err.message);
      await query("UPDATE lote_processos SET status_valor = 'nao_encontrado', updated_at = NOW() WHERE id = $1", [proc.id]);
    }
  }

  await browser.close();
  await atualizarContadoresLote(loteId);
  await query("UPDATE lote_pesquisas SET status = 'concluido', updated_at = NOW() WHERE id = $1", [loteId]);
  console.log(`[Lotes] Enriquecimento do lote ${loteId} concluído. ${encontrados}/${processos.length} encontrados.`);
}

export default router;
