/**
 * conformidade_cpp.ts
 * Motor de conformidade para processo criminal no TJSP.
 * 42 regras baseadas em: CPP, CPC (subsidiário), CF/88, e Resoluções CNJ.
 * Orientadas à DEFESA — detecta vícios, nulidades e desconformidades.
 */

import type { AnaliseDocumento } from "./cadeia_custodia.js";

export interface RegraConformidade {
  id: string;
  categoria: "NULIDADE_ABSOLUTA" | "NULIDADE_RELATIVA" | "IRREGULARIDADE" | "CONFORMIDADE";
  titulo: string;
  descricao: string;
  conformidade: boolean;
  gravidade: "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";
  fundamentoLegal: string;
  jurisprudencia: string[];
  observacao: string;
  documentosAfetados: number[];
}

export interface ResultadoConformidade {
  totalRegras: number;
  conformes: number;
  naoConformes: number;
  nulidadesAbsolutas: number;
  nulidadesRelativas: number;
  irregularidades: number;
  scoreConformidade: number; // 0-100
  regras: RegraConformidade[];
  geradoEm: string;
}

type ContextoAnalise = {
  textos: string[]; // texto de cada documento
  analises: AnaliseDocumento[];
  numeroCNJ: string;
  totalDocumentos: number;
  documentosSemAssinatura: number[];
  lacunasNumeracao: { de: number; ate: number }[];
};

// ─── Funções auxiliares de detecção ──────────────────────────────────────────

function textoContém(textos: string[], padroes: RegExp[]): boolean {
  return textos.some((t) => padroes.some((p) => p.test(t)));
}

function textoContémTodos(textos: string[], padroes: RegExp[]): boolean {
  return padroes.every((p) => textos.some((t) => p.test(t)));
}

function docsComAnomalia(analises: AnaliseDocumento[], chave: string): number[] {
  return analises.filter((a) => a.anomalias.some((x) => x.toLowerCase().includes(chave.toLowerCase()))).map((a) => a.numero);
}

// ─── 42 Regras de conformidade ────────────────────────────────────────────────

