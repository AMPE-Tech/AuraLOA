/**
 * AuraDNA - Camada 5 (Evidencia textual via DJEN/CNJ)
 *
 * Fonte: Diario de Justica Eletronico Nacional (DJEN) - API publica do CNJ.
 * Sem autenticacao, JSON, cobre todos os tribunais brasileiros.
 *
 * Endpoint:
 *   GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
 *     ?numeroProcesso={CNJ}
 *     &dataDisponibilizacaoInicio=YYYY-MM-DD
 *     &dataDisponibilizacaoFim=YYYY-MM-DD
 *
 * Por que e poderoso:
 *   - Devolve PARTES + ADVOGADOS + OAB (publicacao oficial nao viola CNJ 303/2019)
 *   - Devolve TEOR de despachos/decisoes
 *   - Devolve LINK direto pro documento completo no eProc
 *
 * Limitacoes:
 *   - Comunicacoes anteriores a fev/2022 podem nao estar (DJEN comecou nessa data)
 *   - Texto vem em HTML - precisa stripar
 *   - Destinatarios so trazem nome + polo (A/P), CPF aparece quando ha
 */
import type { CamadaFn, CamadaResult, Evidencia } from '../types';

const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const NOME = 'Evidencia (DJEN)';

interface DJENDestinatario {
  nome: string;
  polo: 'A' | 'P' | string; // A=ativo, P=passivo
  comunicacao_id?: number;
}

interface DJENItem {
  id: number;
  data_disponibilizacao: string;
  siglaTribunal: string;
  tipoComunicacao: string;
  nomeOrgao: string;
  texto: string;                  // HTML
  numero_processo: string;
  link?: string;
  tipoDocumento?: string;
  nomeClasse?: string;
  codigoClasse?: string;
  numeroprocessocommascara?: string;
  destinatarios?: DJENDestinatario[];
}

interface DJENResponse {
  status: string;
  message?: string;
  count: number;
  items: DJENItem[];
}

/** Strip tags HTML e decode entidades comuns. Mantem apenas texto. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&atilde;/g, 'ã')
    .replace(/&otilde;/g, 'õ').replace(/&ccedil;/g, 'ç').replace(/&Atilde;/g, 'Ã')
    .replace(/&Aacute;/g, 'Á').replace(/&Ccedil;/g, 'Ç').replace(/&Eacute;/g, 'É')
    .replace(/&ordm;/g, 'º').replace(/&ordf;/g, 'ª')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extrai linhas tipo "AUTOR | : NOME" e "ADVOGADO(A) | : NOME (OAB XX12345)" do texto. */
interface ParteExtraida {
  tipo: string;       // EXEQUENTE, AUTOR, ADVOGADO(A), REU, etc
  nome: string;
  oab?: string;
  cpf?: string;
  cnpj?: string;
}
function extrairPartes(textoLimpo: string): ParteExtraida[] {
  const partes: ParteExtraida[] = [];
  const re = /(EXEQUENTE|AUTOR[A]?|REQUERENTE|IMPETRANTE|RECLAMANTE|R[ÉE]U|R[ÉE]|REQUERID[OA]|EXECUTAD[OA]|ADVOGAD[OA]\(A\)|ADVOGAD[OA])\s*\|\s*:\s*([^|\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(textoLimpo)) !== null) {
    const tipo = m[1].toUpperCase().trim();
    const conteudo = m[2].trim();
    const oabMatch = conteudo.match(/\(OAB\s+([A-Z]{2}\d+)\)/i);
    const cpfMatch = conteudo.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    const cnpjMatch = conteudo.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    const nome = conteudo
      .replace(/\(OAB\s+[A-Z]{2}\d+\)/i, '')
      .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/, '')
      .replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, '')
      .trim();
    partes.push({
      tipo,
      nome,
      oab: oabMatch?.[1],
      cpf: cpfMatch?.[1],
      cnpj: cnpjMatch?.[1],
    });
  }
  return partes;
}

interface CamadaDjenInput {
  cnj: string;
  dataInicio?: string;   // YYYY-MM-DD
  dataFim?: string;
}

/**
 * Busca comunicacoes DJEN para um CNJ.
 * Retorna padronizado conforme CamadaResult.
 * NAO depende dos demais services do AuraLOA.
 */
export const camadaEvidenciaDjen: CamadaFn = async (input, signal) => {
  const t0 = Date.now();
  const cnj = input.valor;
  const url = new URL(BASE);
  url.searchParams.set('numeroProcesso', cnj);
  // Sem filtro de data: traz tudo. Cliente pode passar contexto se quiser limitar.

  const fetchInit: RequestInit = {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal,
  };

  let resp: Response;
  let body: DJENResponse;
  try {
    resp = await fetch(url.toString(), fetchInit);
    body = await resp.json() as DJENResponse;
  } catch (e: any) {
    return {
      camada: 5,
      nome: NOME,
      ok: false,
      fonte_url: url.toString(),
      dados: {},
      evidencias: [],
      confianca: 0,
      erro: `fetch falhou: ${e?.message || String(e)}`,
      duracao_ms: Date.now() - t0,
    };
  }

  if (body.status !== 'success' || !Array.isArray(body.items)) {
    return {
      camada: 5,
      nome: NOME,
      ok: false,
      fonte_url: url.toString(),
      dados: { resposta_bruta: body },
      evidencias: [],
      confianca: 0,
      erro: body.message || `status nao success`,
      duracao_ms: Date.now() - t0,
    };
  }

  const itens = body.items.map((it) => {
    const txtLimpo = stripHtml(it.texto || '');
    const partes = extrairPartes(txtLimpo);
    return {
      id: it.id,
      data_disponibilizacao: it.data_disponibilizacao,
      tipo_documento: it.tipoDocumento,
      tipo_comunicacao: it.tipoComunicacao,
      tribunal: it.siglaTribunal,
      orgao: it.nomeOrgao,
      classe: it.nomeClasse,
      teor_limpo: txtLimpo,
      teor_html_size: it.texto?.length || 0,
      link_documento: it.link,
      destinatarios: it.destinatarios || [],
      partes_extraidas: partes,
    };
  });

  // Consolidar partes unicas (dedupe por nome+tipo)
  const partesUnicas = new Map<string, ParteExtraida>();
  for (const it of itens) {
    for (const p of it.partes_extraidas) {
      const k = `${p.tipo}|${p.nome.toLowerCase()}`;
      if (!partesUnicas.has(k)) partesUnicas.set(k, p);
    }
  }

  const evidencias: Evidencia[] = itens.slice(0, 5).map((it) => ({
    tipo: 'url',
    ref: it.link_documento || `DJEN id ${it.id}`,
    trecho: it.teor_limpo.slice(0, 400),
    data_consulta: new Date().toISOString(),
  }));

  return {
    camada: 5,
    nome: NOME,
    ok: body.count > 0,
    fonte_url: url.toString(),
    dados: {
      total_comunicacoes: body.count,
      itens,
      partes_consolidadas: Array.from(partesUnicas.values()),
    },
    evidencias,
    confianca: body.count > 0 ? Math.min(0.95, 0.5 + body.count * 0.05) : 0,
    duracao_ms: Date.now() - t0,
  };
};
