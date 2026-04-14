/**
 * Apollo.io Enrichment Service + Receita Federal (BrasilAPI)
 * Enriquecimento de dados de contato via Apollo.io REST API
 * + situação cadastral CNPJ via BrasilAPI (Receita Federal).
 *
 * Usado no pipeline de Due Diligence para obter dados de credores,
 * advogados e sócios de precatórios extraídos do Portal da Transparência.
 *
 * ⚠️ REGRA DE USO (Marcos, 14/04/2026):
 * Apollo entra no pipeline assim que o CNPJ do credor é identificado.
 * Sequência: LOA → identifica credor → CNPJ → Apollo + Receita Federal.
 * NÃO acionar Apollo antes de ter o CNPJ do credor confirmado.
 *
 * Apollo API Docs: https://docs.apollo.io/reference/introduction
 * BrasilAPI Docs: https://brasilapi.com.br/docs
 * Rate limit Apollo: 600 req/hora
 */

const APOLLO_BASE = "https://api.apollo.io/api/v1";
const BRASILAPI_BASE = "https://brasilapi.com.br/api";

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    throw new Error(
      "[apollo_enrichment] APOLLO_API_KEY não configurada no .env. " +
      "Obtenha em: Apollo.io → Settings → Integrations → API Keys"
    );
  }
  return key;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface ApolloPersonResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  title: string | null;
  headline: string | null;
  email: string | null;
  email_status: string | null;
  phone_numbers: Array<{ raw_number: string; type: string }>;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  organization: {
    id: string | null;
    name: string | null;
    website_url: string | null;
    linkedin_url: string | null;
    industry: string | null;
  } | null;
  seniority: string | null;
  departments: string[];
  employment_history: Array<{
    title: string | null;
    organization_name: string | null;
    start_date: string | null;
    end_date: string | null;
    current: boolean;
  }>;
}

export interface ApolloOrgResult {
  id: string;
  name: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  phone: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  annual_revenue: number | null;
  annual_revenue_printed: string | null;
  total_funding: number | null;
  total_funding_printed: string | null;
  founded_year: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  raw_address: string | null;
  current_technologies: string[];
  keywords: string[];
}

// ── Receita Federal (BrasilAPI) ──────────────────────────────────────────

export interface CNPJData {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;        // "ATIVA", "INAPTA", "SUSPENSA", "BAIXADA", "NULA"
  descricao_situacao_cadastral: string | null;
  data_situacao_cadastral: string | null;
  motivo_situacao_cadastral: string | null;
  situacao_especial: string | null;         // "EM RECUPERACAO JUDICIAL", etc.
  data_situacao_especial: string | null;
  natureza_juridica: string | null;
  porte: string | null;                     // "ME", "EPP", "DEMAIS"
  capital_social: number | null;
  data_inicio_atividade: string | null;
  cnae_fiscal: number | null;
  cnae_fiscal_descricao: string | null;
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  ddd_telefone_1: string | null;
  ddd_telefone_2: string | null;
  email: string | null;
  qsa: Array<{
    nome_socio: string;
    cnpj_cpf_do_socio: string;
    qualificacao_socio: string;
    data_entrada_sociedade: string | null;
    faixa_etaria: string | null;
  }>;
}

export type StatusEmpresa =
  | "ATIVA"
  | "INAPTA"
  | "SUSPENSA"
  | "BAIXADA"
  | "NULA"
  | "EM RECUPERAÇÃO JUDICIAL"
  | "EM LIQUIDAÇÃO EXTRAJUDICIAL"
  | "FALIDA"
  | "DESCONHECIDO";

export interface EnrichmentResult {
  source: "apollo.io + receita_federal";
  timestamp: string;
  cnpj_data?: CNPJData;
  status_empresa?: StatusEmpresa;
  pessoa?: ApolloPersonResult;
  organizacao?: ApolloOrgResult;
  socios?: ApolloPersonResult[];
  advogados?: ApolloPersonResult[];
  raw_response?: any;
  error?: string;
}

// ── CNPJ Lookup (BrasilAPI / Receita Federal) ────────────────────────────

/**
 * Consulta CNPJ na Receita Federal via BrasilAPI.
 * Retorna situação cadastral, situação especial (recuperação judicial),
 * quadro societário (QSA), endereço, telefone, email e atividade.
 */
export async function consultarCNPJ(cnpj: string): Promise<CNPJData | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;

  try {
    const response = await fetch(`${BRASILAPI_BASE}/cnpj/v1/${digits}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      const text = await response.text();
      throw new Error(`BrasilAPI CNPJ HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    return await response.json();
  } catch (err: any) {
    console.error(`[apollo_enrichment] consultarCNPJ(${digits}): ${err.message}`);
    return null;
  }
}

