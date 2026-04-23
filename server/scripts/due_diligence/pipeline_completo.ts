/**
 * pipeline_completo.ts — Orquestrador AuraDUE (Agentes 1 → 4 em sessão contínua)
 * ─────────────────────────────────────────────────────────────────────────────
 * Executa Agente 1 (Pasta Digital Navigator) e Agente 4 (OCR) na MESMA sessão
 * autenticada do eSAJ, garantindo que as URLs dos PDFs ainda sejam válidas
 * no momento do OCR.
 *
 * FLUXO:
 *   1. Agente 1 autentica no eSAJ, navega a Pasta Digital, salva PDFs inline
 *   2. Sessão do browser é mantida aberta (manterSessaoAberta: true)
 *   3. Agente 4 usa a mesma sessão para abrir o viewer e capturar screenshots
 *   4. Claude Haiku faz OCR de cada página via PNG
 *   5. (Opcional) Claude Sonnet gera análise macro
 *   6. Browser é fechado ao final
 *
 * USO:
 *   npx tsx --env-file=.env server/scripts/due_diligence/pipeline_completo.ts \
 *     --saida=./Saida/due_diligence/1503896 \
 *     --paginas=40 \
 *     --macro=true
 *
 * FLAGS:
 *   --saida=DIR      Diretório de saída (padrão: ./Saida/due_diligence/1503896)
 *   --cnj=CNJ        Número CNJ (padrão: lê TJSP_CNJ do .env)
 *   --senha=SENHA    Senha do processo (padrão: lê TJSP_SENHA do .env)
 *   --limite=N       Limite de peças para o Agente 1 (padrão: todas)
 *   --paginas=N      Número de páginas para OCR (padrão: 40)
 *   --macro          Gerar análise macro após OCR (padrão: true)
 *   --so-ocr         Apenas OCR, sem análise macro
 */

