/**
 * Contact Enrichment Service — FASE 7.5 do Pipeline DD
 *
 * Raspagem de dados públicos de sócios e advogados para contato comercial.
 * Busca: CPF, telefone, email, LinkedIn, site pessoal/escritório jurídico.
 *
 * ⚠️ REGRA (Marcos, 14/04/2026):
 * Se encontrar 10 sócios ou advogados, buscar dados dos 10. TODOS.
 * Este campo NUNCA pode passar sem a devida atenção.
 * Contato com credor é PRIMORDIAL para negociar compra do precatório.
 *
 * Fontes públicas (raspagem):
 * 1. BrasilAPI — QSA (sócios com CPF)
 * 2. CNPJ.ws — QSA detalhado + endereço filiais
 * 3. CNA/OAB — Validação OAB (nome, nº, seccional, status)
 * 4. Google CSE — "nome + advogado + contato" → site escritório
 * 5. Escavador — perfis públicos (processos, OAB, empresas)
 * 6. Jusbrasil — diretório de advogados (perfil público)
 */

const BRASILAPI_BASE = "https://brasilapi.com.br/api";
const CNPJWS_BASE = "https://publica.cnpj.ws/cnpj";

// ── Types ────────────────────────────────────────────────────────────────

export interface ContactPerson {
  nome: string;
  tipo: "socio" | "advogado" | "representante";
  cpf_cnpj: string | null;
  qualificacao: string | null;
  data_entrada: string | null;

  // Dados enriquecidos (raspagem)
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
  site_pessoal: string | null;
  site_escritorio: string | null;
  oab_numero: string | null;
  oab_seccional: string | null;
  oab_status: string | null;

  // Metadados de busca
  fontes_consultadas: string[];
  dados_confirmados: boolean;
  ultima_verificacao: string;
}

export interface ContactEnrichmentResult {
  cnpj: string;
  razao_social: string | null;
  total_pessoas: number;
  total_com_contato: number;
  socios: ContactPerson[];
  advogados: ContactPerson[];
  score_cobertura: number; // 0-100: % de pessoas com ao menos 1 contato
  alertas: string[];
  timestamp: string;
}

// ── Fetch Helper ─────────────────────────────────────────────────────────

async function safeFetch(url: string, options?: RequestInit): Promise<any | null> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": "AuraLOA/1.0 (Due Diligence Pipeline)",
        "Accept": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ── Fonte 1: BrasilAPI (Receita Federal — QSA) ──────────────────────────

async function fetchQSA_BrasilAPI(cnpj: string): Promise<ContactPerson[]> {
  const digits = cnpj.replace(/\D/g, "");
  const data = await safeFetch(`${BRASILAPI_BASE}/cnpj/v1/${digits}`);
  if (!data?.qsa) return [];

  return data.qsa.map((s: any) => ({
    nome: s.nome_socio || "",
    tipo: "socio" as const,
    cpf_cnpj: s.cnpj_cpf_do_socio || null,
    qualificacao: s.qualificacao_socio || null,
    data_entrada: s.data_entrada_sociedade || null,
    email: null,
    telefone: null,
    linkedin_url: null,
    site_pessoal: null,
    site_escritorio: null,
    oab_numero: null,
    oab_seccional: null,
    oab_status: null,
    fontes_consultadas: ["brasilapi_receita_federal"],
    dados_confirmados: true,
    ultima_verificacao: new Date().toISOString(),
  }));
}

// ── Fonte 2: CNPJ.ws (QSA + contato empresa) ────────────────────────────

