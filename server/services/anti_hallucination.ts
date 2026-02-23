import { computeSHA256 } from "./evidence_pack";

export interface HallucinationCheckResult {
  passed: boolean;
  violations: HallucinationViolation[];
  checks_performed: number;
  timestamp_iso: string;
}

export interface HallucinationViolation {
  field: string;
  value: any;
  rule: string;
  severity: "CRITICAL" | "WARNING";
  message: string;
}

const KNOWN_GOVERNMENT_DOMAINS = [
  "portaldatransparencia.gov.br",
  "dadosabertos-download.cgu.gov.br",
  "orcamento.dados.gov.br",
  "siop.planejamento.gov.br",
  "api-publica.datajud.cnj.jus.br",
  "portal.trf6.jus.br",
  "processual.trf1.jus.br",
  "eproc2g.trf6.jus.br",
  "www1.siop.planejamento.gov.br",
];

const FORBIDDEN_MOCK_PATTERNS = [
  /mock/i,
  /fake/i,
  /dummy/i,
  /placeholder_value/i,
  /test_data/i,
  /sample_data/i,
  /lorem\s*ipsum/i,
  /example\.com/i,
  /foo\s*bar/i,
  /xxx+/i,
  /12345678901234567890/,
];

export function validateNoHallucination(data: any, context: string): HallucinationCheckResult {
  const violations: HallucinationViolation[] = [];
  let checksPerformed = 0;

  checksPerformed++;
  if (data === null || data === undefined) {
    return {
      passed: true,
      violations: [],
      checks_performed: 1,
      timestamp_iso: new Date().toISOString(),
    };
  }

  const json = typeof data === "string" ? data : JSON.stringify(data);

  checksPerformed++;
  for (const pattern of FORBIDDEN_MOCK_PATTERNS) {
    if (pattern.test(json) && !/mock_data_check|mock_pattern/i.test(json)) {
      const match = json.match(pattern);
      if (match) {
        violations.push({
          field: context,
          value: match[0],
          rule: "NO_MOCK_DATA",
          severity: "CRITICAL",
          message: `Padrao de dado ficticio detectado: "${match[0]}". Todo dado deve vir de fonte governamental real.`,
        });
      }
    }
  }

  checksPerformed++;
  if (data.sources && Array.isArray(data.sources)) {
    for (const source of data.sources) {
      if (source.url) {
        const isKnown = KNOWN_GOVERNMENT_DOMAINS.some(d => source.url.includes(d));
        if (!isKnown && !source.url.startsWith("file://")) {
          violations.push({
            field: `${context}.sources`,
            value: source.url,
            rule: "KNOWN_SOURCES_ONLY",
            severity: "WARNING",
            message: `Fonte nao reconhecida: ${source.url}. Apenas fontes governamentais oficiais sao aceitas.`,
          });
        }
      }
    }
  }

  checksPerformed++;
  if (data.hashes) {
    if (!data.hashes.output_sha256 || data.hashes.output_sha256 === "PLACEHOLDER") {
      violations.push({
        field: `${context}.hashes.output_sha256`,
        value: data.hashes.output_sha256,
        rule: "VALID_HASH_REQUIRED",
        severity: "CRITICAL",
        message: "Hash SHA-256 ausente ou placeholder. Toda saida deve ter hash computado.",
      });
    }
  }

  checksPerformed++;
  if (data.data?.execucao && Array.isArray(data.data.execucao)) {
    for (const item of data.data.execucao) {
      if (item.status === "OK" && item.pago !== null && item.pago !== undefined) {
        if (!item.evidencias || item.evidencias.length === 0) {
          violations.push({
            field: `${context}.execucao.${item.codigo_acao}`,
            value: item.pago,
            rule: "VALUE_REQUIRES_EVIDENCE",
            severity: "CRITICAL",
            message: `Valor de execucao R$ ${item.pago.toFixed(2)} na acao ${item.codigo_acao} sem evidencia. Valores numericos devem ter trilha de evidencias.`,
          });
        }
      }
    }
  }

  checksPerformed++;
  if (data.data?.dotacao && Array.isArray(data.data.dotacao)) {
    for (const item of data.data.dotacao) {
      if (item.status === "OK" && item.dotacao_atual !== null) {
        if (!item.evidencias || item.evidencias.length === 0) {
          violations.push({
            field: `${context}.dotacao.${item.codigo_acao}`,
            value: item.dotacao_atual,
            rule: "VALUE_REQUIRES_EVIDENCE",
            severity: "CRITICAL",
            message: `Dotacao R$ ${item.dotacao_atual.toFixed(2)} na acao ${item.codigo_acao} sem evidencia.`,
          });
        }
      }
    }
  }

  checksPerformed++;
  if (data.processos && Array.isArray(data.processos)) {
    for (const proc of data.processos) {
      if (proc.numero_cnj) {
        const cnj = proc.numero_cnj.replace(/\D/g, "");
        if (cnj.length < 15 || cnj.length > 25) {
          violations.push({
            field: `${context}.processos.numero_cnj`,
            value: proc.numero_cnj,
            rule: "VALID_CNJ_FORMAT",
            severity: "WARNING",
            message: `Numero CNJ com formato invalido: ${proc.numero_cnj}. Esperado 20 digitos.`,
          });
        }
      }

      if (proc.valor_causa !== null && proc.valor_causa !== undefined) {
        if (proc.valor_causa < 0) {
          violations.push({
            field: `${context}.processos.valor_causa`,
            value: proc.valor_causa,
            rule: "NON_NEGATIVE_VALUES",
            severity: "CRITICAL",
            message: `Valor de causa negativo: ${proc.valor_causa}. Valores devem ser nao-negativos.`,
          });
        }
        if (proc.valor_causa > 1e12) {
          violations.push({
            field: `${context}.processos.valor_causa`,
            value: proc.valor_causa,
            rule: "REASONABLE_VALUE_RANGE",
            severity: "WARNING",
            message: `Valor de causa extremamente alto: R$ ${proc.valor_causa.toFixed(2)}. Verificar se nao ha erro.`,
          });
        }
      }
    }
  }

  checksPerformed++;
  const statusFields = extractField(data, "status_geral");
  for (const sf of statusFields) {
    if (!["OK", "PARCIAL", "NAO_LOCALIZADO"].includes(sf.value)) {
      violations.push({
        field: sf.path,
        value: sf.value,
        rule: "VALID_STATUS",
        severity: "WARNING",
        message: `Status invalido: "${sf.value}". Valores aceitos: OK, PARCIAL, NAO_LOCALIZADO.`,
      });
    }
  }

  const hasCritical = violations.some(v => v.severity === "CRITICAL");

  return {
    passed: !hasCritical,
    violations,
    checks_performed: checksPerformed,
    timestamp_iso: new Date().toISOString(),
  };
}

function extractField(obj: any, fieldName: string, currentPath: string = ""): { path: string; value: any }[] {
  const results: { path: string; value: any }[] = [];
  if (!obj || typeof obj !== "object") return results;

  for (const [key, value] of Object.entries(obj)) {
    const path = currentPath ? `${currentPath}.${key}` : key;
    if (key === fieldName) {
      results.push({ path, value });
    }
    if (typeof value === "object" && value !== null) {
      results.push(...extractField(value, fieldName, path));
    }
  }
  return results;
}

export function validateSourceURL(url: string): { valid: boolean; domain: string; message: string } {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    const isKnown = KNOWN_GOVERNMENT_DOMAINS.some(d => domain.includes(d) || d.includes(domain));
    return {
      valid: isKnown,
      domain,
      message: isKnown ? "Fonte governamental oficial reconhecida" : `Dominio ${domain} nao esta na lista de fontes oficiais`,
    };
  } catch {
    return { valid: false, domain: "", message: "URL invalida" };
  }
}

export function getKnownDomains(): string[] {
  return [...KNOWN_GOVERNMENT_DOMAINS];
}