import * as fs from "fs";
import * as path from "path";
import { navegarPastaDigital, type SessaoNavegacao } from "./pasta_digital_navigator.js";
import { rodarOCR } from "./ocr_agent.js";

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2] || "true";
  }
  return args;
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  const args = parseArgs();

  const dirSaida  = args["saida"]   || "./Saida/due_diligence/1503896";
  const numeroCNJ = args["cnj"]     || process.env.TJSP_CNJ    || "1503896-55.2022.8.26.0050";
  const senha     = args["senha"]   || process.env.TJSP_SENHA  || "";
  const limite    = args["limite"]  ? parseInt(args["limite"])  : Infinity;
  const maxPaginas= args["paginas"] ? parseInt(args["paginas"]) : 40;
  const gerarMacro= args["so-ocr"] !== "true" && args["macro"] !== "false";

  // ── GUARD CRÍTICO: bloqueia execução dentro do OneDrive ─────────────────
  // OneDrive intercepta I/O com ReparsePoint → file locks → Playwright fecha
  // BrowserContext silenciosamente → OCR falha. Confirmado em 01/04/2026.
  // Com OneDrive: 9/20 páginas. Com C:\Temp: 20/20 páginas.
  const dirSaidaAbs = path.resolve(dirSaida);
  if (dirSaidaAbs.toLowerCase().includes("onedrive")) {
    log("╔══════════════════════════════════════════════════════════╗");
    log("║  ⛔ ERRO CRÍTICO — DIRETÓRIO DE SAÍDA DENTRO DO ONEDRIVE  ║");
    log("╠══════════════════════════════════════════════════════════╣");
    log(`║  Path detectado: ${dirSaidaAbs.substring(0, 50)}`);
    log("║                                                          ║");
    log("║  O OneDrive intercepta I/O de arquivos e causa falhas    ║");
    log("║  silenciosas no Playwright (BrowserContext fechado).     ║");
    log("║                                                          ║");
    log("║  Use SEMPRE:                                             ║");
    log("║  --saida=C:/Temp/auraloa-saida/1503896                  ║");
    log("╚══════════════════════════════════════════════════════════╝");
    process.exit(1);
  }

  if (!senha) {
    log("[PIPELINE] ⚠️  ATENÇÃO: Nenhuma senha fornecida. Defina TJSP_SENHA no .env ou use --senha=XXXX");
    log("[PIPELINE] Prosseguindo sem senha — pode falhar na autenticação.");
  }

  fs.mkdirSync(dirSaida, { recursive: true });

  log("═══════════════════════════════════════════════════════════");
  log("  AuraDUE — Pipeline Completo (Agente 1 + Agente 4)");
  log(`  Processo: ${numeroCNJ}`);
  log(`  Meta OCR: ${maxPaginas} páginas`);
  log(`  Análise macro: ${gerarMacro ? "sim" : "não"}`);
  log("═══════════════════════════════════════════════════════════");

  // ── FASE 1: Agente 1 — Navegar Pasta Digital ─────────────────────────────
  log("\n[PIPELINE] ════ FASE 1: Agente 1 — Pasta Digital Navigator ════");

  let sessao: SessaoNavegacao;
  try {
    const resultado = await navegarPastaDigital(numeroCNJ, senha, dirSaida, {
      limite,
      headless: false,
      manterSessaoAberta: true,   // ← mantém sessão aberta para o OCR
      logFn: log,
    });

    // Garantir que recebemos uma SessaoNavegacao (não ManifestoPecas simples)
    if (!("context" in resultado)) {
      throw new Error("Agente 1 não retornou sessão aberta — verifique manterSessaoAberta");
    }
    sessao = resultado as SessaoNavegacao;
  } catch (err: any) {
    log(`[PIPELINE] FATAL: Agente 1 falhou — ${err.message}`);
    process.exit(1);
  }

  const { manifesto, context, browser } = sessao;

  log(`\n[PIPELINE] Agente 1 concluído:`);
  log(`[PIPELINE]   Peças capturadas:  ${manifesto.pecasCapturadas}`);
  log(`[PIPELINE]   Peças com PDF:     ${manifesto.pecasVerificadas}`);
  log(`[PIPELINE]   Sessão:            ABERTA ✓`);

  // ── FASE 2: Agentes 2 e 3 — Downloader e Extrator (rápidos, sem browser) ──
  log("\n[PIPELINE] ════ FASE 2: Agente 2 — Checkpoint Download ════");
  try {
    const { baixarPDFs } = await import("./pdf_downloader.js");
    await baixarPDFs(numeroCNJ, senha, dirSaida, { logFn: log });
  } catch (err: any) {
    log(`[PIPELINE] Aviso: Agente 2 falhou (${err.message}) — continuando com manifesto`);
  }

  log("\n[PIPELINE] ════ FASE 3: Agente 3 — Extrator de Texto ════");
  try {
    const { extrairTextos } = await import("./extrator_texto.js");
    await extrairTextos(dirSaida, { logFn: log });
  } catch (err: any) {
    log(`[PIPELINE] Aviso: Agente 3 falhou (${err.message}) — continuando para OCR`);
  }

  // ── FASE 3: Agente 4 — OCR com sessão compartilhada ──────────────────────
  log("\n[PIPELINE] ════ FASE 4: Agente 4 — OCR (sessão compartilhada) ════");

  try {
    const { checkpoint, analise } = await rodarOCR(dirSaida, numeroCNJ, senha, {
      maxPaginas,
      gerarMacro,
      contextoExistente: context,   // ← sessão do Agente 1, URLs ainda válidas
      logFn: log,
    });

    log("\n═══════════════════════════════════════════════════════════");
    log("  AuraDUE — Pipeline Completo — RESULTADO FINAL");
    log(`  Peças navegadas:      ${manifesto.pecasCapturadas}`);
    log(`  PDFs salvos:          ${manifesto.pecasVerificadas}`);
    log(`  Páginas OCR válidas:  ${checkpoint.validas} / ${checkpoint.totalPaginasProcessadas}`);
    log(`  Método de acesso:     ${checkpoint.metodoAcesso}`);
    log(`  Custo OCR:            $${checkpoint.custoTotalUSD.toFixed(4)}`);
    if (analise) {
      log(`  Análise macro:        ✓ (${analise.totalPaginasAnalisadas} páginas)`);
      log(`  Custo análise:        $${analise.custoEstimadoUSD.toFixed(4)}`);
      log(`  Custo total:          $${(checkpoint.custoTotalUSD + analise.custoEstimadoUSD).toFixed(4)}`);
      log(`  Arquivo:              ${dirSaida}/analise_macro.md`);
    }
    log("═══════════════════════════════════════════════════════════");

  } catch (err: any) {
    log(`[PIPELINE] ERRO no Agente 4: ${err.message}`);
  } finally {
    log("[PIPELINE] Fechando browser...");
    await browser.close().catch(() => {});
    log("[PIPELINE] Browser fechado.");
  }
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