/**
 * Determina o status consolidado da empresa a partir dos dados da Receita.
 * Prioriza situação especial (recuperação judicial, liquidação) sobre situação cadastral.
 */
export function determinarStatusEmpresa(cnpjData: CNPJData): StatusEmpresa {
  // Situação especial tem prioridade (recuperação judicial, liquidação, etc.)
  if (cnpjData.situacao_especial) {
    const especial = cnpjData.situacao_especial.toUpperCase().trim();
    if (especial.includes("RECUPERA")) return "EM RECUPERAÇÃO JUDICIAL";
    if (especial.includes("LIQUIDA")) return "EM LIQUIDAÇÃO EXTRAJUDICIAL";
    if (especial.includes("FAL")) return "FALIDA";
  }

  // Situação cadastral padrão
  const situacao = (cnpjData.descricao_situacao_cadastral || cnpjData.situacao_cadastral || "")
    .toUpperCase()
    .trim();

  if (situacao.includes("ATIVA")) return "ATIVA";
  if (situacao.includes("INAPTA")) return "INAPTA";
  if (situacao.includes("SUSPENSA")) return "SUSPENSA";
  if (situacao.includes("BAIXADA")) return "BAIXADA";
  if (situacao.includes("NULA")) return "NULA";

  return "DESCONHECIDO";
}

// ── HTTP Helper ──────────────────────────────────────────────────────────

async function apolloRequest(
  method: "GET" | "POST",
  endpoint: string,
  params?: Record<string, any>,
  body?: Record<string, any>,
): Promise<any> {
  const apiKey = getApiKey();
  const url = new URL(`${APOLLO_BASE}${endpoint}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: method === "POST" && body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `[apollo] ${method} ${endpoint} → HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }

  return response.json();
}

// ── People Enrichment ────────────────────────────────────────────────────

/**
 * Enriquece uma pessoa por email, nome + domínio, ou nome + empresa.
 * Retorna dados de contato, cargo, LinkedIn, telefone.
 */
export async function enrichPerson(params: {
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  domain?: string;
  organization_name?: string;
  reveal_personal_emails?: boolean;
  reveal_phone_number?: boolean;
}): Promise<ApolloPersonResult | null> {
  const queryParams: Record<string, any> = {};

  if (params.email) queryParams.email = params.email;
  if (params.first_name) queryParams.first_name = params.first_name;
  if (params.last_name) queryParams.last_name = params.last_name;
  if (params.name) queryParams.name = params.name;
  if (params.domain) queryParams.domain = params.domain;
  if (params.organization_name) queryParams.organization_name = params.organization_name;
  if (params.reveal_personal_emails) queryParams.reveal_personal_emails = true;
  if (params.reveal_phone_number) queryParams.reveal_phone_number = true;

  const data = await apolloRequest("GET", "/people/match", queryParams);
  return data?.person || null;
}

// ── Organization Enrichment ──────────────────────────────────────────────

/**
 * Enriquece uma organização pelo domínio do site.
 * Retorna endereço, telefone, LinkedIn, setor, receita, etc.
 */
export async function enrichOrganization(
  domain: string,
): Promise<ApolloOrgResult | null> {
  const data = await apolloRequest("GET", "/organizations/enrich", { domain });
  return data?.organization || null;
}

// ── People Search ────────────────────────────────────────────────────────

/**
 * Busca pessoas por empresa (domínio), cargo, senioridade.
 * Útil para encontrar sócios, advogados, diretores.
 */
export async function searchPeople(params: {
  q_organization_domains_list?: string[];
  organization_name?: string;
  person_titles?: string[];
  person_seniorities?: string[];
  page?: number;
  per_page?: number;
}): Promise<{ people: ApolloPersonResult[]; total: number }> {
  const body: Record<string, any> = {
    page: params.page || 1,
    per_page: params.per_page || 25,
  };

  if (params.q_organization_domains_list) {
    body.q_organization_domains_list = params.q_organization_domains_list;
  }
  if (params.organization_name) {
    body.q_organization_name = params.organization_name;
  }
  if (params.person_titles) body.person_titles = params.person_titles;
  if (params.person_seniorities) body.person_seniorities = params.person_seniorities;

  const data = await apolloRequest("POST", "/mixed_people/search", undefined, body);
  return {
    people: data?.people || [],
    total: data?.pagination?.total_entries || 0,
  };
}

// ── Organization Search ──────────────────────────────────────────────────

/**
 * Busca organizações por nome, domínio, localização.
 */