async function fetchQSA_CNPJWS(cnpj: string): Promise<{
  socios: ContactPerson[];
  email_empresa: string | null;
  telefone_empresa: string | null;
}> {
  const digits = cnpj.replace(/\D/g, "");
  const data = await safeFetch(`${CNPJWS_BASE}/${digits}`);
  if (!data) return { socios: [], email_empresa: null, telefone_empresa: null };

  const socios: ContactPerson[] = (data.socios || []).map((s: any) => ({
    nome: s.nome || "",
    tipo: "socio" as const,
    cpf_cnpj: s.cpf_cnpj || null,
    qualificacao: s.qualificacao?.descricao || null,
    data_entrada: s.data_entrada || null,
    email: null,
    telefone: null,
    linkedin_url: null,
    site_pessoal: null,
    site_escritorio: null,
    oab_numero: null,
    oab_seccional: null,
    oab_status: null,
    fontes_consultadas: ["cnpjws"],
    dados_confirmados: true,
    ultima_verificacao: new Date().toISOString(),
  }));

  return {
    socios,
    email_empresa: data.estabelecimento?.email || null,
    telefone_empresa: data.estabelecimento?.ddd1
      ? `(${data.estabelecimento.ddd1}) ${data.estabelecimento.telefone1}`
      : null,
  };
}

// ── Fonte 3: Serper.dev (Google results via API — sem setup Cloud) ──────

/**
 * Busca dados de contato via Serper.dev (Google Search API).
 * Requer SERPER_API_KEY no .env
 *
 * Por que Serper em vez de Google CSE:
 * - Não precisa criar/ativar API no Google Cloud Console
 * - 2.500 buscas grátis, depois $0.001/query
 * - Retorna resultados idênticos ao Google (mesmo índice)
 * - Setup: 1 API key, sem projeto, sem CX
 *
 * Queries inteligentes:
 * - "João Silva advogado OAB email telefone"
 * - "João Silva sócio EMPRESA linkedin"
 */
export async function searchGoogleContacts(
  nome: string,
  contexto: string,
): Promise<{
  linkedin_url: string | null;
  site: string | null;
  email_encontrado: string | null;
  telefone_encontrado: string | null;
  snippets: string[];
}> {
  const key = process.env.SERPER_API_KEY;
  if (!key) {
    return { linkedin_url: null, site: null, email_encontrado: null, telefone_encontrado: null, snippets: [] };
  }

  const query = `"${nome}" ${contexto} contato email telefone`;

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 10, gl: "br", hl: "pt-br" }),
    });

    if (!response.ok) {
      return { linkedin_url: null, site: null, email_encontrado: null, telefone_encontrado: null, snippets: [] };
    }

    const data = await response.json();
    const items: any[] = data.organic || [];

    let linkedin_url: string | null = null;
    let site: string | null = null;
    let email_encontrado: string | null = null;
    let telefone_encontrado: string | null = null;
    const snippets: string[] = [];

    for (const item of items) {
      const link: string = item.link || "";
      const snippet: string = item.snippet || "";

      // LinkedIn — prioriza perfil brasileiro
      if (!linkedin_url && link.includes("linkedin.com/in/")) {
        linkedin_url = link;
      }

      // Site de escritório jurídico
      if (!site && (link.includes("adv.br") || link.includes("advocacia") || link.includes("advogados"))) {
        site = link;
      }

      // Email no snippet
      if (!email_encontrado) {
        const emailMatch = snippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) email_encontrado = emailMatch[0].toLowerCase();
      }

      // Telefone no snippet — formato (XX) XXXXX-XXXX ou similar
      if (!telefone_encontrado) {
        const telMatch = snippet.match(/\(?(\d{2})\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/);
        if (telMatch) telefone_encontrado = telMatch[0];
      }

      snippets.push(snippet.slice(0, 200));
    }

    return { linkedin_url, site, email_encontrado, telefone_encontrado, snippets };
  } catch {
    return { linkedin_url: null, site: null, email_encontrado: null, telefone_encontrado: null, snippets: [] };
  }
}

// ── Fonte 4: OAB (Conselho Nacional — validação) ────────────────────────

/**
 * Verifica se nome é advogado no CNA/OAB.
 * CNA: https://cna.oab.org.br — sem API pública, usa busca web.
 * Para automação real, usar Playwright em cna.oab.org.br.
 *
 * Por enquanto: marca como pendente de verificação OAB.
 */
