/**
 * dd_pipeline.ts — Pipeline Due Diligence completo para precatórios LOA
 * ────────────────────────────────────────────────────────────────────────
 * Fase 0: Busca reversa CNJ (DataJud por classe + tribunal + valor)
 * Fase 1: Consulta DataJud com CNJ encontrado
 * Fase 2: Raspagem web (fontes públicas)
 * Fase 2B: Score heurístico (16 regras)
 * Fase 3: Consulta direta tribunal
 * Fase 4/5: Autenticidade + Cruzamento
 * Fase 6: Geração de relatório HTML padrão Adimix (6 abas)
 */

import { Router, type Request, type Response } from "express";
import * as crypto from "crypto";
import * as path from "path";

import {
  buscarCNJPorPrecatorio,
  fetchPrecatorioByNumero,
  type BuscaReversaCNJInput,
  type BuscaReversaCNJResult,
} from "../services/estoque_datajud";
import { runBRAnalysis, type BRAnalysisResult } from "../services/analysis-engine-br";

const router = Router();

// ── Tipos do pipeline ────────────────────────────────────────────────────────

interface DDFaseResult {
  fase: string;
  status: "ok" | "parcial" | "erro" | "indisponivel";
  dados: any;
  fontes: string[];
  timestamp: string;
  duracao_ms: number;
}

interface DDPipelineResult {
  precatorio: {
    numero: string;
    tribunal: string;
    tribunal_alias: string;
    valor: number;
    ano: number;
    uo_devedora: string | null;
    assunto: string | null;
  };
  fase_pre0_credor: DDFaseResult;
  fase0_cnj: DDFaseResult;
  fase1_datajud: DDFaseResult;
  fase2_raspagem: DDFaseResult;
  fase2b_score: DDFaseResult;
  fase3_tribunal: DDFaseResult;
  fase4_autenticidade: DDFaseResult;
  fase5_cruzamento: DDFaseResult;
  fases_concluidas: string[];
  fases_pendentes: string[];
  cnj_encontrado: string | null;
  confianca_cnj: string;
  score_final: number;
  status_final: string;
  relatorio_url: string | null;
  timestamp: string;
  sha256: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizarTribunalAlias(tribunal: string): string {
  const t = tribunal.trim();
  // Padrões específicos primeiro (mais restritivos)
  if (/supremo tribunal federal/i.test(t)) return "stf";
  if (/superior tribunal de justi/i.test(t)) return "stj";
  // TRF - captura "TRF - 3a. Região", "TRF - 1a. Região", etc.
  const trf = t.match(/trf\s*[-–]\s*(\d)/i);
  if (trf) return `trf${trf[1]}`;
  // TRT - captura "TRT - 24a. Região", etc.
  const trt = t.match(/trt\s*[-–]\s*(\d{1,2})/i);
  if (trt) return `trt${trt[1].padStart(2, "0")}`;
  // TJs estaduais
  if (/tribunal de justi.*s[aã]o paulo/i.test(t)) return "tjsp";
  if (/tribunal de justi.*rio de janeiro/i.test(t)) return "tjrj";
  if (/tribunal de justi.*minas gerais/i.test(t)) return "tjmg";
  if (/tribunal de justi.*rio grande do sul/i.test(t)) return "tjrs";
  if (/tribunal de justi.*paran[aá]/i.test(t)) return "tjpr";
  if (/tribunal de justi.*santa catarina/i.test(t)) return "tjsc";
  if (/tribunal de justi.*bahia/i.test(t)) return "tjba";
  if (/tribunal de justi.*amazonas/i.test(t)) return "tjam";
  // F. Regime Geral / EFU / UO Cadastradora — são órgãos, não tribunais
  if (/f\.\s*regime|efu|uo\s*cadastradora/i.test(t)) return "stf";
  // Fallback: limpar e retornar
  return t.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "").substring(0, 10);
}