export async function searchOrganizations(params: {
  q_organization_name?: string;
  q_organization_domains_list?: string[];
  organization_locations?: string[];
  page?: number;
  per_page?: number;
}): Promise<{ organizations: ApolloOrgResult[]; total: number }> {
  const body: Record<string, any> = {
    page: params.page || 1,
    per_page: params.per_page || 25,
  };

  if (params.q_organization_name) body.q_organization_name = params.q_organization_name;
  if (params.q_organization_domains_list) {
    body.q_organization_domains_list = params.q_organization_domains_list;
  }
  if (params.organization_locations) body.organization_locations = params.organization_locations;

  const data = await apolloRequest("POST", "/mixed_companies/search", undefined, body);
  return {
    organizations: data?.organizations || [],
    total: data?.pagination?.total_entries || 0,
  };
}

// ── Pipeline: Enriquecimento Completo ────────────────────────────────────

/**
 * Enriquecimento completo para o pipeline de Due Diligence.
 * Dado um nome de empresa ou domínio, busca:
 * 1. Dados da organização (endereço, telefone, LinkedIn, site)
 * 2. Sócios/diretores (C-level, owners, founders)
 * 3. Advogados (se houver departamento jurídico)
 *
 * Retorna tudo consolidado em um EnrichmentResult.
 */
export async function enrichFullEntity(params: {
  cnpj?: string;
  company_name?: string;
  company_domain?: string;
  person_name?: string;
  person_email?: string;
}): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    source: "apollo.io + receita_federal",
    timestamp: new Date().toISOString(),
  };

  try {
    // 0. Se temos CNPJ, consultar Receita Federal (BrasilAPI)
    //    Isso dá: situação cadastral, QSA, endereço, telefone, email, atividade
    if (params.cnpj) {
      const cnpjData = await consultarCNPJ(params.cnpj);
      if (cnpjData) {
        result.cnpj_data = cnpjData;
        result.status_empresa = determinarStatusEmpresa(cnpjData);

        // Usar dados da Receita para preencher lacunas
        if (!params.company_name && cnpjData.razao_social) {
          params.company_name = cnpjData.razao_social;
        }
      }
    }

    // 1. Se temos domínio, enriquecer organização via Apollo
    if (params.company_domain) {
      result.organizacao = (await enrichOrganization(params.company_domain)) || undefined;
    }

    // 2. Se temos nome de empresa ou domínio, buscar sócios/diretores
    const domains = params.company_domain ? [params.company_domain] : undefined;
    if (domains || params.company_name) {
      const sociosSearch = await searchPeople({
        q_organization_domains_list: domains,
        organization_name: params.company_name,
        person_seniorities: ["owner", "founder", "c_suite", "partner", "vp", "director"],
        per_page: 10,
      });
      result.socios = sociosSearch.people;

      // 3. Buscar advogados / jurídico
      const advSearch = await searchPeople({
        q_organization_domains_list: domains,
        organization_name: params.company_name,
        person_titles: ["advogado", "lawyer", "attorney", "jurídico", "legal", "OAB"],
        per_page: 10,
      });
      result.advogados = advSearch.people;
    }

    // 4. Se temos pessoa específica, enriquecer
    if (params.person_name || params.person_email) {
      result.pessoa = (await enrichPerson({
        name: params.person_name,
        email: params.person_email,
        domain: params.company_domain,
        organization_name: params.company_name,
        reveal_personal_emails: true,
        reveal_phone_number: true,
      })) || undefined;
    }
  } catch (err: any) {
    result.error = err.message;
  }

  return result;
}

// ── Formatação para relatório ────────────────────────────────────────────

/**
 * Formata os dados do Apollo em um resumo legível para relatórios.
 */