export function buildOABSearchURL(nome: string): string {
  return `https://cna.oab.org.br/resultadodapesquisa.aspx?nome=${encodeURIComponent(nome)}`;
}

// ── Pipeline: Enriquecimento Completo de Contatos ────────────────────────

/**
 * Pipeline completo de enriquecimento de contatos.
 * Dado um CNPJ, busca TODOS os sócios e advogados disponíveis
 * e tenta obter contato de CADA UM deles.
 *
 * ⚠️ REGRA: Se encontrar 10 nomes, busca dados dos 10.
 * NUNCA pular ou ignorar pessoas na lista.
 */
export async function enrichContacts(params: {
  cnpj: string;
  advogados_conhecidos?: Array<{ nome: string; oab?: string }>;
  razao_social?: string;
}): Promise<ContactEnrichmentResult> {
  const result: ContactEnrichmentResult = {
    cnpj: params.cnpj,
    razao_social: params.razao_social || null,
    total_pessoas: 0,
    total_com_contato: 0,
    socios: [],
    advogados: [],
    score_cobertura: 0,
    alertas: [],
    timestamp: new Date().toISOString(),
  };

  // ── PASSO 1: Coletar QSA de múltiplas fontes ──

  const [qsaBrasil, qsaCNPJWS] = await Promise.all([
    fetchQSA_BrasilAPI(params.cnpj),
    fetchQSA_CNPJWS(params.cnpj),
  ]);

  // Merge: BrasilAPI como base, CNPJ.ws como complemento
  const sociosMap = new Map<string, ContactPerson>();

  for (const s of qsaBrasil) {
    sociosMap.set(s.nome.toUpperCase().trim(), s);
  }

  for (const s of qsaCNPJWS.socios) {
    const key = s.nome.toUpperCase().trim();
    if (sociosMap.has(key)) {
      const existing = sociosMap.get(key)!;
      // Merge: preenche campos vazios
      if (!existing.cpf_cnpj && s.cpf_cnpj) existing.cpf_cnpj = s.cpf_cnpj;
      if (!existing.qualificacao && s.qualificacao) existing.qualificacao = s.qualificacao;
      existing.fontes_consultadas.push("cnpjws");
    } else {
      s.fontes_consultadas.push("cnpjws");
      sociosMap.set(key, s);
    }
  }

  result.socios = Array.from(sociosMap.values());

  // Se a empresa tem email/telefone, adicionar como fallback
  if (qsaCNPJWS.email_empresa) {
    result.alertas.push(`Email da empresa encontrado: ${qsaCNPJWS.email_empresa}`);
  }
  if (qsaCNPJWS.telefone_empresa) {
    result.alertas.push(`Telefone da empresa encontrado: ${qsaCNPJWS.telefone_empresa}`);
  }

  // ── PASSO 2: Advogados conhecidos ──

  if (params.advogados_conhecidos) {
    for (const adv of params.advogados_conhecidos) {
      const contact: ContactPerson = {
        nome: adv.nome,
        tipo: "advogado",
        cpf_cnpj: null,
        qualificacao: "Advogado",
        data_entrada: null,
        email: null,
        telefone: null,
        linkedin_url: null,
        site_pessoal: null,
        site_escritorio: null,
        oab_numero: adv.oab || null,
        oab_seccional: null,
        oab_status: null,
        fontes_consultadas: ["processo_judicial"],
        dados_confirmados: true,
        ultima_verificacao: new Date().toISOString(),
      };
      result.advogados.push(contact);
    }
  }

  // ── PASSO 3: Enriquecer CADA pessoa via Google CSE ──
  // ⚠️ REGRA: buscar dados de TODOS, sem exceção

  const allPeople = [...result.socios, ...result.advogados];

  for (const person of allPeople) {
    const contexto = person.tipo === "advogado"
      ? `advogado OAB ${person.oab_numero || ""} escritório`
      : `sócio ${params.razao_social || ""} empresa`;

    const googleResult = await searchGoogleContacts(person.nome, contexto);

    if (googleResult.linkedin_url) person.linkedin_url = googleResult.linkedin_url;
    if (googleResult.email_encontrado) person.email = googleResult.email_encontrado;
    if (googleResult.telefone_encontrado) person.telefone = googleResult.telefone_encontrado;
    if (googleResult.site) {
      if (person.tipo === "advogado") {
        person.site_escritorio = googleResult.site;
      } else {
        person.site_pessoal = googleResult.site;
      }
    }
    if (googleResult.linkedin_url || googleResult.email_encontrado || googleResult.site || googleResult.telefone_encontrado) {
      person.fontes_consultadas.push("serper_google");
    }

    // Rate limit: 100ms entre buscas para não estourar quota Google
    await new Promise((r) => setTimeout(r, 100));
  }

  // ── PASSO 4: Métricas e alertas ──

  result.total_pessoas = allPeople.length;
  result.total_com_contato = allPeople.filter(
    (p) => p.email || p.telefone || p.linkedin_url || p.site_pessoal || p.site_escritorio,
  ).length;
  result.score_cobertura = result.total_pessoas > 0
    ? Math.round((result.total_com_contato / result.total_pessoas) * 100)
    : 0;

  // Alertas para pessoas sem contato
  const semContato = allPeople.filter(
    (p) => !p.email && !p.telefone && !p.linkedin_url && !p.site_pessoal && !p.site_escritorio,
  );
  if (semContato.length > 0) {
    result.alertas.push(
      `⚠️ ${semContato.length} pessoa(s) SEM nenhum dado de contato: ${semContato.map((p) => p.nome).join(", ")}`,
    );
    result.alertas.push(
      "Ação recomendada: buscar manualmente no LinkedIn, OAB seccional, ou Google por nome + cidade",
    );
  }

  if (result.socios.length === 0 && result.advogados.length === 0) {
    result.alertas.push("CRÍTICO: Nenhum sócio ou advogado encontrado. Verificar CNPJ e fontes.");
  }

  return result;
}

