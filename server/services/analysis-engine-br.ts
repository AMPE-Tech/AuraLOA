import { createHash } from "crypto";

const SCHEMA_VERSION = "auraloa.br_heuristics.v1.0";

const SEVERITY_WEIGHT: Record<string, number> = {
  low: 1,
  medium: 5,
  high: 15,
  critical: 20,
};

export interface BRFinding {
  ruleId: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  found: boolean;
}

export interface BRAnalysisResult {
  schemaVersion: string;
  score: number;
  status: "APROVADO" | "VERIFICAR" | "SUSPEITO";
  statusLabel: string;
  statusColor: "green" | "yellow" | "red";
  findings: BRFinding[];
  extracted: {
    numero_cnj: string | null;
    numero_oficio: string | null;
    tribunal: string | null;
    juiz_assinante: string | null;
    credor_nome: string | null;
    credor_cpf_cnpj: string | null;
    devedor: string | null;
    valor_rs: string | null;
    data_transito: string | null;
    url_verificacao: string | null;
    codigo_verificador: string | null;
    tem_qrcode: boolean;
    tem_assinatura_digital: boolean;
  };
  sha256: string;
}

// ─── Extração de campos ───────────────────────────────────────────────────────

function extrairCNJ(text: string): string | null {
  // Normaliza espaços dentro de possíveis números de processo
  const normalizado = text.replace(/(\d{7})-\s+(\d{2})/g, "$1-$2");

  const padroes = [
    // CNJ moderno e estadual (sem word boundary)
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2,3}\.\d{4})/,
    // Com barra
    /(\d{7}\/\d{2}\.\d{4}\.\d\.\d{2,3}\.\d{4})/,
    // Após "Processo" com texto intermediário
    /[Pp]rocesso[^:]{0,40}:?\s*n?[ºo°]?\s*([0-9]{7}[-][0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2,3}\.[0-9]{4})/i,
    // Formato ponto no lugar do hífen
    /(\d{7}\.\d{2}\.\d{4}\.\d\.\d{2,3}\.\d{4})/,
  ];

  for (const p of padroes) {
    const m = p.exec(normalizado);
    if (m) {
      const cnj = (m[1] || m[0]).replace("/", "-").trim();
      if (cnj.replace(/\D/g, "").length >= 18) return cnj;
    }
  }
  return null;
}

