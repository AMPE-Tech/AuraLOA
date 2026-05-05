import crypto from "crypto";
import fs from "fs";
import path from "path";
import { generateTraceId, generateHash } from "./ai";
import { enriquecerDocumento, type Enriquecimento } from "./enriquecer-processo";
import { searchDatajud, isDatajudConfigured } from "./datajud-client";
import { executarRaspagemComplementar } from "./raspagem-complementar";
import { rasparPortalTRF, rasparDiarioOficial, rasparCessoesDEPRE } from "./firecrawl-client";
import { buscarDOU, buscarQueridoDiario, isDouDirectConfigured } from "./dou-client";
import { validateCpf, validateCnpj } from "./brasil-api";
import { queryTribunalPublic, type TribunalQueryResult } from "./tribunais/consulta-publica";
import { buildTribunalRequest, getTribunalProfileOrThrow, TRIBUNAL_PROFILES, type TribunalProfile } from "./tribunais/adapters";
import { getRegistryEntryByCode, assertN8Compliance, getActiveRegistryByPriority } from "./tribunais/registry";
import {
  type FonteOficialResult,
  type FonteStatus,
  sha256OfString,
  nowIsoUTC,
  registerFonteResultOrThrow,
  markFonte,
} from "../contracts/canonicalDD";

export interface DiagnosticoEtapa {
  id: string;
  titulo: string;
  status: "pendente" | "em_andamento" | "concluido" | "erro";
  descricao: string;
  inicio?: Date;
  fim?: Date;
  dados?: any;
  erro?: string;
}

export interface RegistroFonteCustodia {
  seq: number;
  fonte_id: string;
  fonte_nome: string;
  tipo: "OFICIAL" | "NAO_OFICIAL" | "INSUMO";
  status: "OK" | "PARTIAL" | "FAIL" | "NAO_CONSULTADO";
  timestamp_utc: string;
  url_endpoint: string;
  http_status: number | null;
  hash_sha256: string;
  bytes_recebidos: number;
  campos_obtidos: string[];
  amostra_conteudo: string;
  artefato_path: string | null;
  motivo_falha: string | null;
}

export interface CadeiaCustodia {
  trace_id: string;
  operador_user_id: string;
  processo_id: string;
  timestamp_inicio: string;
  timestamp_fim: string;
  hash_integridade: string;
  total_fontes_consultadas: number;
  total_fontes_ok: number;
  total_fontes_fail: number;
  total_fontes_nao_consultadas: number;
  fontes_consultadas: RegistroFonteCustodia[];
  fontes_nao_consultadas: RegistroFonteCustodia[];
  artefatos_preservados: { arquivo: string; hash: string; bytes: number }[];
  versao_cadeia: string;
}

export interface DiagnosticoResult {
  trace_id: string;
  processo_id: string;
  status: "concluido" | "parcial" | "erro";
  etapas: DiagnosticoEtapa[];
  enriquecimento: Enriquecimento | null;
  fontes_oficiais: FonteOficial[];
  matriz_completude: MatrizCompletude;
  dados_complementares: any;
  hash_final: string;
  cadeia_custodia: CadeiaCustodia;
}

export interface FonteOficial {
  nome: string;
  tipo: "DATAJUD" | "TRIBUNAL" | "DIARIO_OFICIAL" | "RASPAGEM_WEB" | "BRASILAPI" | "DEPRE";
  status: "ok" | "erro" | "indisponivel" | "nao_consultado";
  is_official: boolean;
  dados?: any;
  observacoes?: string;
  consultado_em?: string;
  endpoint?: string;
  hash_evidencia?: string;
  bytes_resposta?: number;
  campos_extraidos?: string[];
}

export interface MatrizCompletude {
  total_campos: number;
  campos_preenchidos: number;
  percentual: number;
  campos_faltantes: string[];
  campos_criticos_faltantes: string[];
}

const CAMPOS_OBRIGATORIOS_CRITICOS = [
  "processo.numero_cnj",
  "tribunal",
  "credor.nome",
  "credor.cpf_cnpj",
  "devedor.nome",
  "devedor.ente_publico",
  "valores.valor_total_requisicao",
  "processo.natureza_credito",
  "datas_importantes.data_transito_julgado",
  "numero_precatorio",
];

