/**
 * run.ts — Orquestrador principal do Motor de Due Diligence Criminal
 *
 * USO:
 *   npx tsx --env-file=.env server/scripts/due_diligence/run.ts \
 *     --processo="1503896-55.2022.8.26.0050" \
 *     --senha="SENHA_AQUI" \
 *     --defensora="Dra. Márcia Mirtes" \
 *     --cliente="[NOME DO RÉU]" \
 *     --saida=./Saida/due_diligence/1503896 \
 *     --max-docs-ia=200
 *
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS:
 *   ANTHROPIC_API_KEY — para análise IA (opcional, mas recomendado)
 *
 * FLAGS:
 *   --apenas-relatorio — pula download e análise, gera relatório do checkpoint existente
 *   --sem-ia           — desabilita análise com Claude (mais rápido, sem custo de API)
 *   --max-docs-ia=N    — limite de documentos para análise IA (padrão: 200)
 */

import * as fs from "fs";
import * as path from "path";
import { autenticarESAJ, fecharSessao } from "./tjsp_auth.js";
import { downloadarDocumentos, carregarCheckpoint, inventarioCSV } from "./documento_downloader.js";
import { analisarCadeiaCustodia } from "./cadeia_custodia.js";
import { avaliarConformidade } from "./conformidade_cpp.js";
import { executarRadarDefesa } from "./radar_defesa.js";
import { gerarRelatorioHTML, salvarRelatorioHTML, gerarRelatorioPDF } from "./relatorio_generator.js";

// ─── Parse de argumentos CLI ─────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2] || "true";
  }
  return args;
}

// ─── Logger com timestamp ─────────────────────────────────────────────────────

function criarLogger(dirSaida: string): (msg: string) => void {
  const logPath = path.join(dirSaida, "due_diligence.log");
  fs.mkdirSync(dirSaida, { recursive: true });

  return (msg: string) => {
    const linha = `[${new Date().toISOString()}] ${msg}`;
    console.log(linha);
    fs.appendFileSync(logPath, linha + "\n", "utf-8");
  };
}

// ─── Progresso visual ────────────────────────────────────────────────────────