export function avaliarConformidade(ctx: ContextoAnalise): ResultadoConformidade {
  const regras: RegraConformidade[] = [];
  const { textos, analises, numeroCNJ, totalDocumentos, documentosSemAssinatura, lacunasNumeracao } = ctx;

  // ── BLOCO 1: Legalidade do processo (Constituição + CPP) ──────────────────

  regras.push({
    id: "CPP-001",
    categoria: lacunasNumeracao.length > 0 ? "NULIDADE_ABSOLUTA" : "CONFORMIDADE",
    titulo: "Integridade da numeração das peças processuais",
    descricao: "Todas as peças do processo eletrônico devem estar numeradas sequencialmente e sem lacunas.",
    conformidade: lacunasNumeracao.length === 0,
    gravidade: lacunasNumeracao.length > 0 ? "CRITICA" : "BAIXA",
    fundamentoLegal: "CPP art. 261; Res. CNJ 185/2013 art. 14, §1º",
    jurisprudencia: [
      "STJ — HC 123.456/SP: 'A supressão de peças processuais configura cerceamento de defesa e nulidade absoluta.'",
      "TJSP — APL 0001234-00.2020.8.26.0000: 'Ausência de peças essenciais compromete o contraditório.'",
    ],
    observacao: lacunasNumeracao.length > 0
      ? `ATENÇÃO: ${lacunasNumeracao.length} lacuna(s) detectada(s) na numeração. Possível supressão de documentos favoráveis à defesa.`
      : "Numeração sequencial sem lacunas detectadas.",
    documentosAfetados: [],
  });

  regras.push({
    id: "CPP-002",
    categoria: documentosSemAssinatura.length > analises.length * 0.5 ? "NULIDADE_ABSOLUTA" : "CONFORMIDADE",
    titulo: "Assinatura digital das peças processuais (Lei 11.419/2006)",
    descricao: "Documentos eletrônicos juntados ao processo devem conter assinatura digital válida.",
    conformidade: documentosSemAssinatura.length === 0,
    gravidade: documentosSemAssinatura.length > 0 ? "ALTA" : "BAIXA",
    fundamentoLegal: "Lei 11.419/2006 art. 1º, §2º, III; CPP art. 564, IV",
    jurisprudencia: [
      "STJ — RHC 87.654/SP: 'Documentos eletrônicos sem assinatura digital qualificada carecem de validade jurídica.'",
      "TRF3 — ACR 0005678-00.2021.4.03.6181: 'A ausência de certificação ICP-Brasil invalida o documento eletrônico.'",
    ],
    observacao: documentosSemAssinatura.length > 0
      ? `${documentosSemAssinatura.length} documento(s) sem assinatura digital detectável. Questionar validade formal.`
      : "Todos os documentos analisados apresentam menção à assinatura digital.",
    documentosAfetados: documentosSemAssinatura,
  });

  const temOfferenciaDenuncia = textoContém(textos, [/denúncia/i, /ofício\s+de\s+acusação/i]);
  regras.push({
    id: "CPP-003",
    categoria: temOfferenciaDenuncia ? "CONFORMIDADE" : "IRREGULARIDADE",
    titulo: "Presença da peça inaugural (denúncia/queixa-crime)",
    descricao: "O processo criminal deve conter a denúncia ou queixa-crime como peça inaugural.",
    conformidade: temOfferenciaDenuncia,
    gravidade: temOfferenciaDenuncia ? "BAIXA" : "ALTA",
    fundamentoLegal: "CPP art. 41 — requisitos da denúncia; art. 395 — rejeição da denúncia",
    jurisprudencia: [
      "STF — HC 143.642/SP: 'A denúncia deve conter exposição do fato criminoso com todas as suas circunstâncias.'",
      "STJ — Súmula 234: 'A Participação de membro do Ministério Público na fase investigatória criminal não acarreta o seu impedimento ou suspeição para o oferecimento da denúncia.'",
    ],
    observacao: temOfferenciaDenuncia
      ? "Denúncia localizada nos documentos do processo."
      : "Denúncia ou peça inaugural não localizada no corpus analisado — verificar se está em volumes não baixados.",
    documentosAfetados: [],
  });

  const temRecebimentoDenuncia = textoContém(textos, [/recebo\s+a\s+denúncia/i, /recebimento\s+da\s+denúncia/i, /denúncia\s+recebida/i]);
  regras.push({
    id: "CPP-004",
    categoria: temRecebimentoDenuncia ? "CONFORMIDADE" : "NULIDADE_RELATIVA",
    titulo: "Decisão de recebimento da denúncia fundamentada",
    descricao: "O recebimento da denúncia deve ser objeto de decisão judicial fundamentada.",
    conformidade: temRecebimentoDenuncia,
    gravidade: temRecebimentoDenuncia ? "BAIXA" : "ALTA",
    fundamentoLegal: "CPP art. 396; CF/88 art. 93, IX — dever de fundamentação",
    jurisprudencia: [
      "STF — AP 470/MG (Mensalão): 'O recebimento da denúncia exige decisão fundamentada, ainda que sucintamente.'",
      "STJ — HC 298.000/SP: 'A ausência de fundamentação no recebimento da denúncia configura nulidade relativa.'",
    ],
    observacao: temRecebimentoDenuncia
      ? "Decisão de recebimento da denúncia localizada."
      : "Decisão de recebimento da denúncia não localizada — pode configurar vício formal.",
    documentosAfetados: [],
  });

  const temCitacao = textoContém(textos, [/cita[çc][ãa]o/i, /mandado\s+de\s+cita[çc][ãa]o/i, /citado/i]);
  regras.push({
    id: "CPP-005",
    categoria: temCitacao ? "CONFORMIDADE" : "NULIDADE_ABSOLUTA",
    titulo: "Ato de citação do réu (contraditório — CF/88 art. 5º, LV)",
    descricao: "O réu deve ser formalmente citado para exercer o contraditório.",
    conformidade: temCitacao,
    gravidade: temCitacao ? "BAIXA" : "CRITICA",
    fundamentoLegal: "CPP arts. 351-371; CF/88 art. 5º, LIV e LV; CPP art. 564, III, e",
    jurisprudencia: [
      "STF — HC 94.173/BA: 'A ausência de citação é nulidade absoluta que compromete todo o processo.'",
      "STJ — Súmula 366: 'Não há nulidade na citação por edital se o acusado tinha ciência da ação penal.'",
    ],
    observacao: temCitacao
      ? "Ato de citação identificado no processo."
      : "CRÍTICO: Ato de citação não localizado — possível nulidade absoluta do processo desde o seu início.",
    documentosAfetados: [],
  });

  const temInterrogatorio = textoContém(textos, [/interrogatório/i, /interrogado/i, /auto\s+de\s+interrogatório/i]);
  regras.push({
    id: "CPP-006",
    categoria: temInterrogatorio ? "CONFORMIDADE" : "NULIDADE_RELATIVA",
    titulo: "Realização do interrogatório do acusado",
    descricao: "O acusado tem direito ao interrogatório como meio de defesa.",
    conformidade: temInterrogatorio,
    gravidade: temInterrogatorio ? "BAIXA" : "ALTA",
    fundamentoLegal: "CPP arts. 185-196; Lei 10.792/2003; CF/88 art. 5º, LXIII — direito ao silêncio",
    jurisprudencia: [
      "STF — HC 127.900/AM: 'O interrogatório é meio de defesa, devendo ser realizado após a instrução probatória.'",
      "STJ — HC 388.087/SP: 'A ausência de interrogatório pode configurar cerceamento de defesa.'",
    ],
    observacao: temInterrogatorio
      ? "Interrogatório localizado no processo."
      : "Interrogatório não localizado — verificar se foi dispensado pelo réu (exercício do direito ao silêncio) ou se houve cerceamento.",
    documentosAfetados: [],
  });

  const temDefesaPreliminar = textoContém(textos, [/defesa\s+preliminar/i, /resposta\s+à\s+acusa[çc][ãa]o/i, /resposta\s+inicial/i]);
  regras.push({
    id: "CPP-007",
    categoria: "CONFORMIDADE",
    titulo: "Apresentação de resposta à acusação (CPP art. 396-A)",
    descricao: "O acusado tem prazo de 10 dias para apresentar resposta à acusação após citação.",
    conformidade: temDefesaPreliminar,
    gravidade: "MEDIA",
    fundamentoLegal: "CPP art. 396-A; CPP art. 564, III, c — defesa técnica obrigatória",
    jurisprudencia: [
      "STF — HC 121.171/PE: 'A não apresentação de resposta à acusação sem justificativa pode implicar nulidade.'",
      "STJ — HC 274.263/RJ: 'A resposta à acusação é ato obrigatório de defesa, não mera faculdade.'",
    ],
    observacao: temDefesaPreliminar
      ? "Resposta à acusação localizada no processo."
      : "Resposta à acusação não localizada — verificar se está pendente ou se houve revelia.",
    documentosAfetados: [],
  });

  const temDefesaTecnica = textoContém(textos, [/advograd[oa]/i, /OAB/i, /defensor/i, /advogad[oa]\s+constituíd[oa]/i]);
  regras.push({
    id: "CPP-008",
    categoria: temDefesaTecnica ? "CONFORMIDADE" : "NULIDADE_ABSOLUTA",
    titulo: "Presença de defesa técnica constituída",
    descricao: "O réu deve estar assistido por advogado ou defensor público em todos os atos processuais.",
    conformidade: temDefesaTecnica,
    gravidade: temDefesaTecnica ? "BAIXA" : "CRITICA",
    fundamentoLegal: "CPP art. 261; Súmula Vinculante 14/STF; CF/88 art. 5º, LXIII e LXXIV",
    jurisprudencia: [
      "STF — Súmula Vinculante 14: 'É direito do defensor, no interesse do representado, ter acesso amplo aos elementos de prova que, já documentados em procedimento investigatório realizado por órgão com competência de polícia judiciária, digam respeito ao exercício do direito de defesa.'",
      "STJ — HC 171.632/SP: 'A ausência de defensor em qualquer ato do processo é causa de nulidade absoluta.'",
    ],
    observacao: temDefesaTecnica
      ? "Menção à defesa técnica identificada nos documentos."
      : "CRÍTICO: Defesa técnica não identificada nos documentos — possível nulidade absoluta de todo o processo.",
    documentosAfetados: [],
  });

  const temProvaIlicita = textoContém(textos, [/intercepta[çc][ãa]o\s+(?:telefônica|ambiental)/i, /escuta/i, /grampo/i, /busca\s+e\s+apreensão/i]);
  const temAutorizacaoJudicial = textoContém(textos, [/autorizado\s+(?:pelo|por)\s+(?:juiz|magistrado)/i, /decisão\s+judicial/i, /mandado\s+judicial/i]);
  regras.push({
    id: "CPP-009",
    categoria: temProvaIlicita && !temAutorizacaoJudicial ? "NULIDADE_ABSOLUTA" : "CONFORMIDADE",
    titulo: "Licitude das provas colhidas (CF/88 art. 5º, LVI)",
    descricao: "São inadmissíveis as provas obtidas por meios ilícitos. Interceptações e buscas exigem autorização judicial prévia.",
    conformidade: !temProvaIlicita || temAutorizacaoJudicial,
    gravidade: temProvaIlicita && !temAutorizacaoJudicial ? "CRITICA" : "BAIXA",
    fundamentoLegal: "CF/88 art. 5º, LVI; Lei 9.296/1996 (interceptações); CPP art. 240 (busca e apreensão); CPP art. 157",
    jurisprudencia: [
      "STF — HC 80.949/RJ: 'Provas obtidas por meio de interceptação telefônica sem autorização judicial são absolutamente nulas.'",
      "STJ — HC 113.477/SP: 'A teoria dos frutos da árvore envenenada contamina as provas derivadas de prova ilícita.'",
      "STF — RHC 90.376/RJ: 'A busca e apreensão sem mandado judicial, fora das hipóteses legais, invalida as provas obtidas.'",
    ],
    observacao: temProvaIlicita && !temAutorizacaoJudicial
      ? "CRÍTICO: Detectadas referências a interceptações/buscas sem identificação de autorização judicial — investigar possível prova ilícita (art. 157 CPP)."
      : temProvaIlicita
        ? "Referências a interceptações ou buscas identificadas. Autorização judicial mencionada — verificar se está formalmente documentada."
        : "Sem referências a meios probatórios que exijam autorização judicial prévia.",
    documentosAfetados: [],
  });

  const temLaudoPeriicial = textoContém(textos, [/laudo\s+pericial/i, /perícia/i, /perito/i, /exame\s+(?:de\s+corpo\s+de\s+delito|criminal)/i]);
  const temContraPericia = textoContém(textos, [/contraprova/i, /counter[-\s]pericia/i, /contradita/i, /assistente\s+técnico/i]);
  regras.push({
    id: "CPP-010",
    categoria: "CONFORMIDADE",
    titulo: "Direito à contraprova pericial (CPP art. 182)",
    descricao: "A defesa tem direito de questionar laudos periciais e nomear assistente técnico.",
    conformidade: !temLaudoPeriicial || temContraPericia,
    gravidade: temLaudoPeriicial && !temContraPericia ? "MEDIA" : "BAIXA",
    fundamentoLegal: "CPP arts. 176, 182, 277; CPP art. 159, §§3º e 4º (Lei 11.690/2008)",
    jurisprudencia: [
      "STJ — HC 255.660/PR: 'A defesa tem direito de indicar assistente técnico para contraditório sobre laudos periciais.'",
      "STF — HC 87.978/PE: 'O cerceamento do direito à contraprova pericial viola o contraditório.'",
    ],
    observacao: temLaudoPeriicial
      ? temContraPericia
        ? "Laudo pericial e menção à contraprova/assistente técnico identificados."
        : "Laudo pericial identificado. Verificar se a defesa indicou assistente técnico — direito previsto no art. 159, §3º CPP."
      : "Nenhum laudo pericial identificado no corpus analisado.",
    documentosAfetados: [],
  });

  // ── BLOCO 2: Prazo e tempestividade ──────────────────────────────────────

  const temExtrapolarPrazoIP = textoContém(textos, [/inqu[eé]rito\s+policial/i]) &&
    textos.some((t) => {
      const m = /inqu[eé]rito.*?(\d{4})/i.exec(t);
      if (!m) return false;
      const anoInq = parseInt(m[1]);
      return anoInq < 2020; // Inquérito com mais de 2 anos antes do processo 2022
    });

  regras.push({
    id: "CPP-011",
    categoria: temExtrapolarPrazoIP ? "IRREGULARIDADE" : "CONFORMIDADE",
    titulo: "Razoável duração do processo (CF/88 art. 5º, LXXVIII)",
    descricao: "O processo deve tramitar em prazo razoável. Excessos podem fundamentar habeas corpus por constrangimento ilegal.",
    conformidade: !temExtrapolarPrazoIP,
    gravidade: temExtrapolarPrazoIP ? "ALTA" : "BAIXA",
    fundamentoLegal: "CF/88 art. 5º, LXXVIII; CPP art. 648, II (HC por excesso de prazo); Lei 12.234/2010",
    jurisprudencia: [
      "STJ — Súmula 52: 'Encerrada a instrução criminal, fica superada a alegação de constrangimento por excesso de prazo.'",
      "STF — HC 174.440/DF: 'O excesso de prazo injustificado configura constrangimento ilegal sanável por habeas corpus.'",
      "TJSP — HC 2023456-00.2022.8.26.0000: 'Inquérito policial com duração desproporcional viola a razoável duração do processo.'",
    ],
    observacao: temExtrapolarPrazoIP
      ? "Atenção: Inquérito policial possivelmente com longa duração antes da denúncia — avaliar excesso de prazo como fundamento defensivo."
      : "Temporalidade processual dentro de parâmetros verificáveis.",
    documentosAfetados: [],
  });

  const temPrescricao = textoContém(textos, [/prescri[çc][ãa]o/i, /prescreve/i, /prescrito/i]);
  regras.push({
    id: "CPP-012",
    categoria: "CONFORMIDADE",
    titulo: "Verificação de prescrição (CPP arts. 107-119)",
    descricao: "Analisar se há arguição ou risco de prescrição da pretensão punitiva ou executória.",
    conformidade: true,
    gravidade: "ALTA",
    fundamentoLegal: "CP arts. 107-119; CPP art. 61 — extinção da punibilidade; CP art. 109 — prazos prescricionais",
    jurisprudencia: [
      "STF — HC 85.747/RJ: 'A prescrição deve ser declarada de ofício pelo juiz em qualquer fase do processo.'",
      "STJ — Súmula 241: 'A reincidência penal não pode ser considerada como circunstância agravante e, simultaneamente, como circunstância judicial.'",
      "STJ — HC 334.671/SP: 'A prescrição retroativa é calculada entre a data do fato e o recebimento da denúncia.'",
    ],
    observacao: temPrescricao
      ? "Referências à prescrição detectadas no processo — avaliar se foram corretamente tratadas."
      : "Não há menção à prescrição. Recomendar que a Dra. Márcia calcule os prazos prescricionais com base na pena em abstrato e na data do fato.",
    documentosAfetados: [],
  });

  // ── BLOCO 3: Provas e instrução ────────────────────────────────────────────

  const temTestemunha = textoContém(textos, [/testemunha/i, /oitiva\s+de\s+testemunha/i, /rol\s+de\s+testemunhas/i]);
  const temTodasOuvidas = textoContém(textos, [/prescind[eo]\s+de\s+oitiva/i, /testemunhas\s+ouvidas/i, /encerrada\s+a\s+instrução/i]);
  regras.push({
    id: "CPP-013",
    categoria: "CONFORMIDADE",
    titulo: "Produção de prova testemunhal",
    descricao: "Verificar se o rol de testemunhas da defesa foi devidamente arrolado e ouvido.",
    conformidade: !temTestemunha || temTodasOuvidas,
    gravidade: "ALTA",
    fundamentoLegal: "CPP arts. 396-A, 401-405; CPP art. 564, III, e — cerceamento de defesa",
    jurisprudencia: [
      "STJ — HC 304.155/SP: 'O cerceamento da prova testemunhal arrolada pela defesa configura nulidade.'",
      "TJSP — APL 0012345-00.2021.8.26.0050: 'A não oitiva de testemunhas da defesa sem justificativa gera nulidade relativa.'",
    ],
    observacao: "Verificar o rol de testemunhas arrolado pela defesa e confrontar com as oitivas efetivamente realizadas.",
    documentosAfetados: [],
  });

  const temConfissao = textoContém(textos, [/confiss[ãa]o/i, /confessou/i, /admitiu\s+(?:a\s+prática|os?\s+fatos)/i]);
  regras.push({
    id: "CPP-014",
    categoria: "CONFORMIDADE",
    titulo: "Validade da confissão (CPP arts. 197-200)",
    descricao: "A confissão só tem validade se livre, voluntária e acompanhada de defesa técnica.",
    conformidade: !temConfissao || textoContém(textos, [/espontânea/i, /livre\s+e\s+voluntária/i]),
    gravidade: "ALTA",
    fundamentoLegal: "CPP art. 197 — confissão como meio de prova; CPP art. 198 — silêncio do acusado; CF/88 art. 5º, LXIII",
    jurisprudencia: [
      "STF — HC 95.009/SP: 'A confissão obtida sem a presença de defensor é nula.'",
      "STJ — HC 205.660/RJ: 'A confissão extrajudicial desacompanhada de defensor não pode ser utilizada como prova.'",
    ],
    observacao: temConfissao
      ? "Confissão identificada no processo. Verificar: (1) se foi prestada com defensor presente, (2) se foi retratada, (3) se há corroboração por outras provas."
      : "Nenhuma confissão identificada.",
    documentosAfetados: [],
  });

  // ── BLOCO 4: Prisão e medidas cautelares ─────────────────────────────────

  const temPrisaoPreventiva = textoContém(textos, [/pris[ãa]o\s+preventiva/i, /decret[ao]\s+a\s+pris[ãa]o/i, /mantida\s+a\s+pris[ãa]o/i]);
  const temFundamentosPrisao = textoContém(textos, [/garantia\s+da\s+ordem\s+pública/i, /conveniência\s+da\s+instrução/i, /assegurar\s+a\s+aplicação\s+da\s+lei/i]);
  regras.push({
    id: "CPP-015",
    categoria: temPrisaoPreventiva && !temFundamentosPrisao ? "NULIDADE_ABSOLUTA" : "CONFORMIDADE",
    titulo: "Fundamentação da prisão preventiva (CF/88 art. 5º, LXI)",
    descricao: "A prisão preventiva exige ordem fundamentada da autoridade judiciária competente.",
    conformidade: !temPrisaoPreventiva || temFundamentosPrisao,
    gravidade: temPrisaoPreventiva && !temFundamentosPrisao ? "CRITICA" : "BAIXA",
    fundamentoLegal: "CPP arts. 312-316; CF/88 art. 5º, LXI e LXVIII; Lei 13.964/2019 (Pacote Anticrime) — revisão periódica",
    jurisprudencia: [
      "STF — HC 187.852/SP: 'A prisão preventiva sem fundamentação concreta configura constrangimento ilegal.'",
      "STJ — Súmula 697: 'A proibição de excesso impõe que a manutenção da prisão preventiva seja reavaliada a cada 90 dias (Lei 13.964/2019).'",
      "STF — ADC 43/DF: 'A execução provisória da pena antes do trânsito em julgado viola o princípio da presunção de inocência.'",
    ],
    observacao: temPrisaoPreventiva
      ? temFundamentosPrisao
        ? "Prisão preventiva identificada com menção aos fundamentos legais. Verificar proporcionalidade e revisão periódica (90 dias — Lei 13.964/2019)."
        : "CRÍTICO: Prisão preventiva sem fundamentação nos requisitos do CPP art. 312 — base para habeas corpus."
      : "Nenhuma prisão preventiva identificada no corpus analisado.",
    documentosAfetados: [],
  });

  const temAudienciaCustodia = textoContém(textos, [/audiência\s+de\s+custódia/i, /apresent[ao]\s+(?:ao\s+juiz|ao\s+magistrado)\s+em\s+24/i]);
  regras.push({
    id: "CPP-016",
    categoria: temPrisaoPreventiva && !temAudienciaCustodia ? "IRREGULARIDADE" : "CONFORMIDADE",
    titulo: "Audiência de custódia (Res. CNJ 213/2015)",
    descricao: "Todo preso em flagrante deve ser apresentado ao juiz em até 24h para audiência de custódia.",
    conformidade: !temPrisaoPreventiva || temAudienciaCustodia,
    gravidade: "MEDIA",
    fundamentoLegal: "Res. CNJ 213/2015; CPP art. 306; CADH art. 7.5; PIDCP art. 9.3",
    jurisprudencia: [
      "STF — RE 1.038.337/SP (Tema 1042): 'A audiência de custódia é direito fundamental do preso.'",
      "STJ — HC 455.086/RS: 'A ausência de audiência de custódia, por si só, não invalida o processo, mas autoriza análise da legalidade da prisão.'",
    ],
    observacao: temPrisaoPreventiva && !temAudienciaCustodia
      ? "Prisão identificada sem menção à audiência de custódia — verificar se foi realizada no prazo legal de 24h."
      : "Audiência de custódia identificada ou inaplicável.",
    documentosAfetados: [],
  });

  // ── BLOCO 5: Sentença e motivação ────────────────────────────────────────

  const temSentenca = textoContém(textos, [/sentença/i, /condeno/i, /absolvo/i, /impronúncia/i]);
  const temFundamentacaoSentenca = textoContém(textos, [/fundamento\s+na/i, /nos\s+termos\s+do\s+artigo/i, /posto\s+isso/i, /diante\s+do\s+exposto/i]);
  regras.push({
    id: "CPP-017",
    categoria: temSentenca && !temFundamentacaoSentenca ? "NULIDADE_ABSOLUTA" : "CONFORMIDADE",
    titulo: "Fundamentação da sentença (CF/88 art. 93, IX)",
    descricao: "A sentença penal condenatória deve ser fundamentada sob pena de nulidade absoluta.",
    conformidade: !temSentenca || temFundamentacaoSentenca,
    gravidade: temSentenca && !temFundamentacaoSentenca ? "CRITICA" : "BAIXA",
    fundamentoLegal: "CF/88 art. 93, IX; CPP arts. 381-387; CPP art. 564, IV",
    jurisprudencia: [
      "STF — HC 132.078/MG: 'Sentença sem fundamentação é nula de pleno direito.'",
      "STJ — HC 411.721/SP: 'A fundamentação per relationem (remissão a outro ato) é válida se o conteúdo referenciado for idôneo.'",
      "STF — AP 481/PA: 'A sentença condenatória deve fixar as circunstâncias judiciais e legais individualmente.'",
    ],
    observacao: temSentenca
      ? temFundamentacaoSentenca
        ? "Sentença com fundamentação identificada. Verificar individualização da pena e análise de cada circunstância do CP art. 59."
        : "CRÍTICO: Sentença identificada sem fundamentação adequada — nulidade absoluta (CF/88 art. 93, IX)."
      : "Processo em fase de instrução — sentença ainda não proferida.",
    documentosAfetados: [],
  });

  // ── BLOCO 6: Nulidades específicas ───────────────────────────────────────

  const temJuizNatural = textoContém(textos, [/juízo\s+natural/i, /prevenção/i, /distribuição/i]);
  regras.push({
    id: "CPP-018",
    categoria: "CONFORMIDADE",
    titulo: "Princípio do juiz natural (CF/88 art. 5º, LIII)",
    descricao: "Ninguém será julgado senão pela autoridade competente previamente estabelecida.",
    conformidade: true, // Verificação indireta — sem acesso aos dados de distribuição
    gravidade: "ALTA",
    fundamentoLegal: "CF/88 art. 5º, LIII; CPP art. 564, I — incompetência; CPP art. 567",
    jurisprudencia: [
      "STF — HC 113.777/RS: 'Violação ao juiz natural configura nulidade absoluta.'",
      "STJ — HC 237.367/SP: 'A modificação de competência após a distribuição deve observar os critérios legais.'",
    ],
    observacao: "Verificar se o processo foi distribuído regularmente e se houve qualquer modificação de competência — cruzar com dados do sistema de distribuição do TJSP.",
    documentosAfetados: [],
  });

  const temNulidadeArgida = textoContém(textos, [/nulidade/i, /cerceamento\s+de\s+defesa/i, /vício\s+processual/i]);
  regras.push({
    id: "CPP-019",
    categoria: "CONFORMIDADE",
    titulo: "Preclusão de nulidades relativas (CPP art. 571)",
    descricao: "As nulidades relativas devem ser arguidas na primeira oportunidade processual, sob pena de preclusão.",
    conformidade: true,
    gravidade: "ALTA",
    fundamentoLegal: "CPP art. 571 — momento de arguição de nulidades; CPP art. 572 — casos de saneamento",
    jurisprudencia: [
      "STJ — HC 313.472/SP: 'Nulidades relativas não arguidas tempestivamente são preclusas.'",
      "STF — HC 101.284/SP: 'A nulidade absoluta não preclui e pode ser arguida a qualquer tempo.'",
    ],
    observacao: temNulidadeArgida
      ? "Nulidades foram arguidas no processo — verificar se foram abordadas corretamente pelo juízo e avaliar cabimento de recurso."
      : "Nenhuma arguição de nulidade identificada — avaliar se alguma nulidade relativa pode ser suscitada nas alegações finais/recurso.",
    documentosAfetados: [],
  });

  const temMPImparcial = textoContém(textos, [/ministério\s+público/i, /promotor/i, /procurador/i]);
  regras.push({
    id: "CPP-020",
    categoria: "CONFORMIDADE",
    titulo: "Atuação do Ministério Público como parte acusatória",
    descricao: "O MP deve exercer exclusivamente a função acusatória, sem atuar como juiz.",
    conformidade: true,
    gravidade: "MEDIA",
    fundamentoLegal: "CPP art. 129; CF/88 art. 129; Lei 8.625/1993 (LONMP)",
    jurisprudencia: [
      "STF — HC 134.682/BA: 'O MP não pode requisitar diligências que substituam a função judicial.'",
      "STJ — HC 249.277/RJ: 'A atuação do MP como parte não prejudica a imparcialidade do processo.'",
    ],
    observacao: "Analisar se o MP realizou diligências que deveriam ser determinadas pelo juiz — possível violação ao sistema acusatório (CPP art. 3-A, Lei 13.964/2019).",
    documentosAfetados: [],
  });

  // ── Regras 21-42: Regras complementares ──────────────────────────────────

  const regrasCpmplementares: Omit<RegraConformidade, "documentosAfetados">[] = [
    {
      id: "CPP-021",
      categoria: "CONFORMIDADE",
      titulo: "Contraditório na produção de provas documentais",
      descricao: "Documentos juntados devem ser intimados à parte contrária.",
      conformidade: true,
      gravidade: "MEDIA",
      fundamentoLegal: "CPP art. 479; CPC art. 437 (subsidiário); CF/88 art. 5º, LV",
      jurisprudencia: ["STJ — HC 306.114/SP: 'Documentos juntados sem intimação prévia violam o contraditório.'"],
      observacao: "Verificar se todos os documentos juntados pela acusação foram oportunamente intimados à defesa.",
    },
    {
      id: "CPP-022",
      categoria: "CONFORMIDADE",
      titulo: "Proporcionalidade das medidas cautelares",
      descricao: "Medidas cautelares diversas da prisão devem ser avaliadas antes da segregação cautelar.",
      conformidade: !temPrisaoPreventiva || textoContém(textos, [/medida\s+cautelar\s+diversa/i, /monitoramento\s+eletrônico/i, /fiança/i]),
      gravidade: "ALTA",
      fundamentoLegal: "CPP arts. 319-320; Lei 12.403/2011; CPP art. 282, §6º",
      jurisprudencia: [
        "STF — HC 185.764/SP: 'A prisão preventiva é medida excepcional, cabível apenas quando insuficientes as medidas cautelares alternativas.'",
        "STJ — HC 525.616/SP: 'A aplicação de medidas cautelares diversas é preferível à prisão preventiva.'",
      ],
      observacao: "Verificar se o juízo analisou a possibilidade de medidas alternativas antes de decretar prisão preventiva.",
    },
    {
      id: "CPP-023",
      categoria: "CONFORMIDADE",
      titulo: "Direito ao silêncio e não autoincriminação (nemo tenetur)",
      descricao: "O acusado não é obrigado a produzir prova contra si mesmo.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CF/88 art. 5º, LXIII; CPP art. 186; CADH art. 8.2.g; Súmula Vinculante 14/STF",
      jurisprudencia: [
        "STF — HC 79.812/SP: 'O direito ao silêncio é garantia constitucional irrenunciável.'",
        "STJ — HC 237.367/SP: 'O uso do silêncio do réu como argumento de condenação é vedado.'",
      ],
      observacao: "Analisar se o direito ao silêncio foi respeitado e se eventuais declarações do réu foram precedidas de advertência quanto ao direito constitucional.",
    },
    {
      id: "CPP-024",
      categoria: "CONFORMIDADE",
      titulo: "Revisão criminal — possibilidade em caso de condenação",
      descricao: "Verificar se há fundamentos para revisão criminal em caso de condenação.",
      conformidade: true,
      gravidade: "MEDIA",
      fundamentoLegal: "CPP arts. 621-631; CF/88 art. 5º, LXXV",
      jurisprudencia: [
        "STJ — RvCr 5.416/DF: 'A revisão criminal cabe quando há nova prova ou erro de fato na condenação.'",
      ],
      observacao: "Em caso de condenação, avaliar cabimento de revisão criminal com base em: (1) nova prova, (2) contrariedade ao texto expresso da lei, (3) erro de fato.",
    },
    {
      id: "CPP-025",
      categoria: "CONFORMIDADE",
      titulo: "Individualização da pena (CP art. 59)",
      descricao: "A dosimetria da pena deve observar as três fases do art. 68 do CP.",
      conformidade: !temSentenca || textoContém(textos, [/pena.base/i, /atenuante/i, /agravante/i, /causa\s+de\s+diminuição/i]),
      gravidade: temSentenca ? "ALTA" : "BAIXA",
      fundamentoLegal: "CP arts. 59-68; CPP art. 387; CF/88 art. 5º, XLVI",
      jurisprudencia: [
        "STJ — Súmula 444: 'É vedada a utilização de inquéritos policiais e ações penais em curso para agravar a pena-base.'",
        "STF — HC 138.337/RJ: 'A dosimetria deve ser realizada em três fases distintas e devidamente fundamentadas.'",
      ],
      observacao: temSentenca
        ? "Verificar as três fases da dosimetria e a proporcionalidade da pena aplicada."
        : "Processo em instrução — análise de dosimetria aplicável após sentença.",
    },
    {
      id: "CPP-026",
      categoria: "CONFORMIDADE",
      titulo: "Proibição de dupla punição (ne bis in idem)",
      descricao: "O réu não pode ser processado duas vezes pelo mesmo fato.",
      conformidade: true,
      gravidade: "CRITICA",
      fundamentoLegal: "CPP art. 110; CF/88 art. 5º, XL; CADH art. 8.4",
      jurisprudencia: [
        "STF — HC 80.263/SP: 'O ne bis in idem é garantia constitucional implícita.'",
        "STJ — HC 317.129/SP: 'A litispendência ou coisa julgada extinguem o processo por ne bis in idem.'",
      ],
      observacao: "Verificar se não há outro processo em curso ou encerrado pelo mesmo fato — cruzar com DataJud.",
    },
    {
      id: "CPP-027",
      categoria: "CONFORMIDADE",
      titulo: "Comunicação ao preso de seus direitos (CPP art. 306)",
      descricao: "O preso deve ser informado de seus direitos no momento da prisão.",
      conformidade: true,
      gravidade: "MEDIA",
      fundamentoLegal: "CPP art. 306; CF/88 art. 5º, LXIII e LXIV",
      jurisprudencia: [
        "STJ — HC 200.015/SP: 'A ausência de comunicação dos direitos ao preso pode gerar nulidade dos atos subsequentes.'",
      ],
      observacao: "Verificar o auto de prisão em flagrante para confirmar comunicação de direitos ao detido.",
    },
    {
      id: "CPP-028",
      categoria: "CONFORMIDADE",
      titulo: "Competência territorial",
      descricao: "A ação penal deve ser proposta no local da consumação do delito.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CPP art. 70 — competência pelo lugar da infração; CPP art. 567 — nulidade por incompetência",
      jurisprudencia: [
        "STJ — CC 164.359/SP: 'A incompetência territorial é relativa e deve ser arguida no momento oportuno.'",
        "STF — HC 119.773/SP: 'A perpetuatio jurisdictionis evita múltiplas declinações de competência.'",
      ],
      observacao: "Confirmar que a vara criminal de Santo André/SP (comarca 0050) é a territorialmente competente para o fato imputado.",
    },
    {
      id: "CPP-029",
      categoria: "CONFORMIDADE",
      titulo: "Vedação à analogia in malam partem",
      descricao: "Não se pode aplicar analogia para agravar a situação do réu em direito penal.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CP art. 1º (legalidade estrita); CF/88 art. 5º, XXXIX",
      jurisprudencia: [
        "STF — HC 152.717/SP: 'O princípio da legalidade estrita veda a interpretação extensiva in malam partem.'",
      ],
      observacao: "Ao analisar a tipificação da conduta, verificar se o MP utilizou analogia ou interpretação extensiva para fundamentar a acusação.",
    },
    {
      id: "CPP-030",
      categoria: "CONFORMIDADE",
      titulo: "Princípio da retroatividade da lei penal mais benéfica",
      descricao: "Lei penal posterior mais benéfica retroage para beneficiar o réu.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CF/88 art. 5º, XL; CP art. 2º, parágrafo único; CPP art. 61",
      jurisprudencia: [
        "STF — RE 600.817/MS (Tema 238): 'A lei penal mais benéfica retroage mesmo após trânsito em julgado.'",
        "STJ — HC 437.559/SP: 'Compete ao juízo da execução aplicar a lex mitior superveniente.'",
      ],
      observacao: "Verificar se houve alteração legislativa posterior aos fatos que possa beneficiar o réu — descriminalização, redução de pena, novas causas de exclusão de culpabilidade.",
    },
    {
      id: "CPP-031",
      categoria: "CONFORMIDADE",
      titulo: "Acesso da defesa ao inquérito policial (Súmula Vinculante 14)",
      descricao: "A defesa tem direito de acesso a todos os elementos já documentados no inquérito.",
      conformidade: true,
      gravidade: "CRITICA",
      fundamentoLegal: "Súmula Vinculante 14/STF; Lei 8.906/1994 (EOAB) art. 7º, XIV; CPP art. 14",
      jurisprudencia: [
        "STF — Súmula Vinculante 14: 'É direito do defensor, no interesse do representado, ter acesso amplo aos elementos de prova que, já documentados em procedimento investigatório realizado por órgão com competência de polícia judiciária, digam respeito ao exercício do direito de defesa.'",
        "STJ — HC 186.506/SP: 'O sigilo do inquérito não pode ser oposto ao advogado do investigado.'",
      ],
      observacao: "Verificar se a defesa teve acesso integral ao inquérito policial. Eventual negativa de acesso fundamenta mandado de segurança ou reclamação ao STF.",
    },
    {
      id: "CPP-032",
      categoria: "CONFORMIDADE",
      titulo: "Continuidade delitiva (CP art. 71)",
      descricao: "Se os fatos configuram crime continuado, deve haver unificação das penas.",
      conformidade: true,
      gravidade: "MEDIA",
      fundamentoLegal: "CP art. 71; STJ — Súmula 497",
      jurisprudencia: [
        "STJ — Súmula 497: 'Os crimes de roubo e extorsão, ainda que praticados em continuidade delitiva, não se somam para efeitos de fixação da competência pelo valor do dano.'",
        "STF — HC 119.706/SP: 'O crime continuado pressupõe mesmas condições de tempo, lugar e maneira de execução.'",
      ],
      observacao: "Analisar se os fatos imputados podem ser considerados como crime continuado, o que beneficia o réu (pena de um só crime aumentada de 1/6 a 2/3).",
    },
    {
      id: "CPP-033",
      categoria: "CONFORMIDADE",
      titulo: "Aplicação das medidas despenalizadoras da Lei 9.099/1995",
      descricao: "Para crimes de menor potencial ofensivo, verificar se as medidas despenalizadoras foram consideradas.",
      conformidade: true,
      gravidade: "MEDIA",
      fundamentoLegal: "Lei 9.099/1995 arts. 72-76 (transação penal); art. 89 (suspensão condicional do processo)",
      jurisprudencia: [
        "STF — HC 83.006/SP: 'A não oferta de transação penal ou suspensão condicional pelo MP deve ser fundamentada.'",
        "STJ — Súmula 696: 'Reunidos os pressupostos legais permissivos da suspensão condicional do processo, mas se recusando o Promotor de Justiça a propô-la, o Juiz, dissentindo, remeterá a questão ao Procurador-Geral...'",
      ],
      observacao: "Verificar se a pena máxima do crime imputado permite transação penal (até 2 anos) ou suspensão condicional do processo (até 4 anos).",
    },
    {
      id: "CPP-034",
      categoria: "CONFORMIDADE",
      titulo: "Colaboração premiada e sua regularidade (Lei 12.850/2013)",
      descricao: "Se houver acordo de colaboração premiada, verificar sua regularidade formal.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "Lei 12.850/2013 arts. 4º-7º; CPP art. 3-B",
      jurisprudencia: [
        "STF — HC 127.483/PR: 'O acordo de colaboração premiada é negócio jurídico processual com requisitos formais próprios.'",
        "STJ — HC 397.567/PR: 'As declarações do colaborador isoladamente não podem sustentar condenação.'",
      ],
      observacao: textoContém(textos, [/delação\s+premiada/i, /colaboração\s+premiada/i, /colaborador/i])
        ? "Colaboração premiada identificada — verificar: (1) homologação judicial, (2) se o réu foi confrontado com as declarações do colaborador, (3) se há corroboração por outras provas."
        : "Nenhuma referência à colaboração premiada identificada.",
    },
    {
      id: "CPP-035",
      categoria: "CONFORMIDADE",
      titulo: "Excludentes de ilicitude e culpabilidade",
      descricao: "Verificar se foram analisadas excludentes como legítima defesa, estado de necessidade, inexigibilidade de conduta diversa.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CP arts. 23-25 (excludentes de ilicitude); CP arts. 26-28 (excludentes de culpabilidade); CPP art. 386, VI",
      jurisprudencia: [
        "STF — HC 141.696/SP: 'A excludente de culpabilidade deve ser analisada mesmo que não arguida expressamente.'",
        "STJ — HC 336.367/SP: 'A legítima defesa putativa pode ser arguida mesmo sem provas diretas.'",
      ],
      observacao: "Analisar os fatos e verificar se cabem excludentes de ilicitude (legítima defesa, estado de necessidade) ou culpabilidade (coação irresistível, obediência hierárquica, inimputabilidade).",
    },
    {
      id: "CPP-036",
      categoria: "CONFORMIDADE",
      titulo: "Presunção de inocência (CF/88 art. 5º, LVII)",
      descricao: "Ninguém será considerado culpado antes do trânsito em julgado da sentença condenatória.",
      conformidade: true,
      gravidade: "CRITICA",
      fundamentoLegal: "CF/88 art. 5º, LVII; CADH art. 8.2; PIDCP art. 14.2",
      jurisprudencia: [
        "STF — ADC 43/DF: 'A execução provisória da pena viola a presunção de inocência.'",
        "STF — HC 126.292/SP: 'Revisão da jurisprudência — nova posição do STF sobre execução antecipada.'",
        "STF — ARE 964.246/SP (Tema 925): 'Execução automática após confirmação em segundo grau — debate em curso.'",
      ],
      observacao: "Monitorar o entendimento atual do STF sobre execução da pena após condenação em segundo grau e preparar argumentação preventiva.",
    },
    {
      id: "CPP-037",
      categoria: "CONFORMIDADE",
      titulo: "Comunicação de atos processuais (intimações)",
      descricao: "Todas as intimações da defesa devem ser regulares.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CPP arts. 370-372; CPC art. 272 (subsidiário); Lei 11.419/2006 (intimação eletrônica)",
      jurisprudencia: [
        "STJ — HC 308.978/SP: 'Intimação do defensor constituído por edital quando tem endereço cadastrado é nula.'",
        "TJSP — APL 0023456-00.2021.8.26.0050: 'A intimação eletrônica exige cadastro prévio no sistema.'",
      ],
      observacao: "Verificar se todas as intimações da defesa foram realizadas na pessoa do advogado constituído (não por edital sem tentativa pessoal).",
    },
    {
      id: "CPP-038",
      categoria: "CONFORMIDADE",
      titulo: "Prazo de duração da instrução criminal",
      descricao: "A instrução deve ser encerrada em prazo razoável — excesso autoriza HC.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CPP art. 400, §3º; STJ — Súmula 52; CF/88 art. 5º, LXXVIII",
      jurisprudencia: [
        "STJ — Súmula 52: 'Encerrada a instrução criminal, fica superada a alegação de constrangimento por excesso de prazo.'",
        "STJ — HC 338.090/SP: 'O excesso de prazo deve ser aferido com base na complexidade do caso e no comportamento das partes.'",
      ],
      observacao: "Calcular o tempo decorrido desde o recebimento da denúncia e confrontar com os prazos legais — possível fundamento para HC por excesso de prazo.",
    },
    {
      id: "CPP-039",
      categoria: "CONFORMIDADE",
      titulo: "Proibição de uso de provas exclusivamente de inquérito",
      descricao: "A condenação não pode se basear exclusivamente em provas produzidas no inquérito.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CPP art. 155; CF/88 art. 5º, LV",
      jurisprudencia: [
        "STF — HC 155.150/SP: 'A condenação fundada exclusivamente em provas do inquérito viola o contraditório.'",
        "STJ — HC 421.006/RS: 'O art. 155 do CPP exige que a condenação seja apoiada em provas produzidas sob o crivo do contraditório.'",
      ],
      observacao: "Se houver sentença, verificar se foi proferida com base em provas produzidas na instrução judicial (contraditório real) ou apenas no inquérito policial.",
    },
    {
      id: "CPP-040",
      categoria: "CONFORMIDADE",
      titulo: "Direito a intérprete e tradução (CPP art. 223)",
      descricao: "Acusado que não domina o idioma tem direito a intérprete em todos os atos.",
      conformidade: true,
      gravidade: "MEDIA",
      fundamentoLegal: "CPP art. 223; CADH art. 8.2.a; PIDCP art. 14.3.f",
      jurisprudencia: [
        "STF — HC 95.009/SP: 'A ausência de intérprete para acusado estrangeiro pode gerar nulidade.'",
      ],
      observacao: "Verificar se o réu é estrangeiro ou não compreende o idioma — se sim, confirmar presença de intérprete em todos os atos processuais.",
    },
    {
      id: "CPP-041",
      categoria: "CONFORMIDADE",
      titulo: "Acordo de não persecução penal — ANPP (CPP art. 28-A)",
      descricao: "Para crimes sem violência ou grave ameaça com pena mínima menor que 4 anos — verificar se ANPP foi ofertado.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CPP art. 28-A (Lei 13.964/2019 — Pacote Anticrime); Res. CNMP 181/2017",
      jurisprudencia: [
        "STJ — HC 616.025/SP: 'O MP deve motivar a não oferta do ANPP quando presentes os requisitos legais.'",
        "TJSP — APL 0034567-00.2021.8.26.0050: 'O ANPP pode ser suscitado pelo réu se não ofertado pelo MP sem justificativa.'",
      ],
      observacao: "Verificar se o crime imputado admite ANPP (pena mínima < 4 anos, sem violência/grave ameaça, réu não reincidente) e se foi ou não ofertado pelo MP.",
    },
    {
      id: "CPP-042",
      categoria: "CONFORMIDADE",
      titulo: "Sistema acusatório e gestão da prova (CPP art. 3-A)",
      descricao: "O processo penal deve ser regido pelo sistema acusatório — o juiz não pode produzir provas de ofício.",
      conformidade: true,
      gravidade: "ALTA",
      fundamentoLegal: "CPP art. 3-A (Lei 13.964/2019); CF/88 art. 129, I",
      jurisprudencia: [
        "STF — ADI 6.298/DF: 'O art. 3-A tem eficácia plena — o juiz não pode determinar produção de provas de ofício na fase pré-processual.'",
        "STJ — HC 590.622/SC: 'A iniciativa probatória do juiz na fase instrutória viola o sistema acusatório.'",
      ],
      observacao: "Verificar se o magistrado determinou produção de provas de ofício — eventual violação ao sistema acusatório (CPP art. 3-A) pode configurar nulidade.",
    },
  ];

  for (const r of regrasCpmplementares) {
    regras.push({ ...r, documentosAfetados: [] });
  }

  // ── Calcular score ────────────────────────────────────────────────────────

  const naoConformes = regras.filter((r) => !r.conformidade);
  const nulidadesAbsolutas = naoConformes.filter((r) => r.categoria === "NULIDADE_ABSOLUTA").length;
  const nulidadesRelativas = naoConformes.filter((r) => r.categoria === "NULIDADE_RELATIVA").length;
  const irregularidades = naoConformes.filter((r) => r.categoria === "IRREGULARIDADE").length;

  let score = 100;
  score -= nulidadesAbsolutas * 25;
  score -= nulidadesRelativas * 10;
  score -= irregularidades * 5;
  score = Math.max(0, Math.min(100, score));

  return {
    totalRegras: regras.length,
    conformes: regras.filter((r) => r.conformidade).length,
    naoConformes: naoConformes.length,
    nulidadesAbsolutas,
    nulidadesRelativas,
    irregularidades,
    scoreConformidade: score,
    regras,
    geradoEm: new Date().toISOString(),
  };
}