const CAMPOS_OBRIGATORIOS = [
  // === RAIZ (identificacao do documento) ===
  "tipo_documento.categoria",
  "tipo_documento.descricao",
  "tipo_documento.confianca",
  "numero_precatorio",
  "numero_oficio",
  "tribunal",
  "comarca",
  "vara_secao",
  "data_emissao",
  "tipo_requisicao",

  // === PROCESSO (dados processuais) ===
  "processo.numero_cnj",
  "processo.numero_processo_execucao",
  "processo.natureza_credito",
  "processo.assunto",
  "processo.acao_originaria",
  "processo.embargos_execucao",
  "processo.tributario",
  "processo.classe_processual",
  "processo.grau_jurisdicao",
  "processo.fase_processual",
  "processo.origem_credito",

  // === CREDOR (beneficiario) ===
  "credor.nome",
  "credor.cpf_cnpj",
  "credor.tipo_beneficiario",
  "credor.prioridade_legal",
  "credor.telefone_contato",

  // === DEVEDOR (ente publico) ===
  "devedor.nome",
  "devedor.cnpj",
  "devedor.ente_publico",
  "devedor.esfera",

  // === VALORES (liquidacao financeira) ===
  "valores.valor_principal",
  "valores.valor_juros",
  "valores.valor_correcao_monetaria",
  "valores.valor_total_requisicao",
  "valores.valor_liquido",
  "valores.indice_correcao",
  "valores.data_base",
  "valores.valor_honorarios_contratuais",
  "valores.valor_honorarios_sucumbenciais",
  "valores.incide_ir",
  "valores.incide_previdencia",

  // === HONORARIOS ===
  "honorarios.existe",
  "honorarios.advogado_nome",
  "honorarios.advogado_cpf",
  "honorarios.advogado_oab",
  "honorarios.percentual",
  "honorarios.valor_reserva",
  "honorarios.forma_pagamento",

  // === DATAS IMPORTANTES ===
  "datas_importantes.data_ajuizamento",
  "datas_importantes.data_sentenca",
  "datas_importantes.data_transito_julgado",
  "datas_importantes.data_decurso_prazo",
  "datas_importantes.data_limite_constitucional",

  // === SUPERPREFERENCIA ===
  "superpreferencia.superpreferencial",
  "superpreferencia.doente_grave",
  "superpreferencia.pessoa_deficiente",
  "superpreferencia.data_nascimento_beneficiario",

  // === TIPO REQUISICAO DETALHE ===
  "tipo_requisicao_detalhe.tipo",
  "tipo_requisicao_detalhe.superpreferencial",
  "tipo_requisicao_detalhe.ordem_cronologica",
  "tipo_requisicao_detalhe.ano_orcamentario_loa",

  // === METADADOS VISUAIS ===
  "metadados_visuais.tem_carimbo",
  "metadados_visuais.tem_assinatura_juiz",
  "metadados_visuais.nome_juiz",
];

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((curr, key) => curr?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

interface FonteDadosCampo {
  [campo: string]: "DOCUMENTO" | "DATAJUD" | "TRIBUNAL" | "FIRECRAWL" | "BRASILAPI" | "ESCAVADOR" | "DIARIO_OFICIAL" | "DEPRE" | "CALCULO" | "INFERENCIA_IA";
}

function mergeDatajudIntoEnriquecimento(
  enriquecimento: Enriquecimento,
  datajudResult: any,
  fonteDados: FonteDadosCampo
): { camposMergeados: string[] } {
  const camposMergeados: string[] = [];
  const proc = datajudResult.processo;
  if (!proc) return { camposMergeados };

  const mappings: Array<{ campo: string; valor: any }> = [
    { campo: "processo.classe_processual", valor: proc.classe },
    { campo: "processo.grau_jurisdicao", valor: proc.grau },
    { campo: "processo.assunto", valor: Array.isArray(proc.assuntos) && proc.assuntos.length > 0 ? proc.assuntos.map((a: any) => typeof a === "string" ? a : a.nome || a.descricao || JSON.stringify(a)).join("; ") : null },
    { campo: "datas_importantes.data_ajuizamento", valor: proc.data_ajuizamento },
    { campo: "tribunal", valor: proc.tribunal },
  ];

  if (datajudResult.movimentos?.length > 0) {
    const movs = datajudResult.movimentos;
    const transitoMov = movs.find((m: any) => {
      const txt = ((m.evento || "") + " " + (m.complementos || "")).toLowerCase();
      return txt.includes("trânsito em julgado") || txt.includes("transito em julgado") || txt.includes("transitado");
    });
    if (transitoMov?.data) {
      mappings.push({ campo: "datas_importantes.data_transito_julgado", valor: transitoMov.data });
    }

    const sentencaMov = movs.find((m: any) => {
      const txt = ((m.evento || "") + " " + (m.complementos || "")).toLowerCase();
      return txt.includes("sentença") || txt.includes("sentenca") || txt.includes("julgamento");
    });
    if (sentencaMov?.data) {
      mappings.push({ campo: "datas_importantes.data_sentenca", valor: sentencaMov.data });
    }

    const naturezaTexto = movs.slice(0, 30).map((m: any) => ((m.evento || "") + " " + (m.complementos || "")).toLowerCase()).join(" ");
    if (!getNestedValue(enriquecimento, "processo.natureza_credito")) {
      if (naturezaTexto.includes("alimentar") || naturezaTexto.includes("alimentícia")) {
        mappings.push({ campo: "processo.natureza_credito", valor: "ALIMENTAR" });
      } else if (naturezaTexto.includes("tributár") || naturezaTexto.includes("tributar")) {
        mappings.push({ campo: "processo.natureza_credito", valor: "TRIBUTARIO" });
      } else if (naturezaTexto.includes("comum") || naturezaTexto.includes("não alimentar")) {
        mappings.push({ campo: "processo.natureza_credito", valor: "COMUM" });
      }
    }

    if (!getNestedValue(enriquecimento, "processo.fase_processual")) {
      const baixado = naturezaTexto.includes("baixa") || naturezaTexto.includes("arquiv");
      mappings.push({ campo: "processo.fase_processual", valor: baixado ? "ARQUIVADO" : "EM_TRAMITACAO" });
    }
  }

  if (proc.vara && !getNestedValue(enriquecimento, "vara_secao")) {
    mappings.push({ campo: "vara_secao", valor: proc.vara });
  }

  for (const { campo, valor } of mappings) {
    if (valor === null || valor === undefined || valor === "") continue;
    const current = getNestedValue(enriquecimento, campo);
    if (current === null || current === undefined || current === "") {
      setNestedValue(enriquecimento, campo, valor);
      fonteDados[campo] = "DATAJUD";
      camposMergeados.push(campo);
    }
  }

  return { camposMergeados };
}

function mergeRaspagemIntoEnriquecimento(
  enriquecimento: Enriquecimento,
  raspagemData: Record<string, unknown>,
  fonteDados: FonteDadosCampo
): { camposMergeados: string[] } {
  const camposMergeados: string[] = [];

  const mappings: Array<{ campo: string; valor: any }> = [
    { campo: "datas_importantes.data_transito_julgado", valor: raspagemData.transito_em_julgado },
    { campo: "processo.fase_processual", valor: raspagemData.status_processo },
    { campo: "credor.telefone_contato", valor: raspagemData.telefone_cedente },
  ];

  if (raspagemData.expedicao && !getNestedValue(enriquecimento, "data_emissao")) {
    mappings.push({ campo: "data_emissao", valor: raspagemData.expedicao });
  }

  for (const { campo, valor } of mappings) {
    if (valor === null || valor === undefined || valor === "") continue;
    const current = getNestedValue(enriquecimento, campo);
    if (current === null || current === undefined || current === "") {
      setNestedValue(enriquecimento, campo, valor);
      fonteDados[campo] = "FIRECRAWL";
      camposMergeados.push(campo);
    }
  }

  return { camposMergeados };
}

/** TRAVA ANTI-ALUCINACAO CASCATA: Valida dados mergeados de fontes externas antes de persistir */
function assertAntiHallucinationCascata(
  enriquecimento: Enriquecimento,
  fonteDados: FonteDadosCampo,
  trace_id: string
): string[] {
  const alertas: string[] = [];

  const valoresFinanceiros = [
    "valores.valor_principal",
    "valores.valor_juros",
    "valores.valor_correcao_monetaria",
    "valores.valor_total_requisicao",
    "valores.valor_liquido",
    "valores.valor_honorarios_contratuais",
    "valores.valor_honorarios_sucumbenciais",
  ];
  for (const campo of valoresFinanceiros) {
    const fonte = fonteDados[campo];
    if (fonte && fonte !== "DOCUMENTO" && fonte !== "CALCULO") {
      const val = getNestedValue(enriquecimento, campo);
      if (val !== null && val !== undefined) {
        alertas.push(`[ANTI-HALLUCINATION] Campo financeiro '${campo}' preenchido por fonte '${fonte}' (somente DOCUMENTO/CALCULO permitido para valores)`);
        setNestedValue(enriquecimento, campo, null);
        delete fonteDados[campo];
      }
    }
  }

  const cpfCnpjCampos = ["credor.cpf_cnpj", "devedor.cnpj", "honorarios.advogado_cpf"];
  for (const campo of cpfCnpjCampos) {
    const fonte = fonteDados[campo];
    if (fonte === "FIRECRAWL" || fonte === "ESCAVADOR") {
      const val = getNestedValue(enriquecimento, campo);
      if (val && typeof val === "string") {
        const digits = val.replace(/\D/g, "");
        if (digits.length === 11 || digits.length === 14) {
          alertas.push(`[ANTI-HALLUCINATION] CPF/CNPJ '${campo}' obtido de fonte nao-oficial '${fonte}' — dado sensivel LGPD bloqueado`);
          setNestedValue(enriquecimento, campo, null);
          delete fonteDados[campo];
        }
      }
    }
  }

  if (fonteDados["numero_precatorio"] && fonteDados["numero_precatorio"] !== "DOCUMENTO") {
    alertas.push(`[ANTI-HALLUCINATION] numero_precatorio preenchido por '${fonteDados["numero_precatorio"]}' — somente DOCUMENTO aceito`);
    setNestedValue(enriquecimento, "numero_precatorio", null);
    delete fonteDados["numero_precatorio"];
  }

  if (fonteDados["numero_oficio"] && fonteDados["numero_oficio"] !== "DOCUMENTO") {
    alertas.push(`[ANTI-HALLUCINATION] numero_oficio preenchido por '${fonteDados["numero_oficio"]}' — somente DOCUMENTO aceito`);
    setNestedValue(enriquecimento, "numero_oficio", null);
    delete fonteDados["numero_oficio"];
  }

  for (const alerta of alertas) {
    console.warn(`[DIAGNOSTICO] ${trace_id} ${alerta}`);
  }

  return alertas;
}

/** TRAVA ANTI-REGRESSAO CASCATA: Garante que merge nao sobrescreve dados ja existentes do documento */
function assertAntiRegressaoCascata(
  enriquecimentoOriginal: Record<string, any>,
  enriquecimentoAtual: Enriquecimento,
  trace_id: string
): string[] {
  const violacoes: string[] = [];

  const camposProtegidos = [
    "processo.numero_cnj",
    "credor.nome",
    "credor.cpf_cnpj",
    "devedor.nome",
    "valores.valor_total_requisicao",
    "valores.valor_principal",
    "numero_precatorio",
    "numero_oficio",
  ];

  for (const campo of camposProtegidos) {
    const original = getNestedValue(enriquecimentoOriginal, campo);
    const atual = getNestedValue(enriquecimentoAtual, campo);

    if (original !== null && original !== undefined && original !== "" &&
        atual !== original) {
      violacoes.push(`[ANTI-REGRESSAO] Campo protegido '${campo}' alterado: '${original}' -> '${atual}'`);
      setNestedValue(enriquecimentoAtual, campo, original);
    }
  }

  for (const v of violacoes) {
    console.error(`[DIAGNOSTICO] ${trace_id} ${v}`);
  }

  return violacoes;
}

const CAMPOS_ARRAYS = [
  "credor.advogados",
  "dados_bancarios",
  "cessionarios",
  "gravames_penhoras",
  "informacoes_adicionais.textos_relevantes",
  "informacoes_adicionais.numeros_diversos",
  "informacoes_adicionais.observacoes_documento",
  "informacoes_adicionais.referencias_externas",
  "informacoes_adicionais.termos_juridicos_especificos",
  "metadados_visuais.notas_rodape",
];

function calcularMatrizCompletude(enriquecimento: Enriquecimento | null): MatrizCompletude {
  const totalCampos = CAMPOS_OBRIGATORIOS.length + CAMPOS_ARRAYS.length;

  if (!enriquecimento) {
    return {
      total_campos: totalCampos,
      campos_preenchidos: 0,
      percentual: 0,
      campos_faltantes: [...CAMPOS_OBRIGATORIOS, ...CAMPOS_ARRAYS],
      campos_criticos_faltantes: [...CAMPOS_OBRIGATORIOS_CRITICOS],
    };
  }

  const campos_faltantes: string[] = [];
  const campos_criticos_faltantes: string[] = [];
  let preenchidos = 0;

  for (const campo of CAMPOS_OBRIGATORIOS) {
    const valor = getNestedValue(enriquecimento, campo);
    if (valor !== null && valor !== undefined && valor !== "") {
      preenchidos++;
    } else {
      campos_faltantes.push(campo);
      if (CAMPOS_OBRIGATORIOS_CRITICOS.includes(campo)) {
        campos_criticos_faltantes.push(campo);
      }
    }
  }

  for (const campo of CAMPOS_ARRAYS) {
    const valor = getNestedValue(enriquecimento, campo);
    if (Array.isArray(valor) && valor.length > 0) {
      preenchidos++;
    } else {
      campos_faltantes.push(campo);
    }
  }

  return {
    total_campos: totalCampos,
    campos_preenchidos: preenchidos,
    percentual: Math.round((preenchidos / totalCampos) * 100),
    campos_faltantes,
    campos_criticos_faltantes,
  };
}

export async function executarDiagnosticoCompleto(
  textoOCR: string,
  processoId: string,
  userId: string,
  storage: any,
  enriquecimentoExistente?: Enriquecimento | null
): Promise<DiagnosticoResult> {
  const trace_id = generateTraceId("DIAG");
  const etapas: DiagnosticoEtapa[] = [];
  let enriquecimento: Enriquecimento | null = enriquecimentoExistente || null;
  const fontes_oficiais: FonteOficial[] = [];
  let dados_complementares: any = {};
  const fonteDados: FonteDadosCampo = {};
  let datajudResultCache: any = null;
  let enriquecimentoSnapshot: Record<string, any> | null = null;
  const extras_oficiais: Record<string, any> = {};
  const fontesOficiaisResults: FonteOficialResult[] = [];

  const ARTEFATOS_DIR = path.join(process.cwd(), "artefatos_evidencias");
  if (!fs.existsSync(ARTEFATOS_DIR)) {
    fs.mkdirSync(ARTEFATOS_DIR, { recursive: true });
  }

  function salvarArtefatoRaw(fonte: string, payload: any): { raw_path: string; raw_sha256: string } {
    const raw = JSON.stringify(payload, null, 2);
    const hash = sha256OfString(raw);
    const filename = `${fonte}_${processoId}_${Date.now()}.json`;
    const filePath = path.join(ARTEFATOS_DIR, filename);
    fs.writeFileSync(filePath, raw, "utf8");
    return { raw_path: filePath, raw_sha256: hash };
  }

  console.log(`[DIAGNOSTICO] ${trace_id} Iniciando pipeline unificado para processo ${processoId}`);

  // === ETAPA 1: EXTRACAO OCR/IA ===
  const etapa1: DiagnosticoEtapa = {
    id: "extracao_ia",
    titulo: "Extracao IA/OCR",
    status: enriquecimento ? "concluido" : "em_andamento",
    descricao: enriquecimento ? "Dados ja extraidos previamente" : "Extraindo dados do documento via IA",
    inicio: new Date(),
  };
  etapas.push(etapa1);

  if (enriquecimento) {
    etapa1.fim = new Date();
    console.log(`[DIAGNOSTICO] ${trace_id} Etapa 1 SKIP: enriquecimento ja existe (CNJ=${enriquecimento.processo?.numero_cnj})`);
  } else {
  try {
    await storage.createAnaliseEtapa({
      processoId, userId, etapa: "extracao_dados", status: "em_andamento",
      traceId: trace_id, iniciadoEm: new Date(),
    });

    const resultado = await enriquecerDocumento(textoOCR, processoId);
    enriquecimento = resultado.enriquecimento;

    etapa1.status = "concluido";
    etapa1.fim = new Date();
    etapa1.dados = { hash: resultado.hash, trace_id: resultado.trace_id };

    const etapaDb = await storage.getAnaliseByProcessoEtapa(processoId, "extracao_dados");
    if (etapaDb) {
      await storage.updateAnaliseEtapa(etapaDb.id, {
        status: "concluido",
        dadosSaida: { extraction: { ok: true, ...enriquecimento }, hash: resultado.hash, fonte: "diagnostico_unificado" },
        concluidoEm: new Date(),
      });
    }

    const processoUpdate: Record<string, any> = { status: "em_analise", etapaAtual: "extracao" };
    if (enriquecimento.processo?.numero_cnj) processoUpdate.numeroProcesso = enriquecimento.processo.numero_cnj;
    if (enriquecimento.tribunal) processoUpdate.tribunal = enriquecimento.tribunal;
    if (enriquecimento.vara_secao || enriquecimento.comarca) processoUpdate.varaComarca = enriquecimento.vara_secao || enriquecimento.comarca;
    if (enriquecimento.processo?.natureza_credito) processoUpdate.natureza = enriquecimento.processo.natureza_credito;
    if (enriquecimento.credor?.nome) processoUpdate.nomeCredor = enriquecimento.credor.nome;
    if (enriquecimento.devedor?.nome) processoUpdate.orgaoDevedor = enriquecimento.devedor.nome;
    if (enriquecimento.valores?.valor_total_requisicao) processoUpdate.valorEstimado = String(enriquecimento.valores.valor_total_requisicao);
    if (enriquecimento.numero_precatorio) processoUpdate.numeroPrecatorio = enriquecimento.numero_precatorio;
    processoUpdate.payloadCompleto = {
      ...((await storage.getProcesso(processoId))?.payloadCompleto as any || {}),
      enriquecimento,
      extraction_source: "diagnostico_unificado",
    };
    await storage.updateProcesso(processoId, processoUpdate);

    console.log(`[DIAGNOSTICO] ${trace_id} Etapa 1 concluida: CNJ=${enriquecimento.processo?.numero_cnj}, tribunal=${enriquecimento.tribunal}`);
  } catch (err: any) {
    etapa1.status = "erro";
    etapa1.erro = err.message;
    etapa1.fim = new Date();
    console.error(`[DIAGNOSTICO] ${trace_id} Erro na extracao:`, err.message);

    const etapaDb = await storage.getAnaliseByProcessoEtapa(processoId, "extracao_dados");
    if (etapaDb) {
      await storage.updateAnaliseEtapa(etapaDb.id, { status: "erro", erro: err.message, concluidoEm: new Date() });
    }

    return {
      trace_id, processo_id: processoId, status: "erro", etapas,
      enriquecimento: null, fontes_oficiais: [], matriz_completude: calcularMatrizCompletude(null),
      dados_complementares: {}, hash_final: "",
      cadeia_custodia: { trace_id, operador_user_id: userId, processo_id: processoId, timestamp_inicio: new Date().toISOString(), timestamp_fim: new Date().toISOString(), hash_integridade: "", total_fontes_consultadas: 0, total_fontes_ok: 0, total_fontes_fail: 0, total_fontes_nao_consultadas: 0, fontes_consultadas: [], fontes_nao_consultadas: [], artefatos_preservados: [], versao_cadeia: "1.0.0" },
    } as DiagnosticoResult;
  }
  } // end else (enriquecimento nao existia)

  if (enriquecimento) {
    enriquecimentoSnapshot = JSON.parse(JSON.stringify(enriquecimento));
    console.log(`[DIAGNOSTICO] ${trace_id} Snapshot do enriquecimento original criado para anti-regressao`);
  }

  // === ETAPA 2: FONTES OFICIAIS (OBRIGATORIO) ===
  const etapa2: DiagnosticoEtapa = {
    id: "fontes_oficiais",
    titulo: "Consulta Fontes Oficiais",
    status: "em_andamento",
    descricao: "Consultando DataJud, Tribunais e fontes oficiais",
    inicio: new Date(),
  };
  etapas.push(etapa2);

  try {
    await storage.createAnaliseEtapa({
      processoId, userId, etapa: "fontes_oficiais", status: "em_andamento",
      traceId: trace_id, iniciadoEm: new Date(),
    });

    const cnjPrincipal = enriquecimento?.processo?.numero_cnj;
    const cnjExecucao = enriquecimento?.processo?.numero_processo_execucao;
    const cnjParaBusca = cnjPrincipal || cnjExecucao;

    if (cnjParaBusca && isDatajudConfigured()) {
      console.log(`[DIAGNOSTICO] ${trace_id} Consultando DataJud para CNJ: ${cnjParaBusca}`);

      let datajudResult = await searchDatajud(cnjParaBusca);
      let existe = datajudResult.success && datajudResult.hits > 0 && !!datajudResult.processo;

      if (!existe && cnjExecucao && cnjExecucao !== cnjParaBusca) {
        console.log(`[DIAGNOSTICO] ${trace_id} CNJ principal nao localizado, tentando execucao: ${cnjExecucao}`);
        datajudResult = await searchDatajud(cnjExecucao);
        existe = datajudResult.success && datajudResult.hits > 0 && !!datajudResult.processo;
      }

      if (!existe && cnjPrincipal && cnjExecucao && cnjPrincipal !== cnjExecucao) {
        console.log(`[DIAGNOSTICO] ${trace_id} Tentando CNJ alternativo: ${cnjPrincipal}`);
        datajudResult = await searchDatajud(cnjPrincipal);
        existe = datajudResult.success && datajudResult.hits > 0 && !!datajudResult.processo;
      }

      let status_processo = "Nao localizado";
      let cessao_detectada = false;
      let ultima_movimentacao: { data: string; descricao: string } | null = null;

      if (existe && datajudResult.movimentos?.length > 0) {
        const movTxt = datajudResult.movimentos.slice(0, 30)
          .map((m: any) => ((m.evento || "") + " " + (m.complementos || "")).toLowerCase()).join(" ");

        const processoBaixado = ["baixa", "baixado", "arquivado", "transitado em julgado", "arquivamento"]
          .some(i => movTxt.includes(i));
        cessao_detectada = ["cessao", "cessão", "cessionário", "cessionario", "transferencia de credito", "transferência de crédito"]
          .some(i => movTxt.includes(i));
        status_processo = processoBaixado ? "Baixado / Arquivado" : "Em tramitacao";
      } else if (existe) {
        status_processo = "Localizado (sem movimentacoes disponiveis)";
      }

      if (datajudResult.ultima_movimentacao?.data) {
        ultima_movimentacao = {
          data: datajudResult.ultima_movimentacao.data,
          descricao: datajudResult.ultima_movimentacao.evento || "Movimentacao registrada",
        };
      }

      const datajudRaw = JSON.stringify(datajudResult);
      const datajudHash = crypto.createHash("sha256").update(datajudRaw).digest("hex");
      const datajudCamposExtraidos = existe ? Object.keys(datajudResult.processo || {}).filter(k => (datajudResult.processo as any)?.[k] != null) : [];

      let datajudObservacoes = "";
      let datajudMotivo = "";
      if (existe) {
        datajudObservacoes = `${datajudResult.movimentos?.length || 0} movimentacoes encontradas`;
        datajudMotivo = "";
      } else {
        const cnjDigits = (cnjParaBusca || "").replace(/\D/g, "");
        const anoProcesso = cnjDigits.length >= 11 ? parseInt(cnjDigits.substring(9, 13), 10) : 0;
        const trCode = cnjDigits.length >= 16 ? cnjDigits.substring(13, 16) : "";
        const tribunalNome = datajudResult.cnj?.formatted
          ? (datajudResult.fonte?.endpoint || "").replace("https://api-publica.datajud.cnj.jus.br/", "").replace("/_search", "").toUpperCase()
          : trCode;
        const mesesDesdeDistribuicao = anoProcesso > 0 ? Math.max(0, Math.round(((new Date()).getFullYear() * 12 + (new Date()).getMonth()) - (anoProcesso * 12 + 0))) : 0;
        const isRecente = mesesDesdeDistribuicao <= 18;
        const isFederal = cnjDigits.length >= 14 && cnjDigits[13] === "4";

        if (isRecente && isFederal) {
          datajudMotivo = "LATENCIA_INDEXACAO_TRIBUNAL";
          datajudObservacoes = `Processo nao localizado no DataJud (indice ${tribunalNome}). ` +
            `Processo distribuido em ${anoProcesso} na Justica Federal — ` +
            `a API publica DataJud/CNJ possui latencia de indexacao variavel por tribunal. ` +
            `Tribunais federais (TRFs/SJs) podem levar semanas a meses para enviar dados ao DataJud. ` +
            `A ausencia no DataJud NAO significa inexistencia do processo — significa que ainda nao foi indexado na base publica.`;
        } else if (isRecente) {
          datajudMotivo = "LATENCIA_INDEXACAO_TRIBUNAL";
          datajudObservacoes = `Processo nao localizado no DataJud (indice ${tribunalNome}). ` +
            `Processo distribuido em ${anoProcesso} — a indexacao na API publica DataJud/CNJ pode apresentar ` +
            `latencia variavel dependendo do tribunal de origem. ` +
            `A ausencia no DataJud NAO significa inexistencia do processo.`;
        } else {
          datajudMotivo = "NAO_LOCALIZADO";
          datajudObservacoes = `Processo nao localizado no DataJud (indice ${tribunalNome}). ` +
            `Foram tentadas multiplas estrategias de busca (match, term, match_phrase). ` +
            `Possibilidades: CNJ incorreto, processo sigiloso, ou dados ainda nao disponibilizados pelo tribunal.`;
        }
        console.log(`[DIAGNOSTICO] ${trace_id} DataJud zero hits — motivo: ${datajudMotivo}, ano: ${anoProcesso}, tribunal: ${tribunalNome}`);
      }

      fontes_oficiais.push({
        nome: "DataJud CNJ",
        tipo: "DATAJUD",
        status: existe ? "ok" : "indisponivel",
        is_official: true,
        dados: {
          existe, status_processo, cessao_detectada, ultima_movimentacao,
          confianca: existe ? "ALTA" : "BAIXA",
          hits: datajudResult.hits,
          movimentos_total: datajudResult.movimentos?.length || 0,
          classe_processual: datajudResult.processo?.classe,
          assuntos: datajudResult.processo?.assuntos,
          orgao_julgador: datajudResult.processo?.vara,
          tribunal_oficial: datajudResult.processo?.tribunal,
          data_ajuizamento_oficial: datajudResult.processo?.data_ajuizamento,
          motivo_ausencia: datajudMotivo || undefined,
        },
        observacoes: datajudObservacoes,
        consultado_em: new Date().toISOString(),
        endpoint: datajudResult.fonte?.endpoint || "https://api-publica.datajud.cnj.jus.br",
        hash_evidencia: datajudHash,
        bytes_resposta: datajudRaw.length,
        campos_extraidos: datajudCamposExtraidos,
      });

      if (existe && datajudResult.processo) {
        datajudResultCache = datajudResult;
        const currentProcesso = await storage.getProcesso(processoId);
        const currentPayload = (currentProcesso?.payloadCompleto as any) || {};
        const datajudEnrichment = {
          classe_processual: datajudResult.processo.classe,
          assuntos: datajudResult.processo.assuntos,
          grau: datajudResult.processo.grau,
          orgao_julgador: datajudResult.processo.vara,
          data_ajuizamento_oficial: datajudResult.processo.data_ajuizamento,
          tribunal_oficial: datajudResult.processo.tribunal,
          total_movimentacoes: datajudResult.movimentos?.length || 0,
          status_oficial: status_processo,
          cessao_detectada_movimentos: cessao_detectada,
          ultima_movimentacao,
        };
        const mergeUpdate: Record<string, any> = {};
        if (datajudResult.processo.vara) mergeUpdate.varaComarca = datajudResult.processo.vara;
        mergeUpdate.payloadCompleto = { ...currentPayload, datajud_oficial: datajudEnrichment };
        await storage.updateProcesso(processoId, mergeUpdate);
        dados_complementares.datajud = datajudEnrichment;

        const datajudArtefato = salvarArtefatoRaw("DATAJUD", datajudResult);
        const datajudNormalized = salvarArtefatoRaw("DATAJUD_normalized", datajudEnrichment);

        const datajudFonteResult: FonteOficialResult = {
          fonte: "DATAJUD",
          is_public_free: true,
          status: "OK",
          fetched_at_iso: nowIsoUTC(),
          raw_path: datajudArtefato.raw_path,
          raw_sha256: datajudArtefato.raw_sha256,
          normalized_full_path: datajudNormalized.raw_path,
          normalized_full_sha256: datajudNormalized.raw_sha256,
          mapped_fields: Object.keys(fonteDados).filter(k => fonteDados[k] === "DATAJUD"),
          warnings: [],
          errors: [],
        };
        try {
          registerFonteResultOrThrow(datajudFonteResult);
        } catch (policyErr: any) {
          console.warn(`[DIAGNOSTICO] ${trace_id} POLICY DataJud: ${policyErr.message}`);
        }
        fontesOficiaisResults.push(datajudFonteResult);

        const canonicalFields = ["classe_processual", "grau_jurisdicao", "data_ajuizamento", "tribunal", "assuntos", "vara"];
        const unmappedKeys = Object.keys(datajudResult.processo || {}).filter(k => !canonicalFields.includes(k) && (datajudResult.processo as any)?.[k] != null);
        if (unmappedKeys.length > 0) {
          const extrasDatajud: Record<string, any> = {};
          for (const k of unmappedKeys) {
            extrasDatajud[k] = (datajudResult.processo as any)[k];
          }
          extras_oficiais["DATAJUD"] = extrasDatajud;
        }

        if (datajudResult._source_integral) {
          extras_oficiais["DATAJUD_source_integral"] = datajudResult._source_integral;
        }

        if (datajudResult._all_hits && datajudResult._all_hits.length > 1) {
          extras_oficiais["DATAJUD_all_hits"] = datajudResult._all_hits;
        }

        if (datajudResult.movimentos?.length > 0) {
          extras_oficiais["DATAJUD_movimentos"] = datajudResult.movimentos;
        }

        if (enriquecimento) {
          const { camposMergeados } = mergeDatajudIntoEnriquecimento(enriquecimento, datajudResult, fonteDados);
          if (camposMergeados.length > 0) {
            console.log(`[DIAGNOSTICO] ${trace_id} CASCATA DataJud: ${camposMergeados.length} campos preenchidos via fonte oficial: ${camposMergeados.join(", ")}`);
            const procAtual = await storage.getProcesso(processoId);
            const payloadAtual = (procAtual?.payloadCompleto as any) || {};
            await storage.updateProcesso(processoId, {
              payloadCompleto: { ...payloadAtual, enriquecimento, fonte_dados_campos: fonteDados },
            });
          }
        }

        console.log(`[DIAGNOSTICO] ${trace_id} DataJud: dados oficiais mergeados`);
      } else {
        const datajudZeroArtefato = salvarArtefatoRaw("DATAJUD_ZERO_HITS", {
          consulta: cnjParaBusca,
          resultado: "zero_hits",
          motivo: datajudMotivo,
          observacoes: datajudObservacoes,
          endpoint: datajudResult.fonte?.endpoint,
          http_status: datajudResult.fonte?.http_status,
          strategies_tried: datajudResult.fonte?.strategy_used,
          raw_response_hits_total: datajudResult._raw_response?.hits?.total || { value: 0 },
          consultado_em: nowIsoUTC(),
        });
        const datajudZeroFonteResult: FonteOficialResult = {
          fonte: "DATAJUD",
          is_public_free: true,
          status: "FAIL",
          fetched_at_iso: nowIsoUTC(),
          raw_path: datajudZeroArtefato.raw_path,
          raw_sha256: datajudZeroArtefato.raw_sha256,
          mapped_fields: [],
          warnings: [datajudMotivo || "NAO_LOCALIZADO"],
          errors: [],
        };
        fontesOficiaisResults.push(datajudZeroFonteResult);
        console.log(`[DIAGNOSTICO] ${trace_id} DataJud: zero hits registrado como FAIL com artefato preservado`);
      }
    } else {
      fontes_oficiais.push({
        nome: "DataJud CNJ",
        tipo: "DATAJUD",
        status: !cnjParaBusca ? "nao_consultado" : "indisponivel",
        is_official: true,
        observacoes: !cnjParaBusca ? "CNJ nao extraido do documento" : "DATAJUD_API_KEY nao configurada",
        consultado_em: new Date().toISOString(),
      });
    }

    const iaRaw = JSON.stringify(enriquecimento);
    const iaHash = crypto.createHash("sha256").update(iaRaw).digest("hex");
    const iaCamposExtraidos = enriquecimento ? Object.keys(enriquecimento).filter(k => (enriquecimento as any)[k] != null) : [];

    fontes_oficiais.push({
      nome: "Extracao IA (Documento)",
      tipo: "TRIBUNAL",
      status: "ok",
      is_official: false,
      observacoes: "Dados extraidos do PDF via IA — insumo, nao fonte oficial",
      consultado_em: new Date().toISOString(),
      hash_evidencia: iaHash,
      bytes_resposta: iaRaw.length,
      campos_extraidos: iaCamposExtraidos,
    });

    etapa2.status = "concluido";
    etapa2.fim = new Date();
    etapa2.dados = { fontes: fontes_oficiais.length };

    const etapa2Db = await storage.getAnaliseByProcessoEtapa(processoId, "fontes_oficiais");
    if (etapa2Db) {
      await storage.updateAnaliseEtapa(etapa2Db.id, {
        status: "concluido",
        dadosSaida: { fontes: fontes_oficiais },
        concluidoEm: new Date(),
      });
    }

    await storage.createAnaliseEtapa({
      processoId, userId, etapa: "pesquisa_online", status: "concluido",
      traceId: trace_id,
      dadosSaida: { fonte: "diagnostico_unificado", fontes: fontes_oficiais },
      iniciadoEm: new Date(), concluidoEm: new Date(),
    });

    console.log(`[DIAGNOSTICO] ${trace_id} Etapa 2 concluida: ${fontes_oficiais.length} fontes consultadas`);
  } catch (err: any) {
    etapa2.status = "erro";
    etapa2.erro = err.message;
    etapa2.fim = new Date();
    console.error(`[DIAGNOSTICO] ${trace_id} Erro nas fontes oficiais (nao-bloqueante):`, err.message);
  }

  // === ETAPA 2B: FONTES COMPLEMENTARES OBRIGATORIAS (Portal Tribunal, Diarios, DEPRE, BrasilAPI) ===
  const cnjParaFontes = enriquecimento?.processo?.numero_cnj;
  const tribunalDetectado = enriquecimento?.tribunal || (enriquecimento as any)?.processo?.tribunal || "";
  const hasFirecrawl = !!process.env.FIRECRAWL_API_KEY;

  if (cnjParaFontes) {
    // --- Portal do Tribunal (PRIMARIO: Conector Unificado consulta-publica.ts | SECUNDARIO: Firecrawl fallback) ---
    // N8: Tribunal portais nao possuem API publica — scraping justificado via registry
    try {
      if (tribunalDetectado) {
        const tribunalCode = tribunalDetectado.toUpperCase().replace(/\s+/g, "");
        const registryEntry = getRegistryEntryByCode(tribunalCode);
        let portalConectorOk = false;
        let conectorResult: TribunalQueryResult | null = null;

        // PRIMARIO: Conector unificado consulta-publica.ts (HTTP+Cheerio/Playwright auto)
        if (registryEntry && registryEntry.active) {
          try {
            assertN8Compliance(tribunalCode);
            console.log(`[DIAGNOSTICO] ${trace_id} [PRIMARIO] Conector Unificado para Portal ${tribunalCode} (prioridade ${registryEntry.priority}, stack ${registryEntry.profile.stack})`);

            const tribunalInput = buildTribunalRequest({
              profile: registryEntry.profile,
              processNumber: cnjParaFontes,
            });
            conectorResult = await queryTribunalPublic(tribunalInput);

            if (conectorResult.ok && conectorResult.normalized.extracted_text_full.length > 100) {
              portalConectorOk = true;

              fontes_oficiais.push({
                nome: `Portal do Tribunal (${tribunalCode}) [Conector Unificado]`,
                tipo: "TRIBUNAL",
                status: "ok",
                is_official: true,
                observacoes: `Conector Unificado OK. Stack: ${conectorResult.normalized.detected_stack} (${conectorResult.normalized.stack_confidence}). Modo: ${conectorResult.mode_used}. Links: ${conectorResult.normalized.links.length}. Tabelas: ${conectorResult.normalized.table_rows.length} linhas.`,
                consultado_em: conectorResult.evidence.captured_at_iso,
                endpoint: conectorResult.evidence.request.url,
                hash_evidencia: conectorResult.evidence.response.raw_sha256,
                bytes_resposta: conectorResult.evidence.response.raw_bytes,
                campos_extraidos: Object.keys(conectorResult.normalized),
              });

              let camposPortal: string[] = [];
              const tableData = conectorResult.normalized.table_rows;
              if (tableData.length > 0 && enriquecimento) {
                const firstRow = tableData[0];
                const portalMapping: Array<{campo: string; chaves: string[]}> = [
                  { campo: "datas_importantes.data_transito_julgado", chaves: ["transito_em_julgado", "data_transito", "Trânsito em Julgado", "Data Trânsito"] },
                  { campo: "processo.fase_processual", chaves: ["fase", "situacao", "Fase", "Situação", "Status"] },
                  { campo: "processo.status_oficial", chaves: ["status_processo", "status", "Status Processo", "Situacao"] },
                ];
                for (const { campo, chaves } of portalMapping) {
                  if (getNestedValue(enriquecimento, campo)) continue;
                  for (const chave of chaves) {
                    const valor = firstRow[chave];
                    if (valor && valor.trim()) {
                      setNestedValue(enriquecimento, campo, valor.trim());
                      fonteDados[campo] = "TRIBUNAL";
                      camposPortal.push(campo);
                      break;
                    }
                  }
                }
              }

              if (camposPortal.length > 0) {
                console.log(`[DIAGNOSTICO] ${trace_id} CASCATA Portal Tribunal (Conector Unificado): ${camposPortal.length} campos preenchidos: ${camposPortal.join(", ")}`);
              }

              extras_oficiais["TRIBUNAL_portal_integral"] = {
                metodo: "CONECTOR_UNIFICADO",
                mode_used: conectorResult.mode_used,
                detected_stack: conectorResult.normalized.detected_stack,
                stack_confidence: conectorResult.normalized.stack_confidence,
                evidence_uuid: conectorResult.evidence.process_id_uuid,
                raw_sha256: conectorResult.evidence.response.raw_sha256,
                raw_path: conectorResult.evidence.response.raw_file_path,
                normalized: conectorResult.normalized,
                warnings: conectorResult.warnings,
              };

              const portalArtefato = salvarArtefatoRaw("TRIBUNAL_PORTAL_CONECTOR", conectorResult.evidence);
              const portalNormalized = salvarArtefatoRaw("TRIBUNAL_PORTAL_CONECTOR_normalized", conectorResult.normalized);
              const portalFonteResult: FonteOficialResult = {
                fonte: "TRIBUNAL",
                is_public_free: true,
                status: "OK",
                fetched_at_iso: conectorResult.evidence.captured_at_iso,
                raw_path: portalArtefato.raw_path,
                raw_sha256: portalArtefato.raw_sha256,
                normalized_full_path: portalNormalized.raw_path,
                normalized_full_sha256: portalNormalized.raw_sha256,
                mapped_fields: camposPortal,
                warnings: conectorResult.warnings,
                errors: conectorResult.errors,
              };
              try { registerFonteResultOrThrow(portalFonteResult); } catch (e: any) { console.warn(`[DIAGNOSTICO] ${trace_id} POLICY Portal Conector: ${e.message}`); }
              fontesOficiaisResults.push(portalFonteResult);

              console.log(`[DIAGNOSTICO] ${trace_id} Portal Tribunal ${tribunalCode} (Conector Unificado): OK`);
            } else {
              console.warn(`[DIAGNOSTICO] ${trace_id} Conector Unificado retornou dados insuficientes para ${tribunalCode}. Warnings: ${conectorResult.warnings.join("; ")}. Errors: ${conectorResult.errors.join("; ")}. Tentando fallback Firecrawl...`);
            }
          } catch (n8Err: any) {
            if (n8Err.message?.includes("[N8 VIOLACAO]")) {
              console.error(`[DIAGNOSTICO] ${trace_id} N8 VIOLACAO: ${n8Err.message}. Scraping BLOQUEADO para ${tribunalCode}.`);
              fontes_oficiais.push({
                nome: `Portal do Tribunal (${tribunalCode})`,
                tipo: "TRIBUNAL",
                status: "erro",
                is_official: true,
                observacoes: `N8 VIOLACAO: ${n8Err.message}`,
                consultado_em: new Date().toISOString(),
              });
            } else {
              console.warn(`[DIAGNOSTICO] ${trace_id} Conector Unificado falhou para ${tribunalCode}: ${n8Err.message}. Tentando fallback Firecrawl...`);
            }
          }
        } else if (registryEntry && !registryEntry.active) {
          console.log(`[DIAGNOSTICO] ${trace_id} Tribunal ${tribunalCode} no registry mas INATIVO. Usando fallback Firecrawl.`);
        }

        // N8 COMPLIANCE: Firecrawl PROIBIDO nesta fase para Tribunais que possuem conector HTTP direto
        // Firecrawl para Tribunal so sera permitido na fase L10 (raspagem complementar) quando TODAS as fontes oficiais forem esgotadas
        if (!portalConectorOk) {
          console.log(`[DIAGNOSTICO] ${trace_id} [N8] Portal Tribunal ${tribunalCode}: Conector direto falhou/indisponivel. Firecrawl RESERVADO para fase L10 (raspagem complementar)`);
          fontes_oficiais.push({
            nome: `Portal do Tribunal (${tribunalCode})`,
            tipo: "TRIBUNAL",
            status: "nao_consultado",
            is_official: true,
            observacoes: !registryEntry
              ? `Tribunal ${tribunalCode} nao mapeado no registry — sera tentado via raspagem complementar (L10)`
              : `Conector primario falhou — Firecrawl reservado para fase L10 (N8 compliance: API direta obrigatoria nas fases L3-L8)`,
            consultado_em: new Date().toISOString(),
          });
        }
      } else {
        fontes_oficiais.push({
          nome: "Portal do Tribunal",
          tipo: "TRIBUNAL",
          status: "nao_consultado",
          is_official: true,
          observacoes: "Tribunal nao identificado no enriquecimento",
          consultado_em: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error(`[DIAGNOSTICO] ${trace_id} Erro Portal Tribunal (nao-bloqueante):`, err.message);
      fontes_oficiais.push({
        nome: "Portal do Tribunal",
        tipo: "TRIBUNAL",
        status: "erro",
        is_official: true,
        observacoes: `Erro: ${err.message}`,
        consultado_em: new Date().toISOString(),
      });
    }

    // --- Diarios Oficiais (N8: API direta obrigatoria - DOU HTTP direto como primario, Firecrawl como fallback) ---
    try {
      console.log(`[DIAGNOSTICO] ${trace_id} Consultando Diarios Oficiais para CNJ: ${cnjParaFontes} (metodo: DOU HTTP direto - N8)`);

      const douResult = await buscarDOU(cnjParaFontes);
      let douSuccess = douResult.success;
      let douPublicacoes = douResult.publicacoes;
      let douMetodo = douResult.metodo;
      let douUrl = douResult.url;
      let douTimestamp = douResult.timestamp;
      let douHash = douResult._raw_sha256;
      let douRawIntegral: any = douResult._raw_response_integral;
      let douRawString = douResult._raw_json_string;

      if (!douSuccess && hasFirecrawl) {
        console.log(`[DIAGNOSTICO] ${trace_id} DOU HTTP direto sem resultados, tentando Firecrawl como FALLBACK (N8 justificado)`);
        const diarioFallback = await rasparDiarioOficial(cnjParaFontes, "DOU");
        if (diarioFallback.success && diarioFallback.publicacoes?.length > 0) {
          douSuccess = true;
          douPublicacoes = diarioFallback.publicacoes.map((p: any) => ({
            conteudo: p.conteudo,
            data_publicacao: p.data_publicacao,
            tipo_ato: p.tipo,
          }));
          douMetodo = "FALLBACK_FIRECRAWL" as any;
          douUrl = diarioFallback.url;
          douTimestamp = diarioFallback.timestamp;
          douHash = diarioFallback.hash;
          douRawIntegral = { ...diarioFallback, _metodo: "FALLBACK_FIRECRAWL", _motivo: "DOU HTTP direto nao retornou resultados" };
          douRawString = JSON.stringify(douRawIntegral);
          console.log(`[DIAGNOSTICO] ${trace_id} Firecrawl FALLBACK: ${douPublicacoes.length} publicacoes`);
        }
      }

      const douRawForHash = douRawString || JSON.stringify(douRawIntegral);
      const douEvidenciaHash = crypto.createHash("sha256").update(douRawForHash).digest("hex");

      fontes_oficiais.push({
        nome: `Diarios Oficiais (DOU) [${douMetodo}]`,
        tipo: "DIARIO_OFICIAL",
        status: douSuccess ? "ok" : "erro",
        is_official: true,
        observacoes: douSuccess
          ? `${douPublicacoes.length} publicacoes encontradas via ${douMetodo}`
          : (douResult.error || "Sem publicacoes no DOU"),
        consultado_em: douTimestamp,
        endpoint: douUrl,
        hash_evidencia: douEvidenciaHash,
        bytes_resposta: douRawForHash.length,
        campos_extraidos: douPublicacoes.map((_: any, i: number) => `publicacao_${i + 1}`),
      });

      if (douSuccess && douPublicacoes.length > 0 && enriquecimento) {
        const pub = douPublicacoes[0];
        if (pub.data_publicacao && !getNestedValue(enriquecimento, "datas_importantes.data_publicacao_dou")) {
          setNestedValue(enriquecimento, "datas_importantes.data_publicacao_dou", pub.data_publicacao);
          fonteDados["datas_importantes.data_publicacao_dou"] = "DIARIO_OFICIAL";
          console.log(`[DIAGNOSTICO] ${trace_id} CASCATA Diario Oficial: data_publicacao_dou preenchida via ${douMetodo}`);
        }

        extras_oficiais["DIARIO_OFICIAL_integral"] = douRawIntegral;
        extras_oficiais["DIARIO_OFICIAL_metodo"] = douMetodo;

        const diarioArtefato = salvarArtefatoRaw("DIARIO_OFICIAL", douRawIntegral);
        const diarioNormalized = salvarArtefatoRaw("DIARIO_OFICIAL_normalized", douPublicacoes);
        const diarioFonteResult: FonteOficialResult = {
          fonte: "DIARIO_OFICIAL",
          is_public_free: true,
          status: "OK",
          fetched_at_iso: douTimestamp || nowIsoUTC(),
          raw_path: diarioArtefato.raw_path,
          raw_sha256: diarioArtefato.raw_sha256,
          normalized_full_path: diarioNormalized.raw_path,
          normalized_full_sha256: diarioNormalized.raw_sha256,
          mapped_fields: Object.keys(fonteDados).filter(k => fonteDados[k] === "DIARIO_OFICIAL"),
          warnings: douMetodo === "FALLBACK_FIRECRAWL" ? ["Usado Firecrawl como fallback - DOU HTTP direto nao retornou resultados"] : [],
          errors: [],
        };
        try { registerFonteResultOrThrow(diarioFonteResult); } catch (e: any) { console.warn(`[DIAGNOSTICO] ${trace_id} POLICY Diario: ${e.message}`); }
        fontesOficiaisResults.push(diarioFonteResult);
      }
      console.log(`[DIAGNOSTICO] ${trace_id} Diarios Oficiais: ${douSuccess ? "OK" : "FAIL"} (metodo: ${douMetodo})`);

    } catch (err: any) {
      console.error(`[DIAGNOSTICO] ${trace_id} Erro Diarios Oficiais (nao-bloqueante):`, err.message);
      fontes_oficiais.push({
        nome: "Diarios Oficiais",
        tipo: "DIARIO_OFICIAL",
        status: "erro",
        is_official: true,
        observacoes: `Erro: ${err.message}`,
        consultado_em: new Date().toISOString(),
      });
    }

    // --- DEPRE/Cessoes ---
    try {
      if (hasFirecrawl && tribunalDetectado) {
        console.log(`[DIAGNOSTICO] ${trace_id} Consultando DEPRE/Cessoes para ${tribunalDetectado}`);
        const depreResult = await rasparCessoesDEPRE(cnjParaFontes, tribunalDetectado);
        const depreRaw = JSON.stringify(depreResult);
        const depreHash = crypto.createHash("sha256").update(depreRaw).digest("hex");

        fontes_oficiais.push({
          nome: `DEPRE/Cessoes (${tribunalDetectado})`,
          tipo: "DEPRE",
          status: depreResult.success ? "ok" : "erro",
          is_official: true,
          observacoes: depreResult.success
            ? `${depreResult.cessoes?.length || 0} cessoes encontradas`
            : (depreResult.error || "Sem cessoes"),
          consultado_em: depreResult.timestamp,
          endpoint: depreResult.url,
          hash_evidencia: depreHash,
          bytes_resposta: depreRaw.length,
          campos_extraidos: depreResult.cessoes?.map((_: any, i: number) => `cessao_${i + 1}`) || [],
        });

        if (depreResult.success && depreResult.cessoes?.length > 0 && enriquecimento) {
          if (!enriquecimento.cessionarios || enriquecimento.cessionarios.length === 0) {
            enriquecimento.cessionarios = depreResult.cessoes.map((c: any) => ({
              nome: c.cessionario || c.nome,
              cpf_cnpj: c.cpf_cnpj,
              valor: c.valor,
              percentual_cedido: c.percentual,
              data_cessao: c.data,
            }));
            fonteDados["cessionarios"] = "DEPRE";
            console.log(`[DIAGNOSTICO] ${trace_id} CASCATA DEPRE: ${depreResult.cessoes.length} cessoes preenchidas`);
          }

          extras_oficiais["DEPRE_cessoes_integral"] = depreResult;

          const depreArtefato = salvarArtefatoRaw("DEPRE", depreResult);
          const depreNormalized = salvarArtefatoRaw("DEPRE_normalized", depreResult.cessoes);
          const depreFonteResult: FonteOficialResult = {
            fonte: "DEPRE",
            is_public_free: true,
            status: "OK",
            fetched_at_iso: depreResult.timestamp || nowIsoUTC(),
            raw_path: depreArtefato.raw_path,
            raw_sha256: depreArtefato.raw_sha256,
            normalized_full_path: depreNormalized.raw_path,
            normalized_full_sha256: depreNormalized.raw_sha256,
            mapped_fields: Object.keys(fonteDados).filter(k => fonteDados[k] === "DEPRE"),
            warnings: [],
            errors: [],
          };
          try { registerFonteResultOrThrow(depreFonteResult); } catch (e: any) { console.warn(`[DIAGNOSTICO] ${trace_id} POLICY DEPRE: ${e.message}`); }
          fontesOficiaisResults.push(depreFonteResult);
        }
        console.log(`[DIAGNOSTICO] ${trace_id} DEPRE/Cessoes: ${depreResult.success ? "OK" : "FAIL"}`);
      } else {
        fontes_oficiais.push({
          nome: "DEPRE/Cessoes",
          tipo: "DEPRE",
          status: "nao_consultado",
          is_official: true,
          observacoes: !hasFirecrawl ? "FIRECRAWL_API_KEY nao configurada" : "Tribunal nao identificado",
          consultado_em: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error(`[DIAGNOSTICO] ${trace_id} Erro DEPRE/Cessoes (nao-bloqueante):`, err.message);
      fontes_oficiais.push({
        nome: "DEPRE/Cessoes",
        tipo: "DEPRE",
        status: "erro",
        is_official: true,
        observacoes: `Erro: ${err.message}`,
        consultado_em: new Date().toISOString(),
      });
    }

    // --- BrasilAPI (Validacao CPF/CNPJ) - CAPTURA INTEGRAL (Diretiva DPO) ---
    try {
      const cpfCnpj = enriquecimento?.credor?.cpf_cnpj;
      if (cpfCnpj && typeof cpfCnpj === "string") {
        const digits = cpfCnpj.replace(/\D/g, "");
        let brasilApiOk = false;
        let brasilApiObs = "";
        let brasilApiCampos: string[] = [];
        let brasilApiRawResult: any = null;

        if (digits.length === 14) {
          console.log(`[DIAGNOSTICO] ${trace_id} Consultando BrasilAPI para CNPJ do credor (captura integral)`);
          const cnpjResult = await validateCnpj(digits);
          brasilApiOk = cnpjResult.valid;
          brasilApiObs = cnpjResult.valid
            ? `CNPJ validado: ${cnpjResult.razaoSocial || ""}`
            : `CNPJ invalido ou nao encontrado`;
          brasilApiCampos = cnpjResult.valid ? Object.keys(cnpjResult._raw_response_integral || cnpjResult.payload || {}) : [];
          brasilApiRawResult = cnpjResult;

          if (cnpjResult.valid && cnpjResult.razaoSocial && enriquecimento) {
            if (!getNestedValue(enriquecimento, "devedor.razao_social")) {
              setNestedValue(enriquecimento, "devedor.razao_social_brasilapi", cnpjResult.razaoSocial);
              fonteDados["devedor.razao_social_brasilapi"] = "BRASILAPI";
            }
          }

          if (cnpjResult._raw_response_integral) {
            extras_oficiais["BRASILAPI_CNPJ_integral"] = cnpjResult._raw_response_integral;
          }

          if (cnpjResult.valid && cnpjResult._raw_json_string) {
            const brasilApiArtefato = salvarArtefatoRaw("BRASILAPI_CNPJ", cnpjResult._raw_response_integral || cnpjResult.payload);
            const brasilApiNormalized = salvarArtefatoRaw("BRASILAPI_CNPJ_normalized", {
              cnpj: cnpjResult.cnpj,
              razaoSocial: cnpjResult.razaoSocial,
              nomeFantasia: cnpjResult.nomeFantasia,
              situacaoCadastral: cnpjResult.situacaoCadastral,
              dataAbertura: cnpjResult.dataAbertura,
              porte: cnpjResult.porte,
              naturezaJuridica: cnpjResult.naturezaJuridica,
              atividadePrincipal: cnpjResult.atividadePrincipal,
              uf: cnpjResult.uf,
              municipio: cnpjResult.municipio,
              endereco: cnpjResult.endereco,
              socios: cnpjResult.socios,
            });

            const brasilApiFonteResult: FonteOficialResult = {
              fonte: "BRASILAPI",
              is_public_free: true,
              status: "OK",
              fetched_at_iso: cnpjResult._fetched_at_iso || nowIsoUTC(),
              raw_path: brasilApiArtefato.raw_path,
              raw_sha256: brasilApiArtefato.raw_sha256,
              normalized_full_path: brasilApiNormalized.raw_path,
              normalized_full_sha256: brasilApiNormalized.raw_sha256,
              mapped_fields: Object.keys(fonteDados).filter(k => fonteDados[k] === "BRASILAPI"),
              warnings: [],
              errors: [],
            };
            try {
              registerFonteResultOrThrow(brasilApiFonteResult);
            } catch (policyErr: any) {
              console.warn(`[DIAGNOSTICO] ${trace_id} POLICY BrasilAPI: ${policyErr.message}`);
            }
            fontesOficiaisResults.push(brasilApiFonteResult);
          }
        } else if (digits.length === 11) {
          console.log(`[DIAGNOSTICO] ${trace_id} Consultando BrasilAPI para CPF do credor`);
          const cpfResult = await validateCpf(digits);
          brasilApiOk = cpfResult.valid;
          brasilApiObs = cpfResult.valid ? "CPF validado" : "CPF invalido ou nao encontrado";
          brasilApiCampos = cpfResult.valid ? ["cpf_validado"] : [];
        }

        const brasilApiHash = brasilApiRawResult?._raw_sha256 || "";
        fontes_oficiais.push({
          nome: "BrasilAPI (CPF/CNPJ)",
          tipo: "BRASILAPI",
          status: brasilApiOk ? "ok" : "erro",
          is_official: false,
          observacoes: brasilApiObs || "Validacao de documento",
          consultado_em: new Date().toISOString(),
          endpoint: brasilApiRawResult?._endpoint || "https://brasilapi.com.br/api",
          hash_evidencia: brasilApiHash,
          bytes_resposta: brasilApiRawResult?._raw_json_string?.length || 0,
          campos_extraidos: brasilApiCampos,
        });
        console.log(`[DIAGNOSTICO] ${trace_id} BrasilAPI: ${brasilApiOk ? "OK" : "FAIL"} - ${brasilApiObs} (campos integrais: ${brasilApiCampos.length})`);
      } else {
        fontes_oficiais.push({
          nome: "BrasilAPI (CPF/CNPJ)",
          tipo: "BRASILAPI",
          status: "nao_consultado",
          is_official: false,
          observacoes: "CPF/CNPJ do credor nao disponivel para validacao",
          consultado_em: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error(`[DIAGNOSTICO] ${trace_id} Erro BrasilAPI (nao-bloqueante):`, err.message);
      fontes_oficiais.push({
        nome: "BrasilAPI (CPF/CNPJ)",
        tipo: "BRASILAPI",
        status: "erro",
        is_official: false,
        observacoes: `Erro: ${err.message}`,
        consultado_em: new Date().toISOString(),
      });
    }

    // Persist enrichment updates from all complementary sources
    if (enriquecimento && processoId) {
      try {
        const procAtual = await storage.getProcesso(processoId);
        const payloadAtual = (procAtual?.payloadCompleto as any) || {};
        await storage.updateProcesso(processoId, {
          payloadCompleto: { ...payloadAtual, enriquecimento, fonte_dados_campos: fonteDados },
        });
      } catch (err: any) {
        console.error(`[DIAGNOSTICO] ${trace_id} Erro ao persistir dados complementares:`, err.message);
      }
    }

    console.log(`[DIAGNOSTICO] ${trace_id} Fontes complementares consultadas. Total fontes: ${fontes_oficiais.length}`);
  }

  // === ETAPA 3: ANALISE E CONSOLIDACAO ===
  const etapa3: DiagnosticoEtapa = {
    id: "analise",
    titulo: "Analise e Consolidacao",
    status: "em_andamento",
    descricao: "Analisando dados extraidos e consolidando diagnostico",
    inicio: new Date(),
  };
  etapas.push(etapa3);

  const matriz = calcularMatrizCompletude(enriquecimento);

  try {
    await storage.createAnaliseEtapa({
      processoId, userId, etapa: "analise_completa", status: "concluido",
      traceId: trace_id,
      dadosSaida: {
        fonte: "diagnostico_unificado",
        matriz_completude: matriz,
        fontes_oficiais_count: fontes_oficiais.filter(f => f.status === "ok").length,
        enriquecimento_hash: etapas[0]?.dados?.hash,
      },
      iniciadoEm: new Date(), concluidoEm: new Date(),
    });

    etapa3.status = "concluido";
    etapa3.fim = new Date();
    etapa3.dados = { matriz };

    console.log(`[DIAGNOSTICO] ${trace_id} Etapa 3 concluida: completude=${matriz.percentual}%, faltantes=${matriz.campos_faltantes.length}`);
  } catch (err: any) {
    etapa3.status = "erro";
    etapa3.erro = err.message;
    etapa3.fim = new Date();
  }

  // === ETAPA 4: RASPAGEM COMPLEMENTAR (SO SE NECESSARIO) ===
  if (matriz.campos_criticos_faltantes.length > 0 && enriquecimento) {
    const cnjParaRaspagem = enriquecimento.processo?.numero_cnj;
    const etapa4: DiagnosticoEtapa = {
      id: "raspagem_complementar",
      titulo: "Busca Complementar (Web)",
      status: "em_andamento",
      descricao: `Buscando dados faltantes: ${matriz.campos_criticos_faltantes.join(", ")}`,
      inicio: new Date(),
    };
    etapas.push(etapa4);

    if (cnjParaRaspagem && process.env.FIRECRAWL_API_KEY) {
      try {
        console.log(`[DIAGNOSTICO] ${trace_id} Etapa 4: Executando raspagem web para ${matriz.campos_criticos_faltantes.length} campos criticos faltantes`);
        const dadosOficiaisAtuais: Record<string, unknown> = {};
        for (const campo of CAMPOS_OBRIGATORIOS) {
          const val = getNestedValue(enriquecimento, campo);
          if (val !== null && val !== undefined && val !== "") {
            dadosOficiaisAtuais[campo] = val;
          }
        }

        const raspagemResult = await executarRaspagemComplementar(cnjParaRaspagem, dadosOficiaisAtuais);

        if (raspagemResult.success && Object.keys(raspagemResult.campos_extraidos).length > 0) {
          const { camposMergeados } = mergeRaspagemIntoEnriquecimento(
            enriquecimento, raspagemResult.campos_extraidos as Record<string, unknown>, fonteDados
          );

          if (camposMergeados.length > 0) {
            console.log(`[DIAGNOSTICO] ${trace_id} CASCATA Raspagem: ${camposMergeados.length} campos preenchidos via web: ${camposMergeados.join(", ")}`);
            const procAtual = await storage.getProcesso(processoId);
            const payloadAtual = (procAtual?.payloadCompleto as any) || {};
            await storage.updateProcesso(processoId, {
              payloadCompleto: { ...payloadAtual, enriquecimento, fonte_dados_campos: fonteDados },
            });
          }

          for (const fonte of raspagemResult.fontes) {
            fontes_oficiais.push({
              nome: `Raspagem Web: ${fonte.url.substring(0, 80)}`,
              tipo: "RASPAGEM_WEB",
              status: "ok",
              is_official: false,
              observacoes: `Nivel confianca: ${raspagemResult.metadados.nivel_confianca}`,
              consultado_em: fonte.timestamp,
              endpoint: fonte.url,
              hash_evidencia: fonte.hash,
              campos_extraidos: camposMergeados,
            });
          }

          etapa4.dados = {
            campos_buscados: matriz.campos_criticos_faltantes,
            campos_preenchidos_raspagem: camposMergeados,
            fontes_raspagem: raspagemResult.fontes.length,
            resultado: "raspagem_executada",
          };

          const matrizPos = calcularMatrizCompletude(enriquecimento);
          console.log(`[DIAGNOSTICO] ${trace_id} CASCATA pos-raspagem: completude=${matrizPos.percentual}% (antes=${matriz.percentual}%)`);
        } else {
          etapa4.dados = {
            campos_buscados: matriz.campos_criticos_faltantes,
            resultado: "raspagem_sem_dados",
            justificativa: raspagemResult.metadados?.justificativa || "Nenhum dado complementar encontrado",
          };
          console.log(`[DIAGNOSTICO] ${trace_id} Etapa 4: Raspagem nao retornou dados complementares`);
        }

        etapa4.status = "concluido";
        etapa4.fim = new Date();
      } catch (err: any) {
        etapa4.status = "erro";
        etapa4.erro = err.message;
        etapa4.fim = new Date();
        console.error(`[DIAGNOSTICO] ${trace_id} Erro na raspagem complementar (nao-bloqueante):`, err.message);
      }
    } else {
      etapa4.status = "concluido";
      etapa4.fim = new Date();
      etapa4.dados = {
        campos_buscados: matriz.campos_criticos_faltantes,
        resultado: "raspagem_indisponivel",
        motivo: !cnjParaRaspagem ? "CNJ nao disponivel" : "FIRECRAWL_API_KEY nao configurada",
      };
      console.log(`[DIAGNOSTICO] ${trace_id} Etapa 4: Raspagem nao disponivel (${!cnjParaRaspagem ? "sem CNJ" : "sem FIRECRAWL_API_KEY"})`);
    }
  }

  // === FINALIZACAO + CADEIA DE CUSTODIA ===
  const timestampFim = new Date().toISOString();
  const timestampInicio = etapas[0]?.inicio?.toISOString() || timestampFim;

  const TODAS_FONTES_POSSIVEIS = [
    { id: "datajud_cnj", nome: "DataJud (CNJ)", tipo: "OFICIAL" as const },
    { id: "portal_tribunal", nome: "Portal do Tribunal", tipo: "OFICIAL" as const },
    { id: "portal_precatorios_rpv", nome: "Portal Precatorios/RPV", tipo: "OFICIAL" as const },
    { id: "diarios_oficiais", nome: "Diarios Oficiais", tipo: "OFICIAL" as const },
    { id: "depre_cessoes", nome: "DEPRE/Cessoes", tipo: "OFICIAL" as const },
    { id: "escavador", nome: "Escavador", tipo: "NAO_OFICIAL" as const },
    { id: "brasilapi", nome: "BrasilAPI (CPF/CNPJ)", tipo: "NAO_OFICIAL" as const },
    { id: "extracao_ia", nome: "Extracao IA (Documento OCR)", tipo: "INSUMO" as const },
  ];

  let seqCounter = 0;
  const fontesConsultadas: RegistroFonteCustodia[] = [];
  const fontesNaoConsultadas: RegistroFonteCustodia[] = [];

  for (const fonteDef of TODAS_FONTES_POSSIVEIS) {
    const match = fontes_oficiais.find(f => {
      if (fonteDef.id === "datajud_cnj") return f.tipo === "DATAJUD";
      if (fonteDef.id === "extracao_ia") return f.nome.includes("Extracao IA");
      if (fonteDef.id === "escavador") return f.tipo === "RASPAGEM_WEB" && (f.endpoint || "").includes("escavador");
      if (fonteDef.id === "portal_tribunal") return f.tipo === "TRIBUNAL";
      return false;
    });

    if (match && match.status !== "nao_consultado") {
      seqCounter++;
      fontesConsultadas.push({
        seq: seqCounter,
        fonte_id: fonteDef.id,
        fonte_nome: fonteDef.nome,
        tipo: fonteDef.tipo,
        status: match.status === "ok" ? "OK" : match.status === "erro" ? "FAIL" : "PARTIAL",
        timestamp_utc: match.consultado_em || timestampFim,
        url_endpoint: match.endpoint || "N/A",
        http_status: match.dados?.status_code || (match.status === "ok" ? 200 : null),
        hash_sha256: match.hash_evidencia || "",
        bytes_recebidos: match.bytes_resposta || 0,
        campos_obtidos: match.campos_extraidos || [],
        amostra_conteudo: match.observacoes || "",
        artefato_path: null,
        motivo_falha: match.status !== "ok" ? (match.observacoes || "Consulta sem retorno") : null,
      });
    } else {
      seqCounter++;
      const motivo = fonteDef.id === "datajud_cnj" && !isDatajudConfigured()
        ? "DATAJUD_API_KEY nao configurada"
        : fonteDef.id === "datajud_cnj" && !enriquecimento?.processo?.numero_cnj
          ? "CNJ nao extraido do documento"
          : "Fonte nao implementada no pipeline atual";

      fontesNaoConsultadas.push({
        seq: seqCounter,
        fonte_id: fonteDef.id,
        fonte_nome: fonteDef.nome,
        tipo: fonteDef.tipo,
        status: "NAO_CONSULTADO",
        timestamp_utc: timestampFim,
        url_endpoint: "N/A",
        http_status: null,
        hash_sha256: "",
        bytes_recebidos: 0,
        campos_obtidos: [],
        amostra_conteudo: "",
        artefato_path: null,
        motivo_falha: motivo,
      });
    }
  }

  if (enriquecimento) {
    const alertasAntiHallucination = assertAntiHallucinationCascata(enriquecimento, fonteDados, trace_id);
    if (alertasAntiHallucination.length > 0) {
      console.warn(`[DIAGNOSTICO] ${trace_id} ANTI-ALUCINACAO: ${alertasAntiHallucination.length} bloqueios aplicados na cascata`);
    }

    if (enriquecimentoSnapshot) {
      const violacoesRegressao = assertAntiRegressaoCascata(enriquecimentoSnapshot, enriquecimento, trace_id);
      if (violacoesRegressao.length > 0) {
        console.error(`[DIAGNOSTICO] ${trace_id} ANTI-REGRESSAO: ${violacoesRegressao.length} campos protegidos restaurados`);
      }
    }

    if (enriquecimento && Object.keys(extras_oficiais).length > 0) {
      (enriquecimento as any).extras_oficiais = {
        ...((enriquecimento as any).extras_oficiais || {}),
        ...extras_oficiais,
      };
    }

    const procAtualGuard = await storage.getProcesso(processoId);
    const payloadAtualGuard = (procAtualGuard?.payloadCompleto as any) || {};
    await storage.updateProcesso(processoId, {
      payloadCompleto: {
        ...payloadAtualGuard,
        enriquecimento,
        fonte_dados_campos: fonteDados,
        extras_oficiais,
        fontes_oficiais_results: fontesOficiaisResults,
        anti_hallucination_cascata: { ativo: true, timestamp: new Date().toISOString() },
        anti_regressao_cascata: { ativo: true, timestamp: new Date().toISOString() },
      },
    });
    console.log(`[DIAGNOSTICO] ${trace_id} Guards anti-alucinacao e anti-regressao executados com sucesso`);
    if (Object.keys(extras_oficiais).length > 0) {
      console.log(`[DIAGNOSTICO] ${trace_id} Extras oficiais preservados: ${Object.keys(extras_oficiais).join(", ")}`);
    }
    if (fontesOficiaisResults.length > 0) {
      console.log(`[DIAGNOSTICO] ${trace_id} FonteOficialResult registrados: ${fontesOficiaisResults.map(f => `${f.fonte}:${f.status}`).join(", ")}`);
    }
  }

  const matrizFinal = calcularMatrizCompletude(enriquecimento);

  const todasEvidencias = JSON.stringify({ fontesConsultadas, fontesNaoConsultadas, enriquecimento, fontes_oficiais, matrizFinal, fonteDados, trace_id });
  const hash_integridade = crypto.createHash("sha256").update(todasEvidencias).digest("hex");

  const hash_final = generateHash(JSON.stringify({
    enriquecimento, fontes_oficiais, matrizFinal, trace_id,
  }));

  const cadeia_custodia: CadeiaCustodia = {
    trace_id,
    operador_user_id: userId,
    processo_id: processoId,
    timestamp_inicio: timestampInicio,
    timestamp_fim: timestampFim,
    hash_integridade,
    total_fontes_consultadas: fontesConsultadas.length,
    total_fontes_ok: fontesConsultadas.filter(f => f.status === "OK").length,
    total_fontes_fail: fontesConsultadas.filter(f => f.status === "FAIL").length,
    total_fontes_nao_consultadas: fontesNaoConsultadas.length,
    fontes_consultadas: fontesConsultadas,
    fontes_nao_consultadas: fontesNaoConsultadas,
    artefatos_preservados: [],
    versao_cadeia: "1.0.0",
  };

  const currentProcessoFinal = await storage.getProcesso(processoId);
  const currentPayloadFinal = (currentProcessoFinal?.payloadCompleto as any) || {};
  await storage.updateProcesso(processoId, {
    status: "diagnostico_concluido",
    etapaAtual: "diagnostico_concluido",
    payloadCompleto: {
      ...currentPayloadFinal,
      enriquecimento,
      cadeia_custodia,
      fonte_dados_campos: fonteDados,
    },
  });

  const statusFinal = etapas.some(e => e.status === "erro") ? "parcial" : "concluido";

  if (Object.keys(fonteDados).length > 0) {
    console.log(`[DIAGNOSTICO] ${trace_id} RASTREABILIDADE: ${Object.keys(fonteDados).length} campos com fonte identificada:`);
    for (const [campo, fonte] of Object.entries(fonteDados)) {
      console.log(`[DIAGNOSTICO] ${trace_id}   ${campo} <- ${fonte}`);
    }
  }

  console.log(`[DIAGNOSTICO] ${trace_id} Pipeline finalizado: status=${statusFinal}, completude_pre=${matriz.percentual}%, completude_final=${matrizFinal.percentual}%, hash=${hash_final.substring(0, 12)}`);
  console.log(`[CADEIA_CUSTODIA] ${trace_id} Fontes consultadas=${fontesConsultadas.length}, OK=${cadeia_custodia.total_fontes_ok}, FAIL=${cadeia_custodia.total_fontes_fail}, Nao consultadas=${fontesNaoConsultadas.length}, Hash integridade=${hash_integridade.substring(0, 16)}`);

  return {
    trace_id,
    processo_id: processoId,
    status: statusFinal,
    etapas,
    enriquecimento,
    fontes_oficiais,
    matriz_completude: matrizFinal,
    dados_complementares: { ...dados_complementares, fonte_dados_campos: fonteDados },
    hash_final,
    cadeia_custodia,
  };
}

export { calcularMatrizCompletude, CAMPOS_OBRIGATORIOS, CAMPOS_OBRIGATORIOS_CRITICOS, CAMPOS_ARRAYS };
