/**
 * sincronizar_esaj_minimal.ts — Captura evidência mínima do eSAJ sem pipeline completo.
 *
 * USO:
 *   npx tsx server/scripts/due_diligence/sincronizar_esaj_minimal.ts \
 *     --processo="1000346-13.2022.8.26.0082" \
 *     --senha="***" \
 *     --saida="C:/Temp/auraloa-saida/1000346-esaj"
 *
 * O QUE FAZ:
 *   1. Autentica no eSAJ via tjsp_auth.ts (Playwright headful, slowMo 120)
 *   2. Captura metadata (tribunal, vara, classe, assunto, fase, totalPecas, sha256Sessao)
 *   3. Salva screenshot da pasta digital
 *   4. Fecha browser
 *   5. Emite JSON de resultado para stdout (parse pelo caller)
 *
 * O QUE NÃO FAZ:
 *   - NÃO baixa PDFs das 1.176 páginas (redundante — já temos pasta local)
 *   - NÃO chama IA (Sonnet/Haiku)
 *   - NÃO persiste senha em nenhum arquivo (mascarada em log)
 *
 * ANTI-REGRESSÃO:
 *   - Qualquer retorno com texto não-PDF e sem metadata válido = erro (magic %PDF check
 *     já está dentro do pasta_digital_navigator). Aqui só validamos autenticação.
 */

import * as fs from "fs";
import * as path from "path";
import { autenticarESAJ, fecharSessao } from "./tjsp_auth.js";

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2] || "true";
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const processo = args.processo;
  const senha = args.senha || "";
  const saida = args.saida || "C:/Temp/auraloa-saida/esaj-minimal";

  if (!processo) {
    console.error("ERRO: --processo é obrigatório");
    process.exit(1);
  }

  fs.mkdirSync(saida, { recursive: true });

  const logPath = path.join(saida, "sessao.log");
  const logFn = (msg: string) => {
    // Mascarar senha em qualquer log (defesa em profundidade)
    const sanitized = senha ? msg.split(senha).join("***") : msg;
    const linha = `[${new Date().toISOString()}] ${sanitized}`;
    console.log(linha);
    fs.appendFileSync(logPath, linha + "\n", "utf-8");
  };

  let browser: any = null;

  try {
    logFn(`[START] Sincronizando eSAJ — processo ${processo}`);
    logFn(`[START] Saída: ${saida}`);

    const result = await autenticarESAJ(processo, senha, logFn);
    browser = result.browser;
    const page = result.page;
    const metadata = result.metadata;

    logFn(`[AUTH] Autenticação OK`);
    logFn(`[META] Tribunal: ${metadata.tribunal}`);
    logFn(`[META] Vara: ${metadata.vara ?? "—"}`);
    logFn(`[META] Classe: ${metadata.classe ?? "—"}`);
    logFn(`[META] Assunto: ${metadata.assunto ?? "—"}`);
    logFn(`[META] Fase: ${metadata.fase ?? "—"}`);
    logFn(`[META] Total de peças reportado: ${metadata.totalPecas}`);
    logFn(`[META] SHA-256 da sessão: ${metadata.sha256Sessao}`);

    // Screenshot evidência
    const screenshotPath = path.join(saida, "screenshot.png");
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
      logFn(`[EVID] Screenshot salvo: ${screenshotPath}`);
    } catch (err: any) {
      logFn(`[WARN] Falha ao salvar screenshot: ${err?.message || err}`);
    }

    // Metadata completo (sem peças — só o resumo)
    const metadataPath = path.join(saida, "metadata.json");
    const metadataPublic = {
      numeroCNJ: metadata.numeroCNJ,
      tribunal: metadata.tribunal,
      vara: metadata.vara,
      comarca: metadata.comarca,
      classe: metadata.classe,
      assunto: metadata.assunto,
      fase: metadata.fase,
      dataDistribuicao: metadata.dataDistribuicao,
      totalPecas: metadata.totalPecas,
      sha256Sessao: metadata.sha256Sessao,
      capturedAt: metadata.capturedAt || new Date().toISOString(),
      partes: (metadata.partes || []).map((p) => ({
        polo: p.polo,
        nome: p.nome,
        cpfCnpj: p.cpfCnpj ? String(p.cpfCnpj).replace(/\d(?=\d{4})/g, "*") : null,
      })),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadataPublic, null, 2), "utf-8");
    logFn(`[EVID] Metadata salvo: ${metadataPath}`);

    await fecharSessao(browser);
    browser = null;
    logFn(`[DONE] Sincronização concluída em ${saida}`);

    // Marcador para parse pelo caller
    console.log("\n===AURA_LEGAL_RESULT_BEGIN===");
    console.log(JSON.stringify({
      ok: true,
      cnj: processo,
      capturedAt: metadataPublic.capturedAt,
      tribunal: metadataPublic.tribunal,
      vara: metadataPublic.vara,
      classe: metadataPublic.classe,
      fase: metadataPublic.fase,
      totalPecas: metadataPublic.totalPecas,
      sha256Sessao: metadataPublic.sha256Sessao,
      screenshotPath,
      metadataPath,
    }, null, 2));
    console.log("===AURA_LEGAL_RESULT_END===");
    process.exit(0);

  } catch (err: any) {
    const sanitized = senha ? String(err?.message || err).split(senha).join("***") : String(err?.message || err);
    logFn(`[ERROR] ${sanitized}`);
    try { if (browser) await fecharSessao(browser); } catch {}
    console.error("\n===AURA_LEGAL_RESULT_BEGIN===");
    console.error(JSON.stringify({
      ok: false,
      cnj: processo,
      error: sanitized,
      timestamp: new Date().toISOString(),
    }, null, 2));
    console.error("===AURA_LEGAL_RESULT_END===");
    process.exit(2);
  }
}

main();