export function formatEnrichmentSummary(data: EnrichmentResult): string {
  const lines: string[] = [];
  lines.push(`=== Enriquecimento Apollo.io + Receita Federal (${data.timestamp}) ===\n`);

  if (data.error) {
    lines.push(`ERRO: ${data.error}\n`);
    return lines.join("\n");
  }

  // Status da empresa (Receita Federal)
  if (data.cnpj_data) {
    const rf = data.cnpj_data;
    const statusColor = data.status_empresa === "ATIVA" ? "OK"
      : data.status_empresa === "EM RECUPERAÇÃO JUDICIAL" ? "ALERTA ALTO"
      : data.status_empresa === "FALIDA" ? "CRÍTICO"
      : data.status_empresa === "BAIXADA" ? "INATIVA"
      : "ATENÇÃO";

    lines.push("RECEITA FEDERAL (CNPJ):");
    lines.push(`  CNPJ: ${rf.cnpj}`);
    lines.push(`  Razão Social: ${rf.razao_social || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Nome Fantasia: ${rf.nome_fantasia || "[NÃO INFORMADO]"}`);
    lines.push(`  STATUS: ${data.status_empresa} [${statusColor}]`);
    if (rf.situacao_especial) {
      lines.push(`  Situação Especial: ${rf.situacao_especial} (desde ${rf.data_situacao_especial || "?"})`);
    }
    if (rf.motivo_situacao_cadastral) {
      lines.push(`  Motivo: ${rf.motivo_situacao_cadastral}`);
    }
    lines.push(`  Natureza Jurídica: ${rf.natureza_juridica || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Porte: ${rf.porte || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Capital Social: ${rf.capital_social ? `R$ ${rf.capital_social.toLocaleString("pt-BR")}` : "[NÃO ENCONTRADO]"}`);
    lines.push(`  Início Atividade: ${rf.data_inicio_atividade || "[NÃO ENCONTRADO]"}`);
    lines.push(`  CNAE: ${rf.cnae_fiscal_descricao || "[NÃO ENCONTRADO]"} (${rf.cnae_fiscal || ""})`);
    const endereco = [rf.logradouro, rf.numero, rf.complemento, rf.bairro, rf.municipio, rf.uf, rf.cep]
      .filter(Boolean).join(", ");
    lines.push(`  Endereço: ${endereco || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Telefone 1: ${rf.ddd_telefone_1 || "[NÃO ENCONTRADO]"}`);
    if (rf.ddd_telefone_2) lines.push(`  Telefone 2: ${rf.ddd_telefone_2}`);
    lines.push(`  Email: ${rf.email || "[NÃO ENCONTRADO]"}`);

    // Quadro societário (QSA) da Receita
    if (rf.qsa?.length) {
      lines.push(`  QUADRO SOCIETÁRIO (${rf.qsa.length} sócios):`);
      for (const s of rf.qsa) {
        lines.push(`    - ${s.nome_socio} | CPF/CNPJ: ${s.cnpj_cpf_do_socio || "?"} | ${s.qualificacao_socio} | Entrada: ${s.data_entrada_sociedade || "?"}`);
      }
    }
    lines.push("");
  }

  // Organização (Apollo)
  if (data.organizacao) {
    const org = data.organizacao;
    lines.push("ORGANIZAÇÃO (Apollo.io):");
    lines.push(`  Nome: ${org.name || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Site: ${org.website_url || "[NÃO ENCONTRADO]"}`);
    lines.push(`  LinkedIn: ${org.linkedin_url || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Telefone: ${org.phone || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Endereço: ${org.raw_address || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Setor: ${org.industry || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Funcionários: ${org.estimated_num_employees ?? "[NÃO ENCONTRADO]"}`);
    lines.push(`  Receita: ${org.annual_revenue_printed || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Fundação: ${org.founded_year ?? "[NÃO ENCONTRADO]"}`);
    lines.push("");
  }

  // Pessoa específica
  if (data.pessoa) {
    const p = data.pessoa;
    lines.push("PESSOA:");
    lines.push(`  Nome: ${p.name || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Cargo: ${p.title || "[NÃO ENCONTRADO]"}`);
    lines.push(`  Email: ${p.email || "[NÃO ENCONTRADO]"}`);
    lines.push(`  LinkedIn: ${p.linkedin_url || "[NÃO ENCONTRADO]"}`);
    if (p.phone_numbers?.length) {
      lines.push(`  Telefones: ${p.phone_numbers.map((ph) => ph.raw_number).join(", ")}`);
    }
    lines.push(`  Localização: ${[p.city, p.state, p.country].filter(Boolean).join(", ") || "[NÃO ENCONTRADO]"}`);
    lines.push("");
  }

  // Sócios
  if (data.socios?.length) {
    lines.push(`SÓCIOS / DIRETORES (${data.socios.length}):`);
    for (const s of data.socios) {
      const phones = s.phone_numbers?.map((ph) => ph.raw_number).join(", ") || "";
      lines.push(`  - ${s.name || "?"} | ${s.title || "?"} | ${s.email || "?"} | ${s.linkedin_url || ""} ${phones ? `| Tel: ${phones}` : ""}`);
    }
    lines.push("");
  }

  // Advogados
  if (data.advogados?.length) {
    lines.push(`ADVOGADOS / JURÍDICO (${data.advogados.length}):`);
    for (const a of data.advogados) {
      const phones = a.phone_numbers?.map((ph) => ph.raw_number).join(", ") || "";
      lines.push(`  - ${a.name || "?"} | ${a.title || "?"} | ${a.email || "?"} | ${a.linkedin_url || ""} ${phones ? `| Tel: ${phones}` : ""}`);
    }
    lines.push("");
  }

  if (!data.cnpj_data && !data.organizacao && !data.pessoa && !data.socios?.length && !data.advogados?.length) {
    lines.push("[NENHUM RESULTADO ENCONTRADO]");
  }

  return lines.join("\n");
}