function barraProgresso(atual: number, total: number, largura = 40): string {
  const pct = Math.min(1, atual / total);
  const preenchido = Math.round(pct * largura);
  return `[${"█".repeat(preenchido)}${"░".repeat(largura - preenchido)}] ${atual}/${total} (${(pct * 100).toFixed(1)}%)`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  const numeroCNJ = args["processo"] || args["p"];
  const senha = args["senha"] || args["s"];
  const defensora = args["defensora"] || "Defensora não informada";
  const cliente = args["cliente"] || "[NOME PROTEGIDO — SEGREDO DE JUSTIÇA]";
  const dirSaida = args["saida"] || path.join("Saida", "due_diligence", "processo_" + Date.now());
  const apenasRelatorio = args["apenas-relatorio"] === "true";
  const semIA = args["sem-ia"] === "true";
  const maxDocsIA = parseInt(args["max-docs-ia"] || "200");

  if (!numeroCNJ) {
    console.error("Erro: --processo é obrigatório");
    console.error("Exemplo: npx tsx --env-file=.env server/scripts/due_diligence/run.ts --processo=1503896-55.2022.8.26.0050 --senha=SENHA");
    process.exit(1);
  }

  if (!senha && !apenasRelatorio) {
    console.error("Erro: --senha é obrigatória (exceto com --apenas-relatorio)");
    process.exit(1);
  }

  const log = criarLogger(dirSaida);

  log("═══════════════════════════════════════════════════════════");
  log("  AuraTECH — Motor de Due Diligence Criminal v1.0");
  log("═══════════════════════════════════════════════════════════");
  log(`  Processo:   ${numeroCNJ}`);
  log(`  Tribunal:   TJSP`);
  log(`  Defensora:  ${defensora}`);
  log(`  Saída:      ${dirSaida}`);
  log(`  Análise IA: ${semIA ? "DESABILITADA" : `até ${maxDocsIA} documentos`}`);
  log(`  Senha:      ${"*".repeat(senha?.length ?? 0)} (omitida do log)`);
  log("═══════════════════════════════════════════════════════════\n");

  const inicio = Date.now();

  // ── FASE 1: Autenticação e download ──────────────────────────────────────
  let checkpoint = carregarCheckpoint(dirSaida);
  let metadata: any = null;

  if (!apenasRelatorio) {
    log("[FASE 1/4] Autenticando no portal eSAJ do TJSP...");

    let browser: any = null;
    let context: any = null;

    try {
      const sessao = await autenticarESAJ(numeroCNJ, senha!, log);
      browser = sessao.browser;
      context = sessao.context;
      metadata = sessao.metadata;

      // Salvar metadata do processo
      const metadataPath = path.join(dirSaida, "processo_metadata.json");
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
      log(`[FASE 1/4] Metadata salvo: ${metadata.totalPecas} peças identificadas`);

      // Modo de teste — apenas autentica e sai
      if (args["so-autenticar"] === "true") {
        log(`\n[TESTE] Autenticação bem-sucedida.`);
        log(`[TESTE] Processo: ${metadata.classe || "não extraída"}`);
        log(`[TESTE] Vara: ${metadata.vara || "não extraída"}`);
        log(`[TESTE] Comarca: ${metadata.comarca || "não extraída"}`);
        log(`[TESTE] Total de peças: ${metadata.totalPecas}`);
        log(`[TESTE] Encerrando em modo --so-autenticar. Nenhum download realizado.`);
        await fecharSessao(browser);
        process.exit(0);
      }

      // ── FASE 2: Download dos documentos ─────────────────────────────────
      log(`\n[FASE 2/4] Iniciando download de ${metadata.totalPecas} peças processuais...`);
      log(`           Checkpoint automático a cada peça — pode interromper e retomar com segurança`);

      checkpoint = await downloadarDocumentos(
        context,
        metadata,
        dirSaida,
        log,
        (atual, total, doc) => {
          process.stdout.write(`\r  ${barraProgresso(atual, total)} — ${doc.descricao.substring(0, 30)}`);
        },
      );
      console.log(); // nova linha após barra de progresso

      // Salvar inventário CSV
      const csvPath = inventarioCSV(checkpoint, dirSaida);
      log(`[FASE 2/4] Inventário salvo: ${csvPath}`);

    } finally {
      if (browser) {
        await fecharSessao(browser).catch(() => {});
        log("[FASE 2/4] Sessão do browser encerrada");
      }
    }
  } else {
    log("[FASE 1-2] Modo --apenas-relatorio: pulando autenticação e download");

    // Carregar metadata se disponível
    const metadataPath = path.join(dirSaida, "processo_metadata.json");
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      log(`[FASE 1-2] Metadata carregado: ${metadata.totalPecas} peças`);
    }
  }

  if (!checkpoint) {
    log("ERRO: Nenhum dado disponível para análise. Execute sem --apenas-relatorio primeiro.");
    process.exit(1);
  }

  // Metadata sintético se não disponível
  if (!metadata) {
    metadata = {
      numeroCNJ,
      tribunal: "TJSP",
      vara: null,
      comarca: null,
      classe: null,
      assunto: null,
      totalPecas: checkpoint.totalPecas,
      partes: [],
      pecas: [],
      capturedAt: new Date().toISOString(),
      sha256Sessao: "",
    };
  }

  // ── FASE 3: Análises ──────────────────────────────────────────────────────
  log(`\n[FASE 3/4] Iniciando análise técnica de ${checkpoint.documentos.length} documentos...`);

  log("[FASE 3/4] → Cadeia de custódia (SHA-256 + sequência + assinaturas)...");
  const custodia = await analisarCadeiaCustodia(checkpoint, log);

  log("[FASE 3/4] → Conformidade legal (42 regras CPP/CF/CADH)...");
  const conformidade = avaliarConformidade({
    textos: custodia.analises.map((a) => a.textoExtraido),
    analises: custodia.analises,
    numeroCNJ,
    totalDocumentos: checkpoint.documentos.length,
    documentosSemAssinatura: custodia.analises.filter((a) => !a.temAssinaturaDigital).map((a) => a.numero),
    lacunasNumeracao: custodia.lacunas,
  });

  log("[FASE 3/4] → Radar de defesa (IA + subsídios estratégicos)...");
  const radar = semIA
    ? {
        totalDocumentosAnalisados: 0,
        subsidiosCriticos: [],
        subsidiosAlta: [],
        subsidiosMedia: [],
        analisesPorDocumento: [],
        recomendacoesEstrategicas: ["Execute sem --sem-ia para habilitar análise com Claude"],
        resumoExecutivo: `Due diligence do processo ${numeroCNJ} concluída. Análise IA desabilitada. Score custódia: ${custodia.scoreIntegridade}/100. Conformidade: ${conformidade.scoreConformidade}/100.`,
        geradoEm: new Date().toISOString(),
      }
    : await executarRadarDefesa(custodia, conformidade, numeroCNJ, maxDocsIA, log);

  // ── FASE 4: Relatório ─────────────────────────────────────────────────────
  log(`\n[FASE 4/4] Gerando relatório HTML e PDF...`);

  const config = {
    numeroCNJ,
    cliente,
    defensora,
    dataAnalise: new Date().toISOString(),
    dirSaida,
  };

  const html = gerarRelatorioHTML(config, metadata, checkpoint, custodia, conformidade, radar);
  const htmlPath = salvarRelatorioHTML(html, dirSaida, numeroCNJ);
  log(`[FASE 4/4] Relatório HTML: ${htmlPath}`);

  const pdfPath = await gerarRelatorioPDF(config, metadata, custodia, conformidade, radar, dirSaida);
  log(`[FASE 4/4] Relatório PDF: ${pdfPath}`);

  // ── SUMÁRIO FINAL ─────────────────────────────────────────────────────────
  const duracaoMin = ((Date.now() - inicio) / 60000).toFixed(1);

  log("\n═══════════════════════════════════════════════════════════");
  log("  DUE DILIGENCE CONCLUÍDA");
  log("═══════════════════════════════════════════════════════════");
  log(`  Processo:              ${numeroCNJ}`);
  log(`  Documentos baixados:   ${checkpoint.baixados}/${checkpoint.totalPecas}`);
  log(`  Documentos analisados: ${custodia.totalDocumentos}`);
  log(`  Lacunas detectadas:    ${custodia.totalLacunas}`);
  log(`  Score custódia:        ${custodia.scoreIntegridade}/100 (${custodia.integridadeGeral})`);
  log(`  Score conformidade:    ${conformidade.scoreConformidade}/100`);
  log(`  Nulidades absolutas:   ${conformidade.nulidadesAbsolutas}`);
  log(`  Subsídios urgentes:    ${radar.subsidiosCriticos.length}`);
  log(`  Duração total:         ${duracaoMin} minutos`);
  log(`  Relatório HTML:        ${htmlPath}`);
  log(`  Relatório PDF:         ${pdfPath}`);
  log("═══════════════════════════════════════════════════════════\n");

  if (conformidade.nulidadesAbsolutas > 0) {
    log(`⚠️  ATENÇÃO: ${conformidade.nulidadesAbsolutas} nulidade(s) absoluta(s) detectada(s) — revisão prioritária!`);
  }
  if (custodia.totalLacunas > 0) {
    log(`⚠️  ATENÇÃO: ${custodia.totalLacunas} peça(s) ausente(s) — possível supressão de documentos!`);
  }
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