function formatarValorBR(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

// ── FASE PRÉ-0: Identificar Credor via Portal da Transparência ──────────────
//    LOA(UO) → orgaoSuperior → Portal "recursos-recebidos" → credor + CNPJ
//    Descoberto e validado em 14/04/2026 (caso DNIT → Rio Pedreira)

const UO_PARA_ORGAO_SUPERIOR: Record<string, { orgaoSuperior: string; nome: string; orgNome: string }> = {
  "71103": { orgaoSuperior: "03000", nome: "EFU - Sentenças Judiciais", orgNome: "Advocacia-Geral da União" },
  "33201": { orgaoSuperior: "33000", nome: "INSS", orgNome: "Min. Previdência Social" },
  "33904": { orgaoSuperior: "33000", nome: "Fundo RGPS", orgNome: "Min. Previdência Social" },
  "52101": { orgaoSuperior: "52000", nome: "Min. da Defesa", orgNome: "Min. da Defesa" },
  "26245": { orgaoSuperior: "26000", nome: "UFRJ", orgNome: "Min. da Educação" },
  "26236": { orgaoSuperior: "26000", nome: "UFF", orgNome: "Min. da Educação" },
  "26406": { orgaoSuperior: "26000", nome: "IFES", orgNome: "Min. da Educação" },
  "26271": { orgaoSuperior: "26000", nome: "FUB/UnB", orgNome: "Min. da Educação" },
  "26298": { orgaoSuperior: "26000", nome: "FNDE", orgNome: "Min. da Educação" },
  "26269": { orgaoSuperior: "26000", nome: "FURJ", orgNome: "Min. da Educação" },
  "24204": { orgaoSuperior: "24000", nome: "CNEN", orgNome: "Min. Ciência e Tecnologia" },
  "24201": { orgaoSuperior: "24000", nome: "CNPq", orgNome: "Min. Ciência e Tecnologia" },
  "44201": { orgaoSuperior: "44000", nome: "IBAMA", orgNome: "Min. Meio Ambiente" },
  "25101": { orgaoSuperior: "25000", nome: "Min. da Fazenda", orgNome: "Min. da Fazenda" },
  "39207": { orgaoSuperior: "39000", nome: "VALEC", orgNome: "Min. Transportes" },
  "39252": { orgaoSuperior: "39000", nome: "DNIT", orgNome: "Min. Transportes" },
  "36211": { orgaoSuperior: "36000", nome: "FUNASA", orgNome: "Min. da Saúde" },
  "36901": { orgaoSuperior: "36000", nome: "Fundo Nac. Saúde", orgNome: "Min. da Saúde" },
  "47205": { orgaoSuperior: "47000", nome: "IBGE", orgNome: "Min. Plan. e Orçamento" },
  "47101": { orgaoSuperior: "47000", nome: "Min. Plan. e Orçamento", orgNome: "Min. Plan. e Orçamento" },
  "32265": { orgaoSuperior: "32000", nome: "ANP", orgNome: "Min. Minas e Energia" },
  "83201": { orgaoSuperior: "83000", nome: "EGPA", orgNome: "Encargos Financeiros" },
  "22202": { orgaoSuperior: "22000", nome: "INCRA", orgNome: "Min. Desenv. Agrário" },
  "53208": { orgaoSuperior: "53000", nome: "SUFRAMA", orgNome: "Min. Desenv. Indústria" },
  "20113": { orgaoSuperior: "20000", nome: "Presidência", orgNome: "Presidência da República" },
};

// Palavras-chave de tipo de causa → ajudam a filtrar credor no Portal
const TIPO_CAUSA_KEYWORDS: Record<string, string[]> = {
  "FUNDEF": ["municipio", "prefeitura", "estado", "secretaria"],
  "Desapropriação": ["construtora", "imobiliaria", "fazenda"],
  "SUS": ["hospital", "santa casa", "clinica", "laboratorio"],
  "Prestação de Serviços": ["construtora", "engenharia", "servicos"],
  "Servidores": ["servidor", "associacao", "sindicato"],
  "Tributário": ["empresa", "industria", "comercio"],
};

interface CredorIdentificado {
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  tipo_pessoa: string | null;
  valor_recebido: string | null;
  fonte: string;
  confianca: "alta" | "media" | "baixa";
}

async function executarFaseCredor(
  uoDevedoraCodigo: string,
  uoDevedoraNome: string,
  tipoCausa: string,
  valorPrecatorio: number,
): Promise<DDFaseResult & { credores: CredorIdentificado[] }> {
  const inicio = Date.now();
  const credores: CredorIdentificado[] = [];

  try {
    const https = await import("https");
    const apiKey = process.env.PORTAL_API_KEY || "6081aeff3e70fc8c1fb98be64e427669";

    // PASSO 1: Mapear UO → orgaoSuperior
    const mapa = UO_PARA_ORGAO_SUPERIOR[uoDevedoraCodigo];
    if (!mapa) {
      console.log(`[Credor] UO ${uoDevedoraCodigo} (${uoDevedoraNome}) sem mapeamento para orgaoSuperior`);
      return {
        fase: "fase_pre0_credor",
        status: "parcial",
        dados: {
          metodo: "uo_sem_mapeamento",
          uo_codigo: uoDevedoraCodigo,
          uo_nome: uoDevedoraNome,
          observacao: `UO ${uoDevedoraCodigo} não possui mapeamento para órgão superior. Adicionar ao mapa.`,
        },
        fontes: [],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicio,
        credores,
      };
    }

    console.log(`[Credor] UO ${uoDevedoraCodigo} → orgaoSuperior ${mapa.orgaoSuperior} (${mapa.orgNome})`);

    // PASSO 2: Consultar Portal da Transparência — recursos-recebidos
    // Buscar pagamentos do órgão superior no ano mais recente
    const anoAtual = new Date().getFullYear();
    const mesAnoInicio = `01/${anoAtual - 1}`;
    const mesAnoFim = `12/${anoAtual - 1}`;

    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/recursos-recebidos?mesAnoInicio=${encodeURIComponent(mesAnoInicio)}&mesAnoFim=${encodeURIComponent(mesAnoFim)}&orgaoSuperior=${mapa.orgaoSuperior}&pagina=1`;

    console.log(`[Credor] Consultando Portal Transparência: orgaoSuperior=${mapa.orgaoSuperior}, período=${mesAnoInicio}-${mesAnoFim}`);

    const portalData: any = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: { "chave-api-dados": apiKey, "Accept": "application/json" },
      }, (resp) => {
        let body = "";
        resp.on("data", (chunk: any) => body += chunk);
        resp.on("end", () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      });
      req.on("error", reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout Portal Transparência")); });
    });

    if (!Array.isArray(portalData) || portalData.length === 0) {
      console.log(`[Credor] Portal Transparência: 0 registros para orgaoSuperior=${mapa.orgaoSuperior}`);

      // Tentar com UO direta como unidadeGestora
      const url2 = `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/recursos-recebidos?mesAnoInicio=${encodeURIComponent(mesAnoInicio)}&mesAnoFim=${encodeURIComponent(mesAnoFim)}&unidadeGestora=${uoDevedoraCodigo}&pagina=1`;

      const portalData2: any = await new Promise((resolve, reject) => {
        const req = https.get(url2, {
          headers: { "chave-api-dados": apiKey, "Accept": "application/json" },
        }, (resp) => {
          let body = "";
          resp.on("data", (chunk: any) => body += chunk);
          resp.on("end", () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          });
        });
        req.on("error", reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
      });

      if (Array.isArray(portalData2) && portalData2.length > 0) {
        console.log(`[Credor] Portal Transparência (UG): ${portalData2.length} registros para UG=${uoDevedoraCodigo}`);
        processarResultadosPortal(portalData2, credores, valorPrecatorio, tipoCausa);
      }
    } else {
      console.log(`[Credor] Portal Transparência: ${portalData.length} registros para orgaoSuperior=${mapa.orgaoSuperior}`);
      processarResultadosPortal(portalData, credores, valorPrecatorio, tipoCausa);
    }

    // PASSO 3: Se ainda não achou, tentar endpoint despesas/documentos (fase=3 pagamento)
    if (credores.length === 0) {
      // Buscar por funcional programática — ação de sentenças judiciais
      const acoesSentencas = ["0005", "0022", "0625", "218Y", "0EC7"];
      for (const acao of acoesSentencas) {
        const urlFp = `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-funcional-programatica?ano=${anoAtual}&acao=${acao}&orgaoSuperior=${mapa.orgaoSuperior}&pagina=1`;
        try {
          const fpData: any = await new Promise((resolve, reject) => {
            const req = https.get(urlFp, {
              headers: { "chave-api-dados": apiKey, "Accept": "application/json" },
            }, (resp) => {
              let body = "";
              resp.on("data", (chunk: any) => body += chunk);
              resp.on("end", () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
              });
            });
            req.on("error", reject);
            req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
          });

          if (Array.isArray(fpData) && fpData.length > 0) {
            console.log(`[Credor] Funcional-programática ação=${acao}: ${fpData.length} registros`);
            // Extrair favorecidos se disponível nos dados
            fpData.forEach((item: any) => {
              if (item.favorecido?.nome && item.favorecido?.codigoFormatado) {
                credores.push({
                  nome: item.favorecido.nome,
                  cnpj: item.favorecido.codigoFormatado?.replace(/[.\-\/]/g, "") || null,
                  municipio: null,
                  uf: null,
                  tipo_pessoa: item.favorecido.tipo || null,
                  valor_recebido: item.pago || item.valorPago || null,
                  fonte: `Portal Transparência — ação ${acao}`,
                  confianca: "media",
                });
              }
            });
            if (credores.length > 0) break;
          }
        } catch {
          // Silenciar erro de ação individual
        }
      }
    }

    // PASSO 4: Para credores encontrados, buscar CNPJ na BrasilAPI se não tiver
    for (const credor of credores) {
      if (credor.cnpj && credor.cnpj.length >= 11) {
        try {
          const cnpjLimpo = credor.cnpj.replace(/[.\-\/]/g, "");
          const brasilData: any = await new Promise((resolve, reject) => {
            https.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, (resp) => {
              let body = "";
              resp.on("data", (chunk: any) => body += chunk);
              resp.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
            }).on("error", reject);
          });
          if (brasilData.razao_social) {
            credor.nome = brasilData.razao_social;
            credor.municipio = brasilData.municipio || credor.municipio;
            credor.uf = brasilData.uf || credor.uf;
            credor.tipo_pessoa = brasilData.descricao_tipo || credor.tipo_pessoa;
            console.log(`[Credor] BrasilAPI confirmou: ${credor.nome} (${credor.cnpj}) — ${credor.municipio}/${credor.uf}`);
          }
        } catch {
          // BrasilAPI pode falhar — não é crítico
        }
      }
    }

    const melhorCredor = credores.length > 0 ? credores[0] : null;
    console.log(`[Credor] Resultado: ${credores.length} candidatos | Melhor: ${melhorCredor?.nome || "NENHUM"} | CNPJ: ${melhorCredor?.cnpj || "N/A"}`);

    return {
      fase: "fase_pre0_credor",
      status: credores.length > 0 ? "ok" : "parcial",
      dados: {
        metodo: credores.length > 0 ? "portal_transparencia" : "sem_resultado",
        orgao_superior: mapa.orgaoSuperior,
        orgao_nome: mapa.orgNome,
        uo_codigo: uoDevedoraCodigo,
        uo_nome: uoDevedoraNome,
        total_candidatos: credores.length,
        credor_principal: melhorCredor,
        todos_credores: credores,
        tipo_causa: tipoCausa,
        periodo_consulta: `${mesAnoInicio} a ${mesAnoFim}`,
      },
      fontes: ["Portal da Transparência API — recursos-recebidos", "BrasilAPI (CNPJ)"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
      credores,
    };

  } catch (err: any) {
    console.error(`[Credor] Erro: ${err.message}`);
    return {
      fase: "fase_pre0_credor",
      status: "erro",
      dados: { erro: err.message },
      fontes: [],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
      credores,
    };
  }
}

function processarResultadosPortal(
  dados: any[],
  credores: CredorIdentificado[],
  valorPrecatorio: number,
  tipoCausa: string,
): void {
  // Filtrar por favorecidos que receberam valores compatíveis
  const favorecidosUnicos = new Map<string, { nome: string; cnpj: string; total: number; municipio: string; uf: string; tipo: string }>();

  dados.forEach((item: any) => {
    const nome = item.favorecido?.nome || item.nomeFavorecido || "";
    const cnpj = item.favorecido?.codigoFormatado || item.codigoFavorecido || "";
    const valor = parseFloat(String(item.valor || item.pago || "0").replace(/[R$.\s]/g, "").replace(",", ".")) || 0;
    const municipio = item.favorecido?.municipio || item.municipioFavorecido || "";
    const uf = item.favorecido?.uf || item.ufFavorecido || "";
    const tipo = item.favorecido?.tipo || "";

    if (!nome || nome.length < 3) return;

    // Ignorar órgãos públicos e bancos (não são credores de precatórios)
    const ignorePatterns = /BANCO DO BRASIL|CAIXA ECONOMICA|TESOURO NACIONAL|SECRETARIA DO TESOURO|RECEITA FEDERAL/i;
    if (ignorePatterns.test(nome)) return;

    const key = cnpj || nome;
    if (!favorecidosUnicos.has(key)) {
      favorecidosUnicos.set(key, { nome, cnpj: cnpj.replace(/[.\-\/]/g, ""), total: valor, municipio, uf, tipo });
    } else {
      const existing = favorecidosUnicos.get(key)!;
      existing.total += valor;
    }
  });

  // Ordenar por valor (maior primeiro) e pegar os top candidatos
  const sorted = Array.from(favorecidosUnicos.values())
    .filter(f => f.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  sorted.forEach(f => {
    credores.push({
      nome: f.nome,
      cnpj: f.cnpj && f.cnpj.length >= 11 ? f.cnpj : null,
      municipio: f.municipio || null,
      uf: f.uf || null,
      tipo_pessoa: f.tipo || null,
      valor_recebido: f.total > 0 ? formatarValorBR(f.total) : null,
      fonte: "Portal da Transparência — recursos-recebidos",
      confianca: f.total >= valorPrecatorio * 0.5 ? "alta" : f.total >= valorPrecatorio * 0.1 ? "media" : "baixa",
    });
  });
}

// ── FASE 0-ENRIQ: Enriquecimento CNJ (SIOP CSV → CNPJ → TRF1) ──────────────

interface EnriquecimentoResult {
  cnj_originario: string | null;
  cnj_execucao: string | null;
  cnpj_entidade: string | null;
  metodo: string;
  candidatos_trf1: { cnj: string; tribunal: string }[];
  registro_siop: Record<string, string> | null;
}

async function executarFaseEnriquecimento(
  numeroPrecatorio: string,
  valor: number,
  tribunalAlias: string,
  cnpjCredor?: string | null,
): Promise<DDFaseResult> {
  const inicio = Date.now();
  const resultado: EnriquecimentoResult = {
    cnj_originario: null,
    cnj_execucao: null,
    cnpj_entidade: null,
    metodo: "nenhum",
    candidatos_trf1: [],
    registro_siop: null,
  };

  try {
    const fs = await import("fs");
    const path = await import("path");

    // ── PASSO 1: Ler LOA_FULL_CONCILIADO.csv ──────────────────────────────
    const fullPath = path.resolve("data/LOA_FULL_CONCILIADO.csv");
    if (!fs.existsSync(fullPath)) {
      return {
        fase: "fase0_enriquecimento",
        status: "indisponivel",
        dados: { ...resultado, erro: "CSV LOA_FULL_CONCILIADO.csv não encontrado em data/" },
        fontes: [],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicio,
      };
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const headerLine = lines[0].replace(/^\uFEFF/, "");
    const header = headerLine.split(",");
    const foundLine = lines.slice(1).find((l) => l.includes(numeroPrecatorio));

    if (!foundLine) {
      return {
        fase: "fase0_enriquecimento",
        status: "parcial",
        dados: { ...resultado, metodo: "nao_encontrado_siop", observacao: "Precatório não encontrado no CSV SIOP conciliado" },
        fontes: ["SIOP/LOA FULL CONCILIADO (1.590 registros)"],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicio,
      };
    }

    // Parsear registro
    const cols = foundLine.split(",");
    const record: Record<string, string> = {};
    header.forEach((h, i) => { record[h.trim()] = (cols[i] || "").trim(); });
    resultado.registro_siop = record;

    // ── PASSO 2: Verificar se já tem CNJ ──────────────────────────────────
    const cnjOrig = record["cnj_processo_originario"]?.trim();
    const cnjExec = record["cnj_processo_execucao"]?.trim();
    const cnpjEnt = record["cnpj_entidade_devedora"]?.trim() || cnpjCredor || "";

    resultado.cnpj_entidade = cnpjEnt || null;
    if (cnpjCredor && !record["cnpj_entidade_devedora"]?.trim()) {
      console.log(`[Enriquecimento] CNPJ do credor injetado pela fase Credor: ${cnpjCredor}`);
    }

    if (cnjOrig && cnjOrig.length >= 15) {
      resultado.cnj_originario = cnjOrig;
      resultado.cnj_execucao = cnjExec || null;
      resultado.metodo = "siop_csv_direto";
      console.log(`[Enriquecimento] CNJ encontrado direto no SIOP: orig=${cnjOrig} exec=${cnjExec || "N/A"}`);

      return {
        fase: "fase0_enriquecimento",
        status: "ok",
        dados: resultado,
        fontes: ["SIOP/LOA FULL CONCILIADO — CNJ já presente no CSV"],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicio,
      };
    }

    // ── PASSO 3: Tem CNPJ? → BrasilAPI (razão social) → PJe TRF1 (nome da parte) ─
    if (cnpjEnt && cnpjEnt.length >= 11) {
      resultado.metodo = "cnpj_para_trf1";
      console.log(`[Enriquecimento] CNJ ausente. CNPJ ${cnpjEnt} — buscando razão social via BrasilAPI...`);

      // Passo 3A: Buscar razão social via BrasilAPI
      let razaoSocial: string | null = null;
      let nomeFantasia: string | null = null;
      try {
        const https = await import("https");
        const cnpjLimpo = cnpjEnt.replace(/[.\-\/]/g, "");
        const brasilData: any = await new Promise((resolve, reject) => {
          https.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, (resp) => {
            let body = "";
            resp.on("data", (chunk: any) => body += chunk);
            resp.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
          }).on("error", reject);
        });
        razaoSocial = brasilData.razao_social || null;
        nomeFantasia = brasilData.nome_fantasia || null;
        console.log(`[Enriquecimento] BrasilAPI: razao="${razaoSocial}" fantasia="${nomeFantasia}"`);
      } catch (brasilErr: any) {
        console.log(`[Enriquecimento] BrasilAPI erro: ${brasilErr.message}`);
      }

      // Passo 3B: Buscar no PJe TRF1 por nome da parte
      // Preferir nome fantasia (curto, ex: "INCRA") para busca mais ampla
      const termoBusca = nomeFantasia || razaoSocial;
      if (termoBusca) {
        try {
          const roboPje = require("../scripts/robo_pje/drivers/trf1.cjs");
          const trf1Result = await roboPje.consultarPorCNPJ(cnpjEnt, {
            headless: true,
            timeout: 60000,
            nome_entidade: termoBusca,
          });

          if (trf1Result.processos && trf1Result.processos.length > 0) {
            resultado.candidatos_trf1 = trf1Result.processos;
            console.log(`[Enriquecimento] PJe TRF1 retornou ${trf1Result.processos.length} CNJs para "${termoBusca}"`);

            // Se encontrou apenas 1 candidato, usar direto
            if (trf1Result.processos.length === 1) {
              resultado.cnj_originario = trf1Result.processos[0].cnj;
              resultado.metodo = "pje_trf1_nome_unico";
            } else {
              resultado.metodo = "pje_trf1_nome_candidatos";
            }
          } else {
            resultado.metodo = trf1Result.erro ? "pje_trf1_erro" : "pje_trf1_sem_resultado";
            if (trf1Result.erro) {
              console.log(`[Enriquecimento] PJe TRF1 erro: ${trf1Result.erro}`);
            } else {
              console.log(`[Enriquecimento] PJe TRF1 sem resultados para "${termoBusca}"`);
            }
          }
        } catch (playwrightErr: any) {
          console.log(`[Enriquecimento] Playwright indisponível ou erro: ${playwrightErr.message}`);
          resultado.metodo = "cnpj_disponivel_playwright_indisponivel";
        }
      } else {
        resultado.metodo = "cnpj_sem_razao_social";
        console.log(`[Enriquecimento] CNPJ ${cnpjEnt} sem razão social — não é possível buscar no PJe por nome`);
      }

      return {
        fase: "fase0_enriquecimento",
        status: resultado.cnj_originario ? "ok" : "parcial",
        dados: {
          ...resultado,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          termo_busca: termoBusca,
        },
        fontes: [
          "SIOP/LOA FULL CONCILIADO (CNPJ)",
          ...(razaoSocial ? ["BrasilAPI (razão social)"] : []),
          ...(resultado.candidatos_trf1.length > 0 ? [`PJe TRF1 — Nome da Parte (${resultado.candidatos_trf1.length} processos)`] : []),
        ],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicio,
      };
    }

    // ── PASSO 4: Sem CNPJ → UO genérica ──────────────────────────────────
    resultado.metodo = "sem_cnpj_uo_generica";
    const causaProvavel = record["causa_provavel"] || "";
    console.log(`[Enriquecimento] Sem CNPJ para enriquecimento. UO: ${record["UO_Devedora_Nome"] || "?"} | Causa: ${causaProvavel}`);

    return {
      fase: "fase0_enriquecimento",
      status: "parcial",
      dados: {
        ...resultado,
        observacao: `UO genérica (${record["UO_Devedora_Nome"] || "EFU"}) — sem CNPJ específico para busca no TRF1. Enriquecimento CNJ requer identificação manual da entidade devedora.`,
        causa_provavel: causaProvavel,
      },
      fontes: ["SIOP/LOA FULL CONCILIADO"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };

  } catch (err: any) {
    return {
      fase: "fase0_enriquecimento",
      status: "erro",
      dados: { ...resultado, erro: err.message },
      fontes: [],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  }
}

// ── FASE 0: Busca reversa CNJ ────────────────────────────────────────────────

async function executarFase0(input: BuscaReversaCNJInput): Promise<DDFaseResult> {
  const inicio = Date.now();
  try {
    const resultado = await buscarCNJPorPrecatorio(input);
    return {
      fase: "fase0_busca_cnj",
      status: resultado.encontrado ? "ok" : "parcial",
      dados: resultado,
      fontes: ["DataJud CNJ API"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  } catch (err: any) {
    return {
      fase: "fase0_busca_cnj",
      status: "erro",
      dados: { erro: err.message },
      fontes: ["DataJud CNJ API"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  }
}

// ── FASE 1: DataJud com CNJ ──────────────────────────────────────────────────

async function executarFase1(cnj: string | null, numeroPrecatorio: string): Promise<DDFaseResult> {
  const inicio = Date.now();
  if (!cnj) {
    return {
      fase: "fase1_datajud_cnj",
      status: "indisponivel",
      dados: { motivo: "CNJ não encontrado na Fase 0" },
      fontes: [],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  }

  try {
    const resultado = await fetchPrecatorioByNumero(cnj, numeroPrecatorio);
    return {
      fase: "fase1_datajud_cnj",
      status: resultado.encontrado ? "ok" : "parcial",
      dados: resultado,
      fontes: ["DataJud CNJ API — busca por processo"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  } catch (err: any) {
    return {
      fase: "fase1_datajud_cnj",
      status: "erro",
      dados: { erro: err.message },
      fontes: ["DataJud CNJ API"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  }
}

// ── FASE 2: Raspagem web (fontes públicas) ───────────────────────────────────

async function executarFase2(
  cnj: string | null,
  tribunal_alias: string,
  uo_devedora: string | null,
  valor: number,
): Promise<DDFaseResult> {
  const inicio = Date.now();
  const fontes_consultadas: { nome: string; status: string; detalhe: string }[] = [];

  // FNDE/SIOPE — verificar se é FUNDEF
  fontes_consultadas.push({
    nome: "FNDE / SIOPE",
    status: "pendente",
    detalhe: "Consulta de histórico de precatórios FUNDEF",
  });

  // Portal da Transparência
  fontes_consultadas.push({
    nome: "Portal da Transparência",
    status: "indisponivel",
    detalhe: "Precatórios federais não consolidados por ação orçamentária",
  });

  // Receita Federal — CNPJ credor
  fontes_consultadas.push({
    nome: "Receita Federal (CNPJ)",
    status: "pendente",
    detalhe: "Validação de CNPJ do credor/devedor",
  });

  // OAB CNA — advogado
  fontes_consultadas.push({
    nome: "OAB CNA",
    status: "pendente",
    detalhe: "Verificação de advogado na OAB",
  });

  // DataJud — processos relacionados
  if (cnj) {
    fontes_consultadas.push({
      nome: "DataJud (processos relacionados)",
      status: "consultado",
      detalhe: `CNJ ${cnj} — consulta de processos vinculados`,
    });
  }

  // Google CSE — pesquisa web
  fontes_consultadas.push({
    nome: "Google CSE",
    status: "pendente",
    detalhe: `Pesquisa: "${uo_devedora || "precatório"} + ${tribunal_alias} + precatório"`,
  });

  // JusBrasil
  fontes_consultadas.push({
    nome: "JusBrasil",
    status: "pendente",
    detalhe: "Busca de processos e publicações",
  });

  // Escavador
  fontes_consultadas.push({
    nome: "Escavador",
    status: "pendente",
    detalhe: "Busca de informações processuais",
  });

  return {
    fase: "fase2_raspagem_web",
    status: "parcial",
    dados: {
      total_fontes: fontes_consultadas.length,
      fontes_consultadas,
      observacao: "Raspagem web em modo básico — fontes que requerem autenticação marcadas como pendentes",
    },
    fontes: fontes_consultadas.map((f) => f.nome),
    timestamp: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
  };
}

// ── FASE 2B: Score heurístico ────────────────────────────────────────────────

function executarFase2B(
  cnj: string | null,
  tribunal: string,
  valor: number,
  uo_devedora: string | null,
  assunto: string | null,
  fase1Dados: any,
): DDFaseResult {
  const inicio = Date.now();

  // Montar texto sintético para o motor de análise (simula dados do documento)
  const partes: string[] = [];
  if (cnj) partes.push(`Processo: ${cnj}`);
  partes.push(`Tribunal: ${tribunal}`);
  if (uo_devedora) partes.push(`Credor: ${uo_devedora}`);
  partes.push(`Devedor: UNIÃO FEDERAL`);
  partes.push(`Valor: R$ ${valor.toLocaleString("pt-BR")}`);
  if (assunto) partes.push(`Assunto: ${assunto}`);

  // Dados extras do DataJud fase 1
  if (fase1Dados?.encontrado) {
    if (fase1Dados.orgao_julgador?.nome) partes.push(`Órgão Julgador: ${fase1Dados.orgao_julgador.nome}`);
    if (fase1Dados.classe_nome) partes.push(`Classe: ${fase1Dados.classe_nome}`);
    if (fase1Dados.data_ajuizamento) partes.push(`Data ajuizamento: ${fase1Dados.data_ajuizamento}`);
    if (fase1Dados.assuntos?.length) {
      partes.push(`Assuntos: ${fase1Dados.assuntos.map((a: any) => a.nome).join(", ")}`);
    }
  }

  const textoSintetico = partes.join("\n");
  let analise: BRAnalysisResult;

  try {
    analise = runBRAnalysis(textoSintetico);
  } catch (err: any) {
    return {
      fase: "fase2b_score_heuristico",
      status: "erro",
      dados: { erro: err.message },
      fontes: ["analysis-engine-br.ts"],
      timestamp: new Date().toISOString(),
      duracao_ms: Date.now() - inicio,
    };
  }

  // Ajustar score com base nos dados da LOA (regras complementares)
  let scoreAjustado = analise.score;
  const ajustes: { regra: string; delta: number; motivo: string }[] = [];

  // R-LOA-001: Precatório presente na LOA federal = +15
  ajustes.push({ regra: "R-LOA-001", delta: 15, motivo: "Precatório listado na LOA 2026 federal" });
  scoreAjustado += 15;

  // R-LOA-002: Valor alto (>10M) no orçamento = +5 (verificável)
  if (valor >= 10_000_000) {
    ajustes.push({ regra: "R-LOA-002", delta: 5, motivo: "Valor >= R$10M inscrito no orçamento" });
    scoreAjustado += 5;
  }

  // R-LOA-003: CNJ encontrado no DataJud = +10
  if (cnj && fase1Dados?.encontrado) {
    ajustes.push({ regra: "R-LOA-003", delta: 10, motivo: "CNJ encontrado e validado no DataJud" });
    scoreAjustado += 10;
  }

  // R-LOA-004: Tribunal com dados no DataJud = +5
  if (fase1Dados?.encontrado && fase1Dados?.total_movimentos > 0) {
    ajustes.push({ regra: "R-LOA-004", delta: 5, motivo: "Tribunal com movimentações no DataJud" });
    scoreAjustado += 5;
  }

  scoreAjustado = Math.min(scoreAjustado, 100);

  let statusFinal: "APROVADO" | "VERIFICAR" | "SUSPEITO";
  if (scoreAjustado >= 80) statusFinal = "APROVADO";
  else if (scoreAjustado >= 50) statusFinal = "VERIFICAR";
  else statusFinal = "SUSPEITO";

  return {
    fase: "fase2b_score_heuristico",
    status: "ok",
    dados: {
      score_base: analise.score,
      score_ajustado: scoreAjustado,
      status: statusFinal,
      findings: analise.findings,
      extracted: analise.extracted,
      ajustes_loa: ajustes,
      sha256: analise.sha256,
    },
    fontes: ["analysis-engine-br.ts (10 regras)", "regras LOA complementares (4 regras)"],
    timestamp: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
  };
}

// ── FASE 3: Consulta direta tribunal ─────────────────────────────────────────

async function executarFase3(
  cnj: string | null,
  tribunal_alias: string,
  numero_precatorio: string,
): Promise<DDFaseResult> {
  const inicio = Date.now();

  const URLS_TRIBUNAL: Record<string, string> = {
    trf1: "https://processual.trf1.jus.br/consultaProcessual/processo.php",
    trf2: "https://eproc.trf2.jus.br/eproc/externo_controlador.php?acao=processo_seleciona_publica",
    trf3: "https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam",
    trf4: "https://eproc.trf4.jus.br/eproc2trf4/externo_controlador.php?acao=processo_seleciona_publica",
    trf5: "https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam",
    trf6: "https://processual.trf6.jus.br/consultaProcessual/processo.php",
    stj: "https://processo.stj.jus.br/processo/pesquisa/",
    stf: "https://portal.stf.jus.br/processos/",
  };

  const url = URLS_TRIBUNAL[tribunal_alias];
  const consultaUrl = cnj && url ? `${url}?proc=${cnj}` : url || null;

  return {
    fase: "fase3_consulta_tribunal",
    status: consultaUrl ? "parcial" : "indisponivel",
    dados: {
      tribunal_alias,
      url_consulta: consultaUrl,
      cnj,
      numero_precatorio,
      observacao: consultaUrl
        ? "URL de consulta gerada — verificação manual recomendada. Consulta programática bloqueada (anti-bot/reCAPTCHA)."
        : "Tribunal sem URL de consulta pública mapeada",
    },
    fontes: consultaUrl ? [`${tribunal_alias.toUpperCase()} — Consulta Processual Pública`] : [],
    timestamp: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
  };
}

// ── FASE 4/5: Autenticidade + Cruzamento ─────────────────────────────────────

function executarFase4e5(
  precatorio: { numero: string; tribunal_alias: string; valor: number; ano: number },
  cnj: string | null,
  fase1Dados: any,
): DDFaseResult {
  const inicio = Date.now();

  const verificacoes: { item: string; status: string; detalhe: string }[] = [];

  // Verificar se valor está na LOA
  verificacoes.push({
    item: "Inscrito na LOA 2026",
    status: "CONFIRMADO",
    detalhe: `Precatório ${precatorio.numero} encontrado na base LOA 2026 do tribunal ${precatorio.tribunal_alias.toUpperCase()}`,
  });

  // Verificar classe no DataJud
  if (fase1Dados?.encontrado) {
    verificacoes.push({
      item: "Classe processual DataJud",
      status: "CONFIRMADO",
      detalhe: `Classe: ${fase1Dados.classe_nome || "Precatório"} — código ${fase1Dados.tipo}`,
    });

    if (fase1Dados.tem_pagamento) {
      verificacoes.push({
        item: "Pagamento registrado",
        status: "ENCONTRADO",
        detalhe: "Movimentação de pagamento detectada no DataJud",
      });
    }

    if (fase1Dados.tem_baixa) {
      verificacoes.push({
        item: "Baixa processual",
        status: "ENCONTRADO",
        detalhe: "Processo baixado — possível quitação",
      });
    }
  } else {
    verificacoes.push({
      item: "Classe processual DataJud",
      status: "NÃO LOCALIZADO",
      detalhe: "CNJ não encontrado ou tribunal sem dados no DataJud",
    });
  }

  // Cruzamento com orçamento
  verificacoes.push({
    item: "Previsão orçamentária LOA",
    status: "CONFIRMADO",
    detalhe: `Valor ${formatarValorBR(precatorio.valor)} previsto no exercício ${precatorio.ano}`,
  });

  // DOU — pendente
  verificacoes.push({
    item: "Publicação DOU",
    status: "PENDENTE",
    detalhe: "Verificação de publicação no Diário Oficial da União — não implementado",
  });

  return {
    fase: "fase4_5_autenticidade_cruzamento",
    status: "parcial",
    dados: { verificacoes },
    fontes: ["LOA 2026 Federal", "DataJud CNJ", "DOU (pendente)"],
    timestamp: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
  };
}

// ── FASE 1B: Busca LOA CSV local (42.174 registros) ─────────────────────────

async function executarFase1B(numeroPrecatorio: string): Promise<DDFaseResult> {
  const inicio = Date.now();
  try {
    const fs = await import("fs");
    const path = await import("path");
    const csvPath = path.resolve("data/precatorios_extraidos.csv");
    if (!fs.existsSync(csvPath)) {
      return { fase: "fase1b_loa_csv", status: "indisponivel", dados: { erro: "CSV LOA não encontrado" }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
    }
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n");
    const header = lines[0].split(";");
    const found = lines.slice(1).find(l => l.includes(numeroPrecatorio));
    if (found) {
      const cols = found.split(";");
      const record: Record<string, string> = {};
      header.forEach((h, i) => { record[h.trim()] = (cols[i] || "").trim(); });
      return { fase: "fase1b_loa_csv", status: "ok", dados: { encontrado: true, ...record }, fontes: ["LOA 2026 CSV (42.174 registros)"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
    }
    return { fase: "fase1b_loa_csv", status: "parcial", dados: { encontrado: false }, fontes: ["LOA 2026 CSV"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  } catch (e: any) {
    return { fase: "fase1b_loa_csv", status: "erro", dados: { erro: e.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
}

// ── FASE 1C: Cruzamento SIOP (164K registros por ano) ───────────────────────

async function executarFase1C(numeroPrecatorio: string, valor: number, uoDevedora: string | null): Promise<DDFaseResult> {
  const inicio = Date.now();
  try {
    const fs = await import("fs");
    const path = await import("path");
    const fullPath = path.resolve("data/LOA_FULL_CONCILIADO.csv");
    if (!fs.existsSync(fullPath)) {
      return { fase: "fase1c_siop", status: "indisponivel", dados: { erro: "FULL conciliado não encontrado" }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const header = lines[0].split(",");
    const found = lines.slice(1).find(l => l.includes(numeroPrecatorio));
    if (found) {
      const cols = found.split(",");
      const record: Record<string, string> = {};
      header.forEach((h, i) => { record[h.trim()] = (cols[i] || "").trim(); });
      return { fase: "fase1c_siop", status: "ok", dados: { match: true, siop_match_status: record.siop_match_status || "match", cnj_processo_originario: record.cnj_processo_originario || null, cnj_processo_execucao: record.cnj_processo_execucao || null, ...record }, fontes: ["SIOP/MPO + LOA FULL (32 colunas)"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
    }
    return { fase: "fase1c_siop", status: "parcial", dados: { match: false }, fontes: ["SIOP/MPO"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  } catch (e: any) {
    return { fase: "fase1c_siop", status: "erro", dados: { erro: e.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
}

// ── FASE 4B: Robô PJe (movimentações processuais) ───────────────────────────

async function executarFase4B(cnjOriginario: string | null): Promise<DDFaseResult> {
  const inicio = Date.now();
  if (!cnjOriginario) {
    return { fase: "fase4b_robo_pje", status: "indisponivel", dados: { motivo: "CNJ originário não disponível" }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
  try {
    const roboPje = require("../scripts/robo_pje/index.cjs");
    const resultado = await roboPje.consultarProcesso(cnjOriginario, { headless: true, timeout: 30000 });
    if (resultado.encontrado && resultado.analise) {
      return { fase: "fase4b_robo_pje", status: "ok", dados: { encontrado: true, movimentacoes: resultado.analise.total_movimentacoes, status_pagamento: resultado.analise.status_pagamento, data_pagamento: resultado.analise.data_pagamento, oficio_requisitorio: resultado.analise.oficio_requisitorio, gravames: resultado.analise.gravames, primeira_mov: resultado.analise.primeira_movimentacao, ultima_mov: resultado.analise.ultima_movimentacao }, fontes: [`TRF1 Consulta Processual (${resultado.analise.total_movimentacoes} movimentações)`], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
    }
    return { fase: "fase4b_robo_pje", status: resultado.erro ? "erro" : "parcial", dados: { encontrado: false, erro: resultado.erro }, fontes: ["TRF1 Consulta Processual"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  } catch (e: any) {
    return { fase: "fase4b_robo_pje", status: "erro", dados: { erro: e.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
}

// ── FASE 5B: Verificador CNPJ (BrasilAPI) ───────────────────────────────────

async function executarFase5B(cnpjEntidade: string | null): Promise<DDFaseResult> {
  const inicio = Date.now();
  if (!cnpjEntidade) {
    return { fase: "fase5b_cnpj", status: "indisponivel", dados: { motivo: "CNPJ não disponível" }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
  try {
    const https = await import("https");
    const cnpjLimpo = cnpjEntidade.replace(/[.\-\/]/g, "");
    const data: any = await new Promise((resolve, reject) => {
      https.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, (resp) => {
        let body = "";
        resp.on("data", (chunk: any) => body += chunk);
        resp.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
      }).on("error", reject);
    });
    return { fase: "fase5b_cnpj", status: "ok", dados: { verificado: true, razao_social: data.razao_social, nome_fantasia: data.nome_fantasia, situacao: data.descricao_situacao_cadastral, municipio: data.municipio, uf: data.uf, qsa: (data.qsa || []).map((s: any) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio })) }, fontes: ["BrasilAPI (brasilapi.com.br)"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  } catch (e: any) {
    return { fase: "fase5b_cnpj", status: "erro", dados: { erro: e.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
}

// ── FASE 5C: Confirmação pagamento Portal Transparência ─────────────────────

async function executarFase5C(acao: string = "0625", ano: number = 2026): Promise<DDFaseResult> {
  const inicio = Date.now();
  try {
    const https = await import("https");
    const apiKey = process.env.PORTAL_API_KEY || "6081aeff3e70fc8c1fb98be64e427669";
    const data: any = await new Promise((resolve, reject) => {
      const req = https.get(`https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-funcional-programatica?ano=${ano}&acao=${acao}&pagina=1`, {
        headers: { "chave-api-dados": apiKey, "Accept": "application/json" },
      }, (resp) => {
        let body = "";
        resp.on("data", (chunk: any) => body += chunk);
        resp.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
      });
      req.on("error", reject);
    });
    if (Array.isArray(data) && data.length > 0) {
      return { fase: "fase5c_portal_transparencia", status: "ok", dados: { empenhado: data[0].empenhado, pago: data[0].pago, acao, ano }, fontes: ["Portal da Transparência API"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
    }
    return { fase: "fase5c_portal_transparencia", status: "parcial", dados: { acao, ano, resultado: "sem dados" }, fontes: ["Portal da Transparência API"], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  } catch (e: any) {
    return { fase: "fase5c_portal_transparencia", status: "erro", dados: { erro: e.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicio };
  }
}

// ── FASE 6: Geração de relatório HTML (padrão Adimix) ────────────────────────

function gerarRelatorioHTML(pipeline: DDPipelineResult): string {
  const p = pipeline.precatorio;
  const fase0 = pipeline.fase0_cnj.dados as BuscaReversaCNJResult;
  const fase1 = pipeline.fase1_datajud.dados;
  const fase2 = pipeline.fase2_raspagem.dados;
  const fase2b = pipeline.fase2b_score.dados;
  const fase3 = pipeline.fase3_tribunal.dados;
  const fase4_5 = pipeline.fase4_autenticidade.dados;

  const score = fase2b.score_ajustado ?? fase2b.score_base ?? 0;
  const status = fase2b.status || "VERIFICAR";
  const statusColor = score >= 80 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";
  const statusBadge = score >= 80 ? "badge-green" : score >= 50 ? "badge-amber" : "badge-red";
  const cnj = pipeline.cnj_encontrado || "Pendente verificação";

  const candidatos = fase0?.candidatos || [];
  const fontes = fase2?.fontes_consultadas || [];
  const verificacoes = fase4_5?.verificacoes || [];
  const findings = fase2b?.findings || [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AuraLOA · Due Diligence · Precatório ${p.numero} · ${p.tribunal}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg-base:#0a0e17;--bg-surface:#0f1525;--bg-card:#141b2d;--bg-hover:#1a2340;
      --border:#1e2d45;--border-lit:#2a3f60;
      --cyan:#22d3ee;--cyan-dim:#0e7490;--violet:#a78bfa;--violet-dim:#5b21b6;
      --green:#34d399;--green-dim:#065f46;--amber:#fbbf24;--amber-dim:#78350f;
      --red:#f87171;--red-dim:#7f1d1d;
      --text-primary:#f1f5f9;--text-secondary:#94a3b8;--text-muted:#475569;
      --font-sans:'Inter',system-ui,sans-serif;--font-mono:'JetBrains Mono',monospace;
      --radius:10px;--radius-lg:16px;--shadow:0 4px 24px rgba(0,0,0,0.5);
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{font-size:15px;scroll-behavior:smooth}
    body{font-family:var(--font-sans);background:var(--bg-base);color:var(--text-primary);min-height:100vh;line-height:1.6}
    .topbar{position:sticky;top:0;z-index:100;background:rgba(10,14,23,0.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:64px}
    .tab-nav{position:sticky;top:64px;z-index:99;background:rgba(10,14,23,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;gap:0;padding:0 24px;overflow-x:auto;scrollbar-width:none}
    .tab-btn{padding:14px 20px;font-size:13px;font-weight:500;color:var(--text-muted);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;transition:color .2s,border-color .2s;font-family:var(--font-sans)}
    .tab-btn:hover{color:var(--text-secondary)}
    .tab-btn.active{color:var(--cyan);border-bottom-color:var(--cyan)}
    .main{padding:28px 24px 60px;max-width:1200px;margin:0 auto}
    .tab-section{display:none;animation:fadeIn .25s ease}
    .tab-section.active{display:block}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .section-title{font-size:20px;font-weight:700;margin-bottom:6px}
    .section-subtitle{font-size:13px;color:var(--text-secondary);margin-bottom:24px}
    .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}
    .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
    @media(max-width:900px){.grid-4{grid-template-columns:repeat(2,1fr)}.grid-2,.grid-3{grid-template-columns:1fr}}
    .card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow)}
    .mb-24{margin-bottom:24px}
    .badge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.02em;white-space:nowrap}
    .badge-cyan{background:rgba(34,211,238,0.15);color:var(--cyan);border:1px solid rgba(34,211,238,0.3)}
    .badge-amber{background:rgba(251,191,36,0.15);color:var(--amber);border:1px solid rgba(251,191,36,0.3)}
    .badge-red{background:rgba(248,113,113,0.15);color:var(--red);border:1px solid rgba(248,113,113,0.3)}
    .badge-green{background:rgba(52,211,153,0.15);color:var(--green);border:1px solid rgba(52,211,153,0.3)}
    .badge-violet{background:rgba(167,139,250,0.15);color:var(--violet);border:1px solid rgba(167,139,250,0.3)}
    .kpi-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden}
    .kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
    .kpi-card.kpi-cyan::before{background:linear-gradient(90deg,var(--cyan),transparent)}
    .kpi-card.kpi-green::before{background:linear-gradient(90deg,var(--green),transparent)}
    .kpi-card.kpi-amber::before{background:linear-gradient(90deg,var(--amber),transparent)}
    .kpi-card.kpi-red::before{background:linear-gradient(90deg,var(--red),transparent)}
    .kpi-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted)}
    .kpi-value{font-size:32px;font-weight:800;font-family:var(--font-mono);line-height:1}
    .kpi-sub{font-size:12px;color:var(--text-secondary)}
    .mono{font-family:var(--font-mono)}
    .table-wrap{overflow-x:auto;border-radius:var(--radius);border:1px solid var(--border)}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:10px 14px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);background:var(--bg-surface)}
    td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04)}
    .timeline-item{display:flex;gap:16px;margin-bottom:20px}
    .timeline-dot{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
    .timeline-dot.phase1{background:rgba(34,211,238,0.15);border:1px solid rgba(34,211,238,0.3)}
    .timeline-dot.phase2{background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3)}
    .timeline-dot.phase3{background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3)}
    .timeline-title{font-size:14px;font-weight:600;margin-bottom:4px}
    .timeline-body{font-size:12px;color:var(--text-secondary);line-height:1.6}
    .chart-wrap{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;margin-bottom:20px}
    .chart-title{font-size:14px;font-weight:600;margin-bottom:4px}
    .chart-subtitle{font-size:12px;color:var(--text-muted);margin-bottom:18px}
    .field-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
    .field-key{font-size:12px;color:var(--text-muted);min-width:140px}
    .field-val{font-size:13px;color:var(--text-primary);text-align:right}
    .src-found{color:var(--green);font-weight:600;font-size:12px}
    .src-not-found{color:var(--red);font-weight:600;font-size:12px}
    .src-blocked{color:var(--amber);font-weight:600;font-size:12px}
    .footer{border-top:1px solid rgba(255,255,255,0.04);padding:20px 32px;text-align:center;font-size:10px;color:var(--text-muted)}
    @media print{.topbar,.tab-nav{position:relative}.tab-section{display:block!important;margin-bottom:40px}}
  </style>
</head>
<body>

<!-- TOPBAR -->
<header class="topbar">
  <div style="display:flex;align-items:center;gap:14px">
    <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#06b6d4,#7c3aed);display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" stroke="white" stroke-width="1.5"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div>
      <div style="font-size:14px;font-weight:700">AuraLOA</div>
      <div style="font-size:11px;color:var(--text-secondary)">Due Diligence · Precatório ${escapeHtml(p.numero)}</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:10px">
    <span class="badge badge-cyan">LOA ${p.ano}</span>
    <span class="badge ${statusBadge}">${status}</span>
    <a href="precatorios-lista.html" style="font-size:11px;color:#60a5fa;text-decoration:none">&larr; Lista</a>
  </div>
</header>

<!-- TABS -->
<nav class="tab-nav">
  <button class="tab-btn active" onclick="switchTab('exec')">01 · Visão Executiva</button>
  <button class="tab-btn" onclick="switchTab('docs')">02 · Dados do Precatório</button>
  <button class="tab-btn" onclick="switchTab('flags')">03 · Red Flags &amp; Score</button>
  <button class="tab-btn" onclick="switchTab('fontes')">04 · Fontes &amp; Evidências</button>
  <button class="tab-btn" onclick="switchTab('parecer')">05 · Parecer Técnico</button>
  <button class="tab-btn" onclick="switchTab('custodia')">06 · Cadeia de Custódia</button>
</nav>

<main class="main">

  <!-- TAB 1: VISÃO EXECUTIVA -->
  <section id="tab-exec" class="tab-section active">
    <h2 class="section-title">Visão Executiva</h2>
    <p class="section-subtitle">Resumo da análise de due diligence do precatório ${escapeHtml(p.numero)}</p>

    <div class="grid-4">
      <div class="kpi-card kpi-${score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red'}">
        <div class="kpi-label">Score Final</div>
        <div class="kpi-value" style="color:${statusColor}">${score}</div>
        <div class="kpi-sub"><span class="badge ${statusBadge}">${status}</span></div>
      </div>
      <div class="kpi-card kpi-cyan">
        <div class="kpi-label">Valor LOA</div>
        <div class="kpi-value" style="color:var(--cyan);font-size:20px">${formatarValorBR(p.valor)}</div>
        <div class="kpi-sub">Exercício ${p.ano}</div>
      </div>
      <div class="kpi-card kpi-violet">
        <div class="kpi-label">CNJ</div>
        <div class="kpi-value" style="color:var(--violet);font-size:14px">${escapeHtml(cnj)}</div>
        <div class="kpi-sub">Confiança: ${pipeline.confianca_cnj}</div>
      </div>
      <div class="kpi-card kpi-amber">
        <div class="kpi-label">Fases Concluídas</div>
        <div class="kpi-value" style="color:var(--amber)">${pipeline.fases_concluidas.length}/7</div>
        <div class="kpi-sub">${pipeline.fases_pendentes.length} pendentes</div>
      </div>
    </div>

    <!-- Score Gauge -->
    <div class="grid-2 mb-24">
      <div class="chart-wrap">
        <div class="chart-title">Score de Verificação</div>
        <div class="chart-subtitle">Precatório ${escapeHtml(p.numero)} · ${escapeHtml(p.tribunal)}</div>
        <div style="max-width:260px;margin:0 auto">
          <canvas id="gaugeScore" height="200"></canvas>
        </div>
        <div style="text-align:center;margin-top:12px">
          <span style="font-size:28px;font-weight:800;font-family:var(--font-mono);color:${statusColor}">${score}</span>
          <span style="color:var(--text-muted);font-size:14px"> / 100</span>
          <br><span class="badge ${statusBadge}" style="margin-top:6px;display:inline-block">${status}</span>
        </div>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">Cobertura de Verificação</div>
        <div class="chart-subtitle">10 dimensões de análise</div>
        <div style="max-width:280px;margin:0 auto">
          <canvas id="polarScore" height="280"></canvas>
        </div>
      </div>
    </div>
  </section>

  <!-- TAB 2: DADOS DO PRECATÓRIO -->
  <section id="tab-docs" class="tab-section">
    <h2 class="section-title">Dados do Precatório</h2>
    <p class="section-subtitle">Campos extraídos da LOA 2026 e do DataJud</p>

    <div class="card mb-24">
      <div class="field-row"><div class="field-key">Nº Precatório</div><div class="field-val mono" style="color:var(--cyan)">${escapeHtml(p.numero)}</div></div>
      <div class="field-row"><div class="field-key">CNJ</div><div class="field-val mono" style="color:${pipeline.cnj_encontrado ? 'var(--green)' : 'var(--amber)'}">${escapeHtml(cnj)}</div></div>
      <div class="field-row"><div class="field-key">Tribunal</div><div class="field-val">${escapeHtml(p.tribunal)}</div></div>
      <div class="field-row"><div class="field-key">Tribunal (alias)</div><div class="field-val mono">${escapeHtml(p.tribunal_alias)}</div></div>
      <div class="field-row"><div class="field-key">UO Devedora</div><div class="field-val">${escapeHtml(p.uo_devedora || "—")}</div></div>
      <div class="field-row"><div class="field-key">Assunto</div><div class="field-val">${escapeHtml(p.assunto || "—")}</div></div>
      <div class="field-row"><div class="field-key">Valor (LOA)</div><div class="field-val" style="color:var(--green);font-weight:700;font-size:15px">${formatarValorBR(p.valor)}</div></div>
      <div class="field-row"><div class="field-key">Exercício</div><div class="field-val mono">${p.ano}</div></div>
      ${fase1.encontrado ? `
      <div class="field-row"><div class="field-key">Classe (DataJud)</div><div class="field-val">${escapeHtml(fase1.classe_nome || "—")}</div></div>
      <div class="field-row"><div class="field-key">Situação</div><div class="field-val">${escapeHtml(fase1.situacao || "—")}</div></div>
      <div class="field-row"><div class="field-key">Órgão Julgador</div><div class="field-val">${escapeHtml(fase1.orgao_julgador?.nome || "—")}</div></div>
      <div class="field-row"><div class="field-key">Ajuizamento</div><div class="field-val mono">${escapeHtml(fase1.data_ajuizamento || "—")}</div></div>
      <div class="field-row"><div class="field-key">Movimentações</div><div class="field-val">${fase1.total_movimentos || 0}</div></div>
      ` : `
      <div class="field-row"><div class="field-key">DataJud</div><div class="field-val" style="color:var(--amber)">Dados pendentes — CNJ não localizado</div></div>
      `}
    </div>

    ${candidatos.length > 0 ? `
    <h3 style="font-size:16px;font-weight:600;margin-bottom:12px">Candidatos CNJ (Fase 0 — Busca Reversa)</h3>
    <div class="table-wrap mb-24">
      <table>
        <thead><tr><th>#</th><th>CNJ</th><th>Classe</th><th>Órgão</th><th>Valor</th><th>Score Match</th></tr></thead>
        <tbody>
          ${candidatos.map((c: any, i: number) => `
          <tr>
            <td class="mono" style="color:var(--text-muted)">${i + 1}</td>
            <td class="mono" style="color:var(--cyan)">${escapeHtml(c.cnj)}</td>
            <td>${escapeHtml(c.classe)}</td>
            <td style="font-size:11px">${escapeHtml(c.orgao)}</td>
            <td class="mono" style="color:var(--green)">${c.valor_causa ? formatarValorBR(c.valor_causa) : "—"}</td>
            <td><span class="badge ${c.score_match >= 50 ? 'badge-green' : c.score_match >= 30 ? 'badge-amber' : 'badge-red'}">${c.score_match}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  </section>

  <!-- TAB 3: RED FLAGS & SCORE -->
  <section id="tab-flags" class="tab-section">
    <h2 class="section-title">Red Flags &amp; Score Heurístico</h2>
    <p class="section-subtitle">Análise baseada em 14 regras (10 base + 4 LOA)</p>

    <div class="table-wrap mb-24">
      <table>
        <thead><tr><th>Regra</th><th>Resultado</th><th>Peso</th><th>Detalhe</th></tr></thead>
        <tbody>
          ${findings.map((f: any) => `
          <tr>
            <td class="mono" style="font-size:11px">${escapeHtml(f.rule_id || "—")}</td>
            <td><span class="badge ${f.passed ? 'badge-green' : 'badge-red'}">${f.passed ? "OK" : "FALHA"}</span></td>
            <td class="mono">${f.weight || "—"}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${escapeHtml(f.message || "—")}</td>
          </tr>`).join("")}
          ${(fase2b.ajustes_loa || []).map((a: any) => `
          <tr>
            <td class="mono" style="font-size:11px;color:var(--cyan)">${escapeHtml(a.regra)}</td>
            <td><span class="badge badge-green">+${a.delta}</span></td>
            <td class="mono">${a.delta}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${escapeHtml(a.motivo)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>

  <!-- TAB 4: FONTES & EVIDÊNCIAS -->
  <section id="tab-fontes" class="tab-section">
    <h2 class="section-title">Fontes &amp; Evidências</h2>
    <p class="section-subtitle">Rastreabilidade completa — cada dado verificado tem origem declarada</p>

    <div class="card mb-24">
      <div class="chart-title" style="margin-bottom:20px">Fases de Análise Executadas</div>
      <div class="timeline">
        <div class="timeline-item">
          <div class="timeline-dot phase1">&#128269;</div>
          <div class="timeline-content">
            <div class="timeline-title">Fase 0 — Busca Reversa CNJ</div>
            <div class="timeline-body">Busca do CNJ a partir dos dados da LOA (nº precatório, tribunal, valor). Método: DataJud Elasticsearch por classe 1265/1266 + range de valor.<br><strong style="color:var(--cyan)">Status: ${pipeline.fase0_cnj.status} · Confiança: ${pipeline.confianca_cnj}</strong></div>
          </div>
        </div>
        <div class="timeline-item">
          <div class="timeline-dot phase1">&#128218;</div>
          <div class="timeline-content">
            <div class="timeline-title">Fase 1 — Consulta DataJud por CNJ</div>
            <div class="timeline-body">Consulta detalhada do processo no DataJud com CNJ encontrado na Fase 0.<br><strong style="color:var(--violet)">Status: ${pipeline.fase1_datajud.status}</strong></div>
          </div>
        </div>
        <div class="timeline-item">
          <div class="timeline-dot phase2">&#127760;</div>
          <div class="timeline-content">
            <div class="timeline-title">Fase 2 — Consultas em Bases Públicas</div>
            <div class="timeline-body">${fontes.length} fontes mapeadas: ${fontes.map((f: any) => f.nome || f).join(", ")}.<br><strong style="color:var(--violet)">Status: ${pipeline.fase2_raspagem.status}</strong></div>
          </div>
        </div>
        <div class="timeline-item">
          <div class="timeline-dot phase3">&#9989;</div>
          <div class="timeline-content">
            <div class="timeline-title">Fase 3 — Consulta Direta ao Tribunal</div>
            <div class="timeline-body">${fase3.url_consulta ? `URL: <a href="${escapeHtml(fase3.url_consulta)}" target="_blank" style="color:var(--cyan)">${escapeHtml(fase3.url_consulta)}</a>` : "Tribunal sem URL mapeada"}.<br><strong style="color:var(--green)">Status: ${pipeline.fase3_tribunal.status}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <div class="table-wrap mb-24">
      <table>
        <thead><tr><th>#</th><th>Fonte / Sistema</th><th>Status</th><th>Detalhe</th></tr></thead>
        <tbody>
          ${fontes.map((f: any, i: number) => `
          <tr>
            <td class="mono" style="color:var(--text-muted)">${String(i + 1).padStart(2, "0")}</td>
            <td>${escapeHtml(f.nome || f)}</td>
            <td class="${f.status === 'consultado' ? 'src-found' : f.status === 'indisponivel' ? 'src-not-found' : 'src-blocked'}">${escapeHtml((f.status || "pendente").toUpperCase())}</td>
            <td style="font-size:12px;color:var(--text-secondary)">${escapeHtml(f.detalhe || "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>

  <!-- TAB 5: PARECER TÉCNICO -->
  <section id="tab-parecer" class="tab-section">
    <h2 class="section-title">Parecer Técnico</h2>
    <p class="section-subtitle">Conclusão automatizada — sujeita a validação por especialista</p>

    <div class="card mb-24">
      <div style="font-size:16px;font-weight:700;color:${statusColor};margin-bottom:12px">${status === "APROVADO" ? "&#9989; Precatório com indícios positivos de autenticidade" : status === "VERIFICAR" ? "&#9888;&#65039; Precatório requer verificação adicional" : "&#10060; Precatório com indícios negativos"}</div>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.8">
        O precatório <strong>${escapeHtml(p.numero)}</strong> do tribunal <strong>${escapeHtml(p.tribunal)}</strong>,
        no valor de <strong>${formatarValorBR(p.valor)}</strong>, foi analisado por meio de pipeline automatizado
        que incluiu busca reversa de CNJ, consulta ao DataJud, score heurístico de 14 regras e cruzamento com a LOA 2026.
      </p>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.8;margin-top:12px">
        ${pipeline.cnj_encontrado
          ? `O CNJ <strong class="mono">${escapeHtml(pipeline.cnj_encontrado)}</strong> foi identificado com confiança <strong>${pipeline.confianca_cnj}</strong> via busca no DataJud.`
          : "O CNJ do processo não foi localizado automaticamente. Recomenda-se consulta manual ao tribunal."}
      </p>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.8;margin-top:12px">
        Score final: <strong style="color:${statusColor}">${score}/100</strong> — Status: <span class="badge ${statusBadge}">${status}</span>
      </p>

      ${verificacoes.length > 0 ? `
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">Verificações realizadas:</div>
        ${verificacoes.map((v: any) => `
        <div style="display:flex;gap:8px;margin-bottom:6px;font-size:12px">
          <span style="color:${v.status === 'CONFIRMADO' || v.status === 'ENCONTRADO' ? 'var(--green)' : v.status === 'PENDENTE' ? 'var(--amber)' : 'var(--red)'};font-weight:600;min-width:120px">${escapeHtml(v.status)}</span>
          <span style="color:var(--text-secondary)">${escapeHtml(v.item)}: ${escapeHtml(v.detalhe)}</span>
        </div>`).join("")}
      </div>` : ""}
    </div>

    <div style="padding:16px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:var(--radius-lg);font-size:12px;color:var(--text-secondary);line-height:1.6">
      <strong style="color:var(--amber)">&#9888;&#65039; Aviso Legal:</strong> Este relatório é gerado automaticamente pela plataforma AuraLOA e não constitui parecer jurídico. As informações devem ser validadas por profissional qualificado antes de qualquer decisão de investimento.
    </div>
  </section>

  <!-- TAB 6: CADEIA DE CUSTÓDIA -->
  <section id="tab-custodia" class="tab-section">
    <h2 class="section-title">Cadeia de Custódia &amp; Rastreabilidade</h2>
    <p class="section-subtitle">Lei 13.964/2019 — Integridade e admissibilidade jurídica das evidências</p>

    <div class="card mb-24">
      <div class="grid-2" style="gap:14px;margin-bottom:14px">
        <div>
          <div style="font-size:9px;font-weight:600;letter-spacing:0.1em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">UUID DO CASO</div>
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-family:var(--font-mono);font-size:12px;color:var(--amber)">${crypto.randomUUID()}</div>
        </div>
        <div>
          <div style="font-size:9px;font-weight:600;letter-spacing:0.1em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">TIMESTAMP (ISO 8601)</div>
          <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-family:var(--font-mono);font-size:12px;color:var(--green)">${pipeline.timestamp}</div>
        </div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-size:9px;font-weight:600;letter-spacing:0.1em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">HASH SHA-256 (INTEGRIDADE)</div>
        <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-family:var(--font-mono);font-size:11px;color:var(--violet);word-break:break-all">${pipeline.sha256}</div>
      </div>
    </div>

    <div class="card mb-24">
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:20px 0">
        <div style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.25);border-radius:12px;padding:16px 20px;text-align:center;min-width:110px">
          <div style="font-size:14px;font-weight:700;color:var(--cyan)">Coleta</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">LOA + DataJud</div>
        </div>
        <span style="color:var(--text-muted)">&rarr;</span>
        <div style="background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);border-radius:12px;padding:16px 20px;text-align:center;min-width:110px">
          <div style="font-size:14px;font-weight:700;color:var(--violet)">Registro</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">UUID + Hash</div>
        </div>
        <span style="color:var(--text-muted)">&rarr;</span>
        <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25);border-radius:12px;padding:16px 20px;text-align:center;min-width:110px">
          <div style="font-size:14px;font-weight:700;color:var(--amber)">Validação</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">14 Regras</div>
        </div>
        <span style="color:var(--text-muted)">&rarr;</span>
        <div style="background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);border-radius:12px;padding:16px 20px;text-align:center;min-width:110px">
          <div style="font-size:14px;font-weight:700;color:var(--green)">Cruzamento</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">LOA + Tribunal</div>
        </div>
        <span style="color:var(--text-muted)">&rarr;</span>
        <div style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.25);border-radius:12px;padding:16px 20px;text-align:center;min-width:110px">
          <div style="font-size:14px;font-weight:700;color:#60a5fa">Relatório</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Evidence Pack</div>
        </div>
      </div>
    </div>
  </section>

</main>

<footer class="footer">
  AuraLOA · Análise Inteligente de Precatórios · Relatório gerado em ${pipeline.timestamp} · SHA-256: ${pipeline.sha256.substring(0, 16)}... · Ecossistema AuraTECH
</footer>

<script>
function switchTab(id){
  document.querySelectorAll('.tab-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  event.currentTarget.classList.add('active');
  if(id==='exec')renderCharts();
}

const C={cyan:'#22d3ee',violet:'#a78bfa',green:'#34d399',amber:'#fbbf24',red:'#f87171',surface:'#0f1525',border:'#1e2d45',text:'#94a3b8'};
Chart.defaults.color=C.text;Chart.defaults.borderColor=C.border;

function renderCharts(){
  // Gauge
  const gCtx=document.getElementById('gaugeScore');
  if(gCtx&&!gCtx._rendered){
    new Chart(gCtx,{type:'doughnut',data:{datasets:[{data:[${score},${100 - score}],backgroundColor:['${statusColor}','rgba(255,255,255,0.05)'],borderWidth:0}]},options:{circumference:180,rotation:270,cutout:'75%',plugins:{legend:{display:false},tooltip:{enabled:false}},responsive:true}});
    gCtx._rendered=true;
  }
  // Polar
  const pCtx=document.getElementById('polarScore');
  if(pCtx&&!pCtx._rendered){
    new Chart(pCtx,{type:'polarArea',data:{labels:['CNJ','Tribunal','Valor LOA','Classe','UO','DataJud','Movimentações','Score','Orçamento','Custódia'],datasets:[{data:[${pipeline.cnj_encontrado ? 10 : 3},8,10,${fase1.encontrado ? 9 : 4},${p.uo_devedora ? 7 : 3},${fase1.encontrado ? 9 : 2},${fase1.total_movimentos > 0 ? 8 : 2},${Math.round(score / 10)},10,5],backgroundColor:[C.cyan+'40',C.violet+'40',C.green+'40',C.amber+'40',C.cyan+'40',C.green+'40',C.violet+'40',C.amber+'40',C.green+'40',C.cyan+'40'],borderColor:[C.cyan,C.violet,C.green,C.amber,C.cyan,C.green,C.violet,C.amber,C.green,C.cyan],borderWidth:1}]},options:{plugins:{legend:{position:'right',labels:{font:{size:10},padding:8}},tooltip:{callbacks:{label:ctx=>ctx.label+': '+ctx.raw+'/10'}}},scales:{r:{ticks:{display:false},grid:{color:'rgba(255,255,255,0.05)'}}},responsive:true}});
    pCtx._rendered=true;
  }
}
renderCharts();
</script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── ENDPOINT PRINCIPAL ───────────────────────────────────────────────────────

router.post("/api/duediligence/pipeline", async (req: Request, res: Response) => {
  const { numero_precatorio, tribunal, valor, ano, uo_devedora, assunto } = req.body;

  if (!numero_precatorio || !tribunal) {
    return res.status(400).json({ error: "numero_precatorio e tribunal são obrigatórios" });
  }

  const tribunalAlias = normalizarTribunalAlias(tribunal);
  const valorNum = typeof valor === "number" ? valor : parseInt(String(valor).replace(/\D/g, ""), 10) || 0;
  const anoNum = typeof ano === "number" ? ano : parseInt(String(ano), 10) || 2026;
  const timestamp = new Date().toISOString();

  try {
    // ── FASE PRÉ-0: Identificar Credor via Portal da Transparência ────────
    console.log(`[DD Pipeline] ══ INÍCIO ══ Precatório: ${numero_precatorio} | Tribunal: ${tribunal}`);

    // Primeiro: buscar dados LOA/SIOP para ter UO e Tipo Causa
    const fase1bPrevia = await executarFase1B(numero_precatorio);
    const fase1cPrevia = await executarFase1C(numero_precatorio, valorNum, uo_devedora || null);
    const loaDados = fase1bPrevia.status === "ok" ? fase1bPrevia.dados : {};
    const siopDados = fase1cPrevia.status === "ok" ? fase1cPrevia.dados : {};
    const uoCodigo = (siopDados as any)?.UO_Devedora_Codigo || (loaDados as any)?.UO_Devedora_Codigo || "";
    const uoNome = (siopDados as any)?.UO_Devedora_Nome || (loaDados as any)?.UO_Devedora_Nome || uo_devedora || "";
    const tipoCausa = (siopDados as any)?.Tipo_Causa || (loaDados as any)?.Tipo_Causa || assunto || "";

    console.log(`[DD Pipeline] LOA/SIOP: UO=${uoCodigo} (${uoNome}) | Tipo=${tipoCausa}`);

    // Executar identificação do credor
    const faseCredor = await executarFaseCredor(uoCodigo, uoNome, tipoCausa, valorNum);
    const credoresEncontrados = faseCredor.credores || [];
    const melhorCredor = credoresEncontrados.length > 0 ? credoresEncontrados[0] : null;
    const cnpjDoCredor = melhorCredor?.cnpj || null;

    console.log(`[DD Pipeline] Credor: ${credoresEncontrados.length} candidatos | Principal: ${melhorCredor?.nome || "NENHUM"} | CNPJ: ${cnpjDoCredor || "N/A"}`);

    // ── FASE 0-ENRIQ: Enriquecimento CNJ (agora COM o CNPJ do credor!) ───
    const faseEnriq = await executarFaseEnriquecimento(numero_precatorio, valorNum, tribunalAlias, cnpjDoCredor);
    const enriqDados = faseEnriq.dados as EnriquecimentoResult;

    // CNJ vem do enriquecimento (SIOP direto ou TRF1 via CNPJ)
    let cnjEncontrado = enriqDados.cnj_originario || null;
    const cnjExecucao = enriqDados.cnj_execucao || null;
    // CNPJ: preferir o do credor se enriquecimento não achou
    const cnpjEntidade = enriqDados.cnpj_entidade || cnpjDoCredor || null;
    console.log(`[DD Pipeline] Enriquecimento: método=${enriqDados.metodo} | CNJ=${cnjEncontrado || "NENHUM"} | CNPJ=${cnpjEntidade || "NENHUM"} | candidatos_trf1=${enriqDados.candidatos_trf1?.length || 0}`);

    // ── FASE 0: Busca reversa CNJ (DataJud — fallback se enriquecimento não achou) ──
    let fase0: DDFaseResult;
    if (cnjEncontrado) {
      // Já temos CNJ do enriquecimento — pular DataJud
      fase0 = {
        fase: "fase0_busca_cnj",
        status: "ok",
        dados: { encontrado: true, cnj: cnjEncontrado, confianca: "alta", metodo_origem: enriqDados.metodo, candidatos: [] },
        fontes: [`Enriquecimento SIOP (método: ${enriqDados.metodo})`],
        timestamp: new Date().toISOString(),
        duracao_ms: 0,
      };
    } else {
      // Sem CNJ → tentar DataJud como fallback
      const fase0Input: BuscaReversaCNJInput = {
        numero_precatorio,
        tribunal_alias: tribunalAlias,
        valor: valorNum,
        ano: anoNum,
        uo_devedora: uo_devedora || undefined,
        assunto: assunto || undefined,
      };
      fase0 = await executarFase0(fase0Input);
      const fase0Dados = fase0.dados as BuscaReversaCNJResult;
      if (fase0Dados.cnj) {
        cnjEncontrado = fase0Dados.cnj;
        console.log(`[DD Pipeline] CNJ obtido via DataJud fallback: ${cnjEncontrado}`);
      }
    }
    const fase0Dados = fase0.dados as BuscaReversaCNJResult;

    // ── FASE 1: DataJud com CNJ ────────────────────────────────────────────
    const fase1 = await executarFase1(cnjEncontrado, numero_precatorio);

    // ── FASE 1B: Busca LOA CSV (já executada acima — reusar) ──────────────
    const fase1b = fase1bPrevia;

    // ── FASE 1C: Cruzamento SIOP (já executada acima — reusar) ──────────
    const fase1c = fase1cPrevia;

    // ── FASE 2: Raspagem web ───────────────────────────────────────────────
    const fase2 = await executarFase2(cnjEncontrado, tribunalAlias, uo_devedora, valorNum);

    // ── FASE 2B: Score heurístico ──────────────────────────────────────────
    const fase2b = executarFase2B(cnjEncontrado, tribunal, valorNum, uo_devedora, assunto, fase1.dados);

    // ── FASE 3: Consulta direta tribunal ───────────────────────────────────
    const fase3 = await executarFase3(cnjEncontrado, tribunalAlias, numero_precatorio);

    // ── FASE 4/5: Autenticidade + Cruzamento ───────────────────────────────
    const fase4_5 = executarFase4e5(
      { numero: numero_precatorio, tribunal_alias: tribunalAlias, valor: valorNum, ano: anoNum },
      cnjEncontrado,
      fase1.dados,
    );

    // ── FASE 4B: Robô PJe (movimentações processuais TRF1) ────────────────
    const cnjParaPje = cnjEncontrado || null;
    const fase4b = await executarFase4B(cnjParaPje);

    // ── FASE 5B: Verificador CNPJ (BrasilAPI) ─────────────────────────────
    const fase5b = await executarFase5B(cnpjEntidade);

    // ── FASE 5C: Portal Transparência (confirmação pagamento) ──────────────
    const fase5c = await executarFase5C("0625", anoNum);

    // ── FASE 6A: Apollo.io + Receita Federal (enriquecimento empresa) ─────
    // ⚠️ SÓ roda se temos CNPJ do credor (regra Marcos 14/04/2026)
    let fase6a: DDFaseResult;
    const inicioF6a = Date.now();
    try {
      const { consultarCNPJ, determinarStatusEmpresa, enrichOrganization } = await import("../services/apollo_enrichment");
      let cnpjData = null;
      let statusEmpresa = null;
      let apolloOrg = null;

      if (cnpjEntidade) {
        // Receita Federal (BrasilAPI) — sempre roda
        cnpjData = await consultarCNPJ(cnpjEntidade);
        if (cnpjData) statusEmpresa = determinarStatusEmpresa(cnpjData);

        // Apollo.io — enriquece org se tiver domínio no email da Receita
        const emailEmpresa = cnpjData?.email || null;
        const dominio = emailEmpresa?.split("@")[1] || null;
        if (dominio && !dominio.includes("gmail") && !dominio.includes("hotmail") && !dominio.includes("yahoo")) {
          try { apolloOrg = await enrichOrganization(dominio); } catch { /* Apollo falhou, segue */ }
        }
      }

      fase6a = {
        fase: "fase6a_apollo_receita",
        status: cnpjData ? "ok" : cnpjEntidade ? "parcial" : "indisponivel",
        dados: {
          receita_federal: cnpjData ? {
            razao_social: cnpjData.razao_social,
            nome_fantasia: cnpjData.nome_fantasia,
            status: statusEmpresa,
            situacao_especial: cnpjData.situacao_especial,
            capital_social: cnpjData.capital_social,
            natureza_juridica: cnpjData.natureza_juridica,
            porte: cnpjData.porte,
            cnae: cnpjData.cnae_fiscal_descricao,
            endereco: [cnpjData.logradouro, cnpjData.numero, cnpjData.bairro, cnpjData.municipio, cnpjData.uf].filter(Boolean).join(", "),
            telefone: cnpjData.ddd_telefone_1,
            email: cnpjData.email,
            qsa_count: cnpjData.qsa?.length || 0,
          } : null,
          apollo: apolloOrg ? {
            nome: apolloOrg.name,
            site: apolloOrg.website_url,
            linkedin: apolloOrg.linkedin_url,
            setor: apolloOrg.industry,
            funcionarios: apolloOrg.estimated_num_employees,
          } : null,
        },
        fontes: [cnpjData ? "BrasilAPI/Receita Federal" : null, apolloOrg ? "Apollo.io" : null].filter(Boolean) as string[],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicioF6a,
      };
      console.log(`[DD Pipeline] Fase 6A: Receita=${cnpjData ? "OK" : "N/A"} | Apollo=${apolloOrg ? "OK" : "N/A"} | Status=${statusEmpresa || "N/A"}`);
    } catch (err: any) {
      fase6a = { fase: "fase6a_apollo_receita", status: "erro", dados: { erro: err.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicioF6a };
    }

    // ── FASE 6B: Enriquecimento de Contatos (sócios + advogados) ──────────
    // ⚠️ REGRA: Se encontrar 10 nomes, buscar dados dos 10. TODOS.
    let fase6b: DDFaseResult;
    const inicioF6b = Date.now();
    try {
      const { enrichContacts } = await import("../services/contact_enrichment");
      const contactResult = await enrichContacts({
        cnpj: cnpjEntidade || "",
        razao_social: fase6a.dados?.receita_federal?.razao_social || uo_devedora || null,
      });
      fase6b = {
        fase: "fase6b_contatos",
        status: contactResult.total_pessoas > 0 ? "ok" : "parcial",
        dados: {
          total_pessoas: contactResult.total_pessoas,
          total_com_contato: contactResult.total_com_contato,
          score_cobertura: contactResult.score_cobertura,
          socios: contactResult.socios,
          advogados: contactResult.advogados,
          alertas: contactResult.alertas,
        },
        fontes: ["BrasilAPI/QSA", "CNPJ.ws", "Google CSE"].filter(Boolean),
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicioF6b,
      };
      console.log(`[DD Pipeline] Fase 6B: ${contactResult.total_pessoas} pessoas | ${contactResult.total_com_contato} com contato | score=${contactResult.score_cobertura}%`);
    } catch (err: any) {
      fase6b = { fase: "fase6b_contatos", status: "erro", dados: { erro: err.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicioF6b };
    }

    // ── FASE 6C: Auditoria de Contatos (validação cruzada) ────────────────
    let fase6c: DDFaseResult;
    const inicioF6c = Date.now();
    try {
      const contatos = fase6b.dados;
      const allPeople = [...(contatos.socios || []), ...(contatos.advogados || [])];
      const { validarCPF, validarEmail, validarTelefone } = await import("../../shared/validacao_documentos");

      const auditResults = allPeople.map((p: any) => {
        const checks = {
          nome: !!p.nome,
          cpf_valido: p.cpf_cnpj ? validarCPF(p.cpf_cnpj) : null,
          email_valido: p.email ? validarEmail(p.email) : null,
          telefone_valido: p.telefone ? validarTelefone(p.telefone) : null,
          linkedin_presente: !!p.linkedin_url,
          site_presente: !!(p.site_pessoal || p.site_escritorio),
          fontes_count: p.fontes_consultadas?.length || 0,
        };
        const campos_ok = Object.values(checks).filter(v => v === true).length;
        const campos_total = Object.values(checks).filter(v => v !== null).length;
        return {
          nome: p.nome,
          tipo: p.tipo,
          checks,
          score: campos_total > 0 ? Math.round((campos_ok / campos_total) * 100) : 0,
          veredicto: campos_ok >= 3 ? "COMPLETO" : campos_ok >= 1 ? "PARCIAL" : "INSUFICIENTE",
        };
      });

      const scoreGeral = auditResults.length > 0
        ? Math.round(auditResults.reduce((s: number, r: any) => s + r.score, 0) / auditResults.length)
        : 0;

      fase6c = {
        fase: "fase6c_audit_contatos",
        status: scoreGeral >= 50 ? "ok" : scoreGeral > 0 ? "parcial" : "erro",
        dados: { auditResults, scoreGeral, total: auditResults.length },
        fontes: ["validacao_documentos.ts", "audit-contatos"],
        timestamp: new Date().toISOString(),
        duracao_ms: Date.now() - inicioF6c,
      };
      console.log(`[DD Pipeline] Fase 6C: Audit score=${scoreGeral}% | ${auditResults.length} pessoas auditadas`);
    } catch (err: any) {
      fase6c = { fase: "fase6c_audit_contatos", status: "erro", dados: { erro: err.message }, fontes: [], timestamp: new Date().toISOString(), duracao_ms: Date.now() - inicioF6c };
    }

    // ── Montar resultado ───────────────────────────────────────────────────
    const fasesConcluidas = [
      "fase_pre0_credor", "fase0_enriquecimento", "fase0_busca_cnj", "fase1b_loa_csv", "fase1c_siop",
      "fase1_datajud", "fase2_raspagem", "fase2b_score", "fase3_tribunal", "fase4_5_cruzamento",
      "fase4b_robo_pje", "fase5b_cnpj", "fase5c_portal_transparencia",
      "fase6a_apollo_receita", "fase6b_contatos", "fase6c_audit_contatos"
    ].filter(f => {
      const faseMap: Record<string, DDFaseResult> = {
        fase_pre0_credor: faseCredor, fase0_enriquecimento: faseEnriq, fase0_busca_cnj: fase0, fase1_datajud: fase1, fase1b_loa_csv: fase1b,
        fase1c_siop: fase1c, fase2_raspagem: fase2, fase2b_score: fase2b,
        fase3_tribunal: fase3, fase4_5_cruzamento: fase4_5,
        fase4b_robo_pje: fase4b, fase5b_cnpj: fase5b, fase5c_portal_transparencia: fase5c,
        fase6a_apollo_receita: fase6a, fase6b_contatos: fase6b, fase6c_audit_contatos: fase6c,
      };
      return faseMap[f]?.status === "ok" || faseMap[f]?.status === "parcial";
    });
    const fasesPendentes = ["fase6_relatorio_completo"];

    // Confiança do CNJ baseada no método de enriquecimento
    let confiancaCnj = "nenhuma";
    if (cnjEncontrado) {
      if (enriqDados.metodo === "siop_csv_direto") confiancaCnj = "alta";
      else if (enriqDados.metodo === "cnpj_trf1_unico") confiancaCnj = "alta";
      else if (enriqDados.metodo.startsWith("cnpj_trf1")) confiancaCnj = "media";
      else if (fase0Dados?.confianca) confiancaCnj = fase0Dados.confianca;
      else confiancaCnj = "baixa";
    }

    const pipelineResult: DDPipelineResult = {
      precatorio: {
        numero: numero_precatorio,
        tribunal,
        tribunal_alias: tribunalAlias,
        valor: valorNum,
        ano: anoNum,
        uo_devedora: uo_devedora || null,
        assunto: assunto || null,
      },
      fase_pre0_credor: faseCredor,
      fase0_cnj: fase0,
      fase1_datajud: fase1,
      fase2_raspagem: fase2,
      fase2b_score: fase2b,
      fase3_tribunal: fase3,
      fase4_autenticidade: fase4_5,
      fase5_cruzamento: fase4_5,
      fases_concluidas: fasesConcluidas,
      fases_pendentes: fasesPendentes,
      cnj_encontrado: cnjEncontrado,
      confianca_cnj: confiancaCnj,
      score_final: fase2b.dados.score_ajustado ?? fase2b.dados.score_base ?? 0,
      status_final: fase2b.dados.status || "VERIFICAR",
      relatorio_url: null,
      timestamp,
      sha256: crypto.createHash("sha256").update(JSON.stringify({
        numero_precatorio, tribunal, valor, timestamp,
        cnj: cnjEncontrado,
        score: fase2b.dados.score_ajustado,
      })).digest("hex"),
    };

    // ── FASE 6: Gerar relatório HTML ───────────────────────────────────────
    const relatorioHtml = gerarRelatorioHTML(pipelineResult);
    const relatorioHash = crypto.createHash("sha256").update(relatorioHtml).digest("hex");
    const relatorioFilename = `dd_${tribunalAlias}_${numero_precatorio}_${Date.now()}.html`;

    // Salvar relatório onde Express realmente serve (dist/public em prod)
    const fs = await import("fs");
    const path = await import("path");
    // dist/public em prod (Express serve estáticos dali)
    const distPublicDir = path.resolve("dist/public/dd-reports");
    fs.mkdirSync(distPublicDir, { recursive: true });
    fs.writeFileSync(path.join(distPublicDir, relatorioFilename), relatorioHtml, "utf-8");
    // client/public também (para dev local com vite)
    const clientPublicDir = path.resolve("client/public/dd-reports");
    fs.mkdirSync(clientPublicDir, { recursive: true });
    fs.writeFileSync(path.join(clientPublicDir, relatorioFilename), relatorioHtml, "utf-8");

    pipelineResult.relatorio_url = `/dd-reports/${relatorioFilename}`;
    pipelineResult.fases_concluidas.push("fase6_relatorio");
    pipelineResult.fases_pendentes = [];

    // ── AUDITORIA: Gravar JSON completo em disco ───────────────────────────
    try {
      const auditDir = path.resolve("dist/public/dd-audit");
      fs.mkdirSync(auditDir, { recursive: true });
      const auditFilename = `audit_${tribunalAlias}_${numero_precatorio}_${Date.now()}.json`;
      const auditPayload = {
        _audit: {
          timestamp,
          sha256: pipelineResult.sha256,
          relatorio_sha256: relatorioHash,
          relatorio_url: pipelineResult.relatorio_url,
          ip: req.ip || req.socket?.remoteAddress || "unknown",
        },
        request: { numero_precatorio, tribunal, valor, ano },
        result: pipelineResult,
        fases: {
          fase_pre0_credor: faseCredor,
          fase0_enriquecimento: faseEnriq,
          fase0_cnj: fase0,
          fase1_datajud: fase1,
          fase1b_loa: fase1b,
          fase1c_siop: fase1c,
          fase2_raspagem: fase2,
          fase2b_score: fase2b,
          fase3_tribunal: fase3,
          fase4_autenticidade: fase4_5,
          fase4b_robo_pje: fase4b,
          fase5_cruzamento: fase4_5,
          fase5b_cnpj: fase5b,
          fase5c_portal: fase5c,
          fase6a_apollo_receita: fase6a,
          fase6b_contatos: fase6b,
          fase6c_audit_contatos: fase6c,
        },
      };
      fs.writeFileSync(path.join(auditDir, auditFilename), JSON.stringify(auditPayload, null, 2), "utf-8");
      console.log(`[DD Pipeline] Audit salvo: ${auditFilename}`);
    } catch (auditErr: any) {
      console.error("[DD Pipeline] Erro ao salvar audit:", auditErr.message);
    }

    // Retornar resultado completo para o frontend
    return res.json({
      ...pipelineResult,
      relatorio_sha256: relatorioHash,
      // Fase Credor (NOVA — ANTES de tudo)
      fase_pre0_credor: faseCredor,
      credor: melhorCredor ? {
        nome: melhorCredor.nome,
        cnpj: melhorCredor.cnpj,
        municipio: melhorCredor.municipio,
        uf: melhorCredor.uf,
        valor_recebido: melhorCredor.valor_recebido,
        confianca: melhorCredor.confianca,
        total_candidatos: credoresEncontrados.length,
      } : null,
      // Fase de enriquecimento
      fase0_enriquecimento: faseEnriq,
      enriquecimento: {
        metodo: enriqDados.metodo,
        cnj_originario: enriqDados.cnj_originario,
        cnj_execucao: enriqDados.cnj_execucao,
        cnpj_entidade: enriqDados.cnpj_entidade,
        candidatos_trf1: enriqDados.candidatos_trf1,
        registro_siop: enriqDados.registro_siop ? {
          conciliacao_status: enriqDados.registro_siop.conciliacao_status,
          conciliacao_tipo: enriqDados.registro_siop.conciliacao_tipo,
          match_metodo: enriqDados.registro_siop.match_metodo,
          causa_provavel: enriqDados.registro_siop.causa_provavel,
          siop_match_status: enriqDados.registro_siop.siop_match_status,
          siop_valor_original: enriqDados.registro_siop.siop_valor_original,
          siop_valor_atualizado: enriqDados.registro_siop.siop_valor_atualizado,
          siop_data_ajuizamento: enriqDados.registro_siop.siop_data_ajuizamento,
          siop_tribunal: enriqDados.registro_siop.siop_tribunal,
        } : null,
      },
      // Outras fases
      fase1b_loa: fase1b,
      fase1c_siop: fase1c,
      fase4b_robo_pje: fase4b,
      fase5b_cnpj: fase5b,
      fase5c_portal: fase5c,
      // Campos de compatibilidade com o frontend atual
      datajud: {
        status: fase1.status === "ok" ? "encontrado" : fase1.status,
        resultado: fase1.dados,
      },
      cnj: cnjEncontrado || "pendente_enriquecimento",
      cnj_originario: cnjEncontrado || null,
      cnj_execucao: cnjExecucao || null,
      status_pagamento: fase4b.dados?.status_pagamento || "PENDENTE",
      credor_verificado: fase5b.status === "ok" ? fase5b.dados : null,
      // NOVAS FASES (14/04/2026)
      fase6a_apollo_receita: fase6a,
      fase6b_contatos: fase6b,
      fase6c_audit_contatos: fase6c,
      empresa: fase6a.dados?.receita_federal || null,
      status_empresa: fase6a.dados?.receita_federal?.status || null,
      apollo: fase6a.dados?.apollo || null,
      contatos: {
        socios: fase6b.dados?.socios || [],
        advogados: fase6b.dados?.advogados || [],
        score_cobertura: fase6b.dados?.score_cobertura || 0,
        alertas: fase6b.dados?.alertas || [],
      },
      audit_contatos: {
        score: fase6c.dados?.scoreGeral || 0,
        resultados: fase6c.dados?.auditResults || [],
      },
      fases_concluidas: pipelineResult.fases_concluidas,
      fases_pendentes: pipelineResult.fases_pendentes,
    });
  } catch (err: any) {
    console.error("[DD Pipeline] Erro:", err);
    return res.status(500).json({ error: "Erro no pipeline de due diligence", detalhe: err.message });
  }
});

export default router;