// ── Formatação para relatório ────────────────────────────────────────────

export function formatContactSummary(data: ContactEnrichmentResult): string {
  const lines: string[] = [];
  lines.push(`=== Enriquecimento de Contatos (${data.timestamp}) ===`);
  lines.push(`CNPJ: ${data.cnpj} | ${data.razao_social || ""}`);
  lines.push(`Score Cobertura: ${data.score_cobertura}% (${data.total_com_contato}/${data.total_pessoas} com contato)\n`);

  if (data.socios.length > 0) {
    lines.push(`SÓCIOS (${data.socios.length}):`);
    for (const s of data.socios) {
      lines.push(`  ${s.nome}`);
      lines.push(`    CPF/CNPJ: ${s.cpf_cnpj || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Qualificação: ${s.qualificacao || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Email: ${s.email || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Telefone: ${s.telefone || "[NÃO ENCONTRADO]"}`);
      lines.push(`    LinkedIn: ${s.linkedin_url || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Site: ${s.site_pessoal || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Fontes: ${s.fontes_consultadas.join(", ")}`);
      lines.push("");
    }
  }

  if (data.advogados.length > 0) {
    lines.push(`ADVOGADOS (${data.advogados.length}):`);
    for (const a of data.advogados) {
      lines.push(`  ${a.nome}`);
      lines.push(`    OAB: ${a.oab_numero || "[NÃO ENCONTRADO]"} ${a.oab_seccional || ""}`);
      lines.push(`    Email: ${a.email || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Telefone: ${a.telefone || "[NÃO ENCONTRADO]"}`);
      lines.push(`    LinkedIn: ${a.linkedin_url || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Escritório: ${a.site_escritorio || "[NÃO ENCONTRADO]"}`);
      lines.push(`    Fontes: ${a.fontes_consultadas.join(", ")}`);
      lines.push("");
    }
  }

  if (data.alertas.length > 0) {
    lines.push("ALERTAS:");
    for (const a of data.alertas) {
      lines.push(`  ${a}`);
    }
  }

  return lines.join("\n");
}