function extrairOficio(text: string): string | null {
  const padroes = [
    // Ofício Requisitório Nº XXX/AAAA
    /Of[íi]cio\s+Requisit[óo]rio\s+N[ºo°]?\s*([A-Z0-9\/\.\-]+)/i,
    // Ofício de Requisição de Precatório Nº XXX/AAAA
    /Of[íi]cio\s+de\s+Requisi[çc][ãa]o\s+de\s+Precat[óo]rio\s+N[ºo°]?\s*([0-9\/\.\-]+)/i,
    // Nº AAAA.TTTT.NNN.NNNNNN (formato TRF)
    /N[ºo°]\s*([\d]{4}\.[\d]{4}\.[\d]{3}\.[\d{6}]+)/i,
    // DEPRE/XXXX
    /DEPRE[\/\s]+([A-Z0-9\-\.\/]+)/i,
    // Requisição de Pagamento Nº XXXX
    /Requisi[çc][ãa]o\s+de\s+Pagamento\s+N[ºo°]\s*([0-9\.]+)/i,
    // PRC XXX.AAAA (formato TRF1 PJe)
    /PRC\s+([\d]{1,6}\.\d{4})/i,
    // Nº AAAA/AAAA (formato simples estadual)
    /N[ºo°]\s*(\d{1,4}\/\d{4})\b/i,
    // SEI número do documento
    /SEI\s+([\d]{2}\.[\d]{1}\.[\d]{9}-[\d]{1})/i,
  ];

  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairTribunal(text: string): string | null {
  const padroes: [RegExp, string][] = [
    [/TRIBUNAL\s+DE\s+JUSTI[ÇC]A\s+DO\s+ESTADO\s+DE\s+S[ÃA]O\s+PAULO/i, "TJSP"],
    [/TRIBUNAL\s+DE\s+JUSTI[ÇC]A\s+DO\s+ESTADO\s+DO\s+PIAUí/i, "TJPI"],
    [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+(?:DA\s+)?1[ªa]\s+REGI[ÃA]O/i, "TRF1"],
    [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+(?:DA\s+)?2[ªa]\s+REGI[ÃA]O/i, "TRF2"],
    [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+(?:DA\s+)?3[ªa]\s+REGI[ÃA]O/i, "TRF3"],
    [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+(?:DA\s+)?4[ªa]\s+REGI[ÃA]O/i, "TRF4"],
    [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+(?:DA\s+)?5[ªa]\s+REGI[ÃA]O/i, "TRF5"],
    [/TRIBUNAL\s+REGIONAL\s+FEDERAL\s+(?:DA\s+)?6[ªa]\s+REGI[ÃA]O/i, "TRF6"],
    [/\bTJSP\b/, "TJSP"],
    [/\bTRF[-\s]?([1-6])\b/i, "TRF"],
  ];
  for (const [p, label] of padroes) {
    if (p.test(text)) {
      if (label === "TRF") {
        const m = p.exec(text);
        return m ? `TRF${m[1]}` : label;
      }
      return label;
    }
  }
  return null;
}

function extrairJuiz(text: string): string | null {
  const padroes = [
    /(?:Juiz[\/\(]?[íi]?za?\)?|Desembargador[a]?)[,\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][a-záéíóúâêîôûãõçàü\s]{5,60})/,
    /assinado\s+(?:digitalmente\s+)?por\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜa-záéíóúâêîôûãõçàü\s]{5,60}),\s+Juiz/i,
    /Dr\(?[a]?\)?\.?\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][a-záéíóúâêîôûãõçàü\s]{5,60}),\s+Juiz/i,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairCredor(text: string): string | null {
  const padroes = [
    /Credor(?:\(s\))?:\s*([^\n]{5,80})/i,
    /Requerente\s*\/\s*Credor\s*:\s*([^\n]{5,80})/i,
    /em\s+favor\s+d[eo](?:\(s\))?\s+credor(?:\(es\))?\s*:\s*([^\n]{5,80})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairCpfCnpj(text: string): string | null {
  const padroes = [
    /CPF\/CNPJ(?:\/RNE)?:?\s*([\d]{2,3}[\.\-\/][\d]{3}[\.\-\/][\d]{3}[\.\-\/][\d]{2,4}[-\/]?[\d]{0,2})/i,
    /CPF:?\s*([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/i,
    /CNPJ:?\s*([\d]{2}\.[\d]{3}\.[\d]{3}\/[\d]{4}-[\d]{2})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairDevedor(text: string): string | null {
  const padroes = [
    /Devedor:\s*([^\n]{5,80})/i,
    /Requerido\s*\/\s*Devedor:\s*([^\n]{5,80})/i,
    /Ente\s+devedor:\s*([^\n]{5,80})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairValor(text: string): string | null {
  const padroes = [
    /Valor\s+(?:global\s+da\s+requisi[çc][ãa]o|total\s+requisitado|atualizado|total)[:\s]+R\$\s*([\d.,]+)/i,
    /R\$\s*([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})/,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return `R$ ${m[1].trim()}`;
  }
  return null;
}

function extrairDataTransito(text: string): string | null {
  const padroes = [
    /tr[âa]nsito\s+em\s+julgado[^:]*:\s*(\d{2}\/\d{2}\/\d{4})/i,
    /tr[âa]nsito\s+em\s+julgado[^:]*:\s*(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1];
  }
  return null;
}

function extrairUrlVerificacao(text: string): string | null {
  const padroes = [
    /(https?:\/\/(?:esaj\.tjsp|pje\w*\.trf\d|sei\.tj\w+|portal\.\w+)\.jus\.br\/[^\s"<>]{10,120})/i,
    /(https?:\/\/[a-z0-9\.\-]+\.jus\.br\/[^\s"<>]{10,120})/i,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function extrairCodigoVerificador(text: string): string | null {
  const padroes = [
    /c[oó]digo\s+(?:verificador|utQ\w+|CRC)[:\s]+([A-Z0-9]{6,20})/i,
    /informando\s+o\s+c[oó]digo\s+verificador\s+(\d{5,10})/i,
    /c[oó]digo\s+CRC[:\s]+([A-F0-9]{8})/i,
    /\butQ([A-Za-z0-9]{6,12})\b/,
  ];
  for (const p of padroes) {
    const m = p.exec(text);
    if (m) return (m[1] || m[0]).trim();
  }
  return null;
}

// ─── Regras brasileiras ───────────────────────────────────────────────────────

function rBR001FormatoCNJ(cnj: string | null): BRFinding {
  const ruleId = "R-BR001";
  const title = "Formato do número CNJ";
  if (!cnj) {
    return { ruleId, severity: "critical", title, detail: "Número CNJ não localizado no documento.", found: false };
  }
  const valido = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(cnj);
  return {
    ruleId, severity: valido ? "low" : "high", title,
    detail: valido ? `CNJ válido: ${cnj}` : `CNJ com formato irregular: ${cnj}`,
    found: valido,
  };
}

function rBR002TribunalReconhecido(tribunal: string | null, cnj: string | null): BRFinding {
  const ruleId = "R-BR002";
  const title = "Tribunal reconhecido";
  const tribunaisValidos = ["TRF1","TRF2","TRF3","TRF4","TRF5","TRF6",
    "TJSP","TJRJ","TJMG","TJRS","TJPR","TJSC","TJBA","TJPI","TJCE","TJPE","TJGO","TJMA"];
  if (!tribunal) {
    return { ruleId, severity: "high", title, detail: "Tribunal não identificado no documento.", found: false };
  }
  const reconhecido = tribunaisValidos.includes(tribunal);
  return {
    ruleId, severity: reconhecido ? "low" : "high", title,
    detail: reconhecido ? `Tribunal reconhecido: ${tribunal}` : `Tribunal não reconhecido: ${tribunal}`,
    found: reconhecido,
  };
}

function rBR003AnoCoerente(cnj: string | null): BRFinding {
  const ruleId = "R-BR003";
  const title = "Ano do processo coerente";
  if (!cnj) return { ruleId, severity: "medium", title, detail: "CNJ ausente — ano não verificável.", found: false };
  const m = /\d{7}-\d{2}\.(\d{4})/.exec(cnj);
  if (!m) return { ruleId, severity: "medium", title, detail: "Ano não extraível do CNJ.", found: false };
  const ano = parseInt(m[1]);
  const anoAtual = new Date().getFullYear();
  const coerente = ano >= 1988 && ano <= anoAtual;
  return {
    ruleId, severity: coerente ? "low" : "high", title,
    detail: coerente ? `Ano ${ano} dentro do intervalo válido.` : `Ano ${ano} fora do intervalo esperado (1988-${anoAtual}).`,
    found: coerente,
  };
}

function rBR004ValorPresente(valor: string | null): BRFinding {
  const ruleId = "R-BR004";
  const title = "Valor em R$ presente";
  return {
    ruleId, severity: valor ? "low" : "high", title,
    detail: valor ? `Valor encontrado: ${valor}` : "Nenhum valor em R$ localizado no documento.",
    found: !!valor,
  };
}

function rBR005JuizPresente(juiz: string | null): BRFinding {
  const ruleId = "R-BR005";
  const title = "Juiz/Desembargador assinante identificado";
  return {
    ruleId, severity: juiz ? "low" : "high", title,
    detail: juiz ? `Assinante: ${juiz}` : "Nome do juiz assinante não localizado.",
    found: !!juiz,
  };
}

function rBR006UrlVerificacao(url: string | null): BRFinding {
  const ruleId = "R-BR006";
  const title = "URL de verificação oficial presente";
  const ehJusBr = url ? url.includes(".jus.br") : false;
  return {
    ruleId, severity: url && ehJusBr ? "low" : "high", title,
    detail: url && ehJusBr
      ? `URL oficial encontrada: ${url.substring(0, 80)}...`
      : url
        ? `URL encontrada mas fora do domínio .jus.br: ${url.substring(0, 60)}`
        : "Nenhuma URL de verificação oficial localizada.",
    found: !!(url && ehJusBr),
  };
}

function rBR007CodigoVerificador(codigo: string | null): BRFinding {
  const ruleId = "R-BR007";
  const title = "Código verificador presente";
  return {
    ruleId, severity: codigo ? "low" : "medium", title,
    detail: codigo ? `Código verificador: ${codigo}` : "Código verificador não localizado.",
    found: !!codigo,
  };
}

function rBR008AssinaturaDigital(text: string): BRFinding {
  const ruleId = "R-BR008";
  const title = "Assinatura digital (Lei 11.419/2006)";
  const padroes = [
    /assinado\s+(?:eletronicamente|digitalmente)/i,
    /Lei\s+11\.419\/2006/i,
    /DOCUMENTO\s+ASSINADO\s+DIGITALMENTE/i,
  ];
  const encontrada = padroes.some(p => p.test(text));
  return {
    ruleId, severity: encontrada ? "low" : "high", title,
    detail: encontrada
      ? "Menção à assinatura digital (Lei 11.419/2006) encontrada."
      : "Nenhuma referência à assinatura digital localizada.",
    found: encontrada,
  };
}

function rBR009QRCode(text: string): BRFinding {
  const ruleId = "R-BR009";
  const title = "QR Code de verificação";
  const padroes = [/qr\s*code/i, /qrcode/i, /c[oó]digo\s+(?:de\s+barras|bidi)/i];
  const encontrado = padroes.some(p => p.test(text));
  return {
    ruleId, severity: encontrado ? "low" : "low", title,
    detail: encontrado ? "QR Code referenciado no documento." : "QR Code não detectado no texto (pode estar apenas na imagem).",
    found: encontrado,
  };
}

function rBR010CredorDevedor(credor: string | null, devedor: string | null): BRFinding {
  const ruleId = "R-BR010";
  const title = "Credor e devedor identificados";
  const ambos = !!credor && !!devedor;
  return {
    ruleId, severity: ambos ? "low" : "medium", title,
    detail: ambos
      ? `Credor: ${credor?.substring(0, 40)} | Devedor: ${devedor?.substring(0, 40)}`
      : `${!credor ? "Credor não identificado. " : ""}${!devedor ? "Devedor não identificado." : ""}`,
    found: ambos,
  };
}

// ─── Score e status ───────────────────────────────────────────────────────────

function calcularScore(findings: BRFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (!f.found) {
      score -= SEVERITY_WEIGHT[f.severity] || 0;
    }
  }
  return Math.max(0, Math.min(100, score));
}

function definirStatus(score: number): {
  status: "APROVADO" | "VERIFICAR" | "SUSPEITO";
  statusLabel: string;
  statusColor: "green" | "yellow" | "red";
} {
  if (score >= 80) return { status: "APROVADO", statusLabel: "Avaliação preliminar aprovada", statusColor: "green" };
  if (score >= 50) return { status: "VERIFICAR", statusLabel: "Avaliação preliminar — verificar com restrições", statusColor: "yellow" };
  return { status: "SUSPEITO", statusLabel: "Avaliação preliminar negada — documento suspeito", statusColor: "red" };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function runBRAnalysis(fullText: string): BRAnalysisResult {
  const text = fullText
    .replace(/(\d{7})-\s+(\d{2}\.)/g, "$1-$2")
    .replace(/(\d{2}\.)\s+(\d{4}\.)/g, "$1$2")
    .replace(/(\d{4}\.)\s+(\d\.)/g, "$1$2")
    .replace(/(\d\.)\s+(\d{2}\.)/g, "$1$2")
    .replace(/(\d{2}\.)\s+(\d{4})\b/g, "$1$2");

  const cnj = extrairCNJ(text);
  const oficio = extrairOficio(text);
  const tribunal = extrairTribunal(text);
  const juiz = extrairJuiz(text);
  const credor = extrairCredor(text);
  const cpfCnpj = extrairCpfCnpj(text);
  const devedor = extrairDevedor(text);
  const valor = extrairValor(text);
  const dataTransito = extrairDataTransito(text);
  const urlVerificacao = extrairUrlVerificacao(text);
  const codigoVerificador = extrairCodigoVerificador(text);
  const temAssinatura = /assinado\s+(?:eletronicamente|digitalmente)|Lei\s+11\.419\/2006/i.test(text);
  const temQrcode = /qr\s*code|qrcode/i.test(text);

  const findings: BRFinding[] = [
    rBR001FormatoCNJ(cnj),
    rBR002TribunalReconhecido(tribunal, cnj),
    rBR003AnoCoerente(cnj),
    rBR004ValorPresente(valor),
    rBR005JuizPresente(juiz),
    rBR006UrlVerificacao(urlVerificacao),
    rBR007CodigoVerificador(codigoVerificador),
    rBR008AssinaturaDigital(text),
    rBR009QRCode(text),
    rBR010CredorDevedor(credor, devedor),
  ];

  const score = calcularScore(findings);
  const { status, statusLabel, statusColor } = definirStatus(score);

  const payload = JSON.stringify({ cnj, oficio, tribunal, score, status });
  const sha256 = createHash("sha256").update(payload).digest("hex");

  return {
    schemaVersion: SCHEMA_VERSION,
    score,
    status,
    statusLabel,
    statusColor,
    findings,
    extracted: {
      numero_cnj: cnj,
      numero_oficio: oficio,
      tribunal,
      juiz_assinante: juiz,
      credor_nome: credor,
      credor_cpf_cnpj: cpfCnpj,
      devedor,
      valor_rs: valor,
      data_transito: dataTransito,
      url_verificacao: urlVerificacao,
      codigo_verificador: codigoVerificador,
      tem_qrcode: temQrcode,
      tem_assinatura_digital: temAssinatura,
    },
    sha256,
  };
}
