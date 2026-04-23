import { query } from "../db";

// ══════════════════════════════════════════════════════════════════════════
// Consolidador de Lote — agrupa N documentos em 1 checklist unificado
// ══════════════════════════════════════════════════════════════════════════

export interface DocAnalise {
  analise_id: string;
  validation_id: string;
  ordem: number;
  file_original_name: string;
  numero_cnj: string | null;
  tribunal: string | null;
  natureza_documento: string | null;
  tipo: string | null;
  credor_nome: string | null;
  credor_cpf_cnpj: string | null;
  devedor: string | null;
  valor_rs: number | null;
  data_transito: string | null;
  orgao_julgador: string | null;
  url_verificacao_tribunal: string | null;
  codigo_verificador: string | null;
  processos_identificados: any[];
  partes: any[];
  autoridades: any[];
  datas_identificadas: any[];
  decisao_resumo: string | null;
  status_processual: string | null;
  observacoes_gerais: any[];
}

export interface ItemConsolidado {
  valor: any;
  fontes: Array<{ ordem: number; validation_id: string; doc: string }>;
  conflito: boolean;
  valores_divergentes?: any[];
}

export interface ChecklistConsolidado {
  [campo: string]: ItemConsolidado;
}

export interface ConsolidacaoResult {
  total_docs: number;
  cnjs_encontrados: string[];
  cnj_consolidado: string | null;
  provavelmente_mesmo_caso: boolean;
  partes_em_comum: string[];
  checklist_consolidado: ChecklistConsolidado;
  total_conflitos: number;
  campos_preenchidos: number;
  total_campos: number;
}

function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectarMesmoCaso(docs: DocAnalise[]): {
  provavelmente_mesmo: boolean;
  partes_em_comum: string[];
  motivo: string;
} {
  if (docs.length < 2) {
    return { provavelmente_mesmo: true, partes_em_comum: [], motivo: "único documento" };
  }

  // CNJ idêntico → é o mesmo caso com certeza
  const cnjs = new Set(docs.filter((d) => d.numero_cnj).map((d) => d.numero_cnj));
  if (cnjs.size === 1) {
    return { provavelmente_mesmo: true, partes_em_comum: [], motivo: `CNJ único: ${[...cnjs][0]}` };
  }

  // CNJs diferentes → checar partes em comum
  const partesPorDoc = docs.map((d) => {
    const nomes: string[] = [];
    if (d.credor_nome) nomes.push(normalizeText(d.credor_nome));
    if (d.devedor) nomes.push(normalizeText(d.devedor));
    (d.partes || []).forEach((p) => {
      if (p?.nome) nomes.push(normalizeText(p.nome));
    });
    return new Set(nomes);
  });

  // Interseção entre todos os docs
  const comum = [...partesPorDoc[0]].filter((nome) => partesPorDoc.every((s) => s.has(nome)));

  // Se credor + devedor em comum → 95% o mesmo caso
  const credoresDocs = docs.map((d) => normalizeText(d.credor_nome)).filter(Boolean);
  const devedoresDocs = docs.map((d) => normalizeText(d.devedor)).filter(Boolean);
  const credorEmComum = credoresDocs.length > 0 && credoresDocs.every((c) => c === credoresDocs[0]);
  const devedorEmComum = devedoresDocs.length > 0 && devedoresDocs.every((d) => d === devedoresDocs[0]);

  if (credorEmComum && devedorEmComum) {
    return {
      provavelmente_mesmo: true,
      partes_em_comum: comum,
      motivo: `Credor e devedor idênticos entre docs (${credoresDocs[0]} vs ${devedoresDocs[0]}). CNJs diferentes = processos filhos do mesmo caso (originária + execução + recurso).`,
    };
  }

  if (comum.length >= 2) {
    return {
      provavelmente_mesmo: true,
      partes_em_comum: comum,
      motivo: `${comum.length} partes em comum entre docs`,
    };
  }

  return {
    provavelmente_mesmo: false,
    partes_em_comum: comum,
    motivo: "Credores/devedores diferentes ou partes sem correspondência — precisa revisão",
  };
}

function campoConsolidado(
  docs: DocAnalise[],
  pick: (d: DocAnalise) => any,
): ItemConsolidado {
  const contribuicoes: Array<{ ordem: number; validation_id: string; doc: string; valor: any }> = [];
  for (const d of docs) {
    const v = pick(d);
    if (v !== null && v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0)) {
      contribuicoes.push({ ordem: d.ordem, validation_id: d.validation_id, doc: d.file_original_name, valor: v });
    }
  }

  if (contribuicoes.length === 0) {
    return { valor: null, fontes: [], conflito: false };
  }

  const valoresUnicos = Array.from(new Set(contribuicoes.map((c) => JSON.stringify(c.valor))));
  const conflito = valoresUnicos.length > 1;

  return {
    valor: contribuicoes[0].valor, // pega primeiro como "principal"
    fontes: contribuicoes.map((c) => ({ ordem: c.ordem, validation_id: c.validation_id, doc: c.doc })),
    conflito,
    ...(conflito ? { valores_divergentes: valoresUnicos.map((v) => JSON.parse(v)) } : {}),
  };
}

export function consolidarLote(docs: DocAnalise[]): ConsolidacaoResult {
  const cnjsSet = new Set(docs.filter((d) => d.numero_cnj).map((d) => d.numero_cnj as string));
  const cnjsEncontrados = [...cnjsSet];

  const { provavelmente_mesmo, partes_em_comum } = detectarMesmoCaso(docs);

  const cnjConsolidado = cnjsEncontrados.length === 1 ? cnjsEncontrados[0] : null;

  const chk: ChecklistConsolidado = {
    natureza_documento: campoConsolidado(docs, (d) => d.natureza_documento),
    numero_cnj: campoConsolidado(docs, (d) => d.numero_cnj),
    tribunal: campoConsolidado(docs, (d) => d.tribunal),
    tipo: campoConsolidado(docs, (d) => d.tipo),
    credor_nome: campoConsolidado(docs, (d) => d.credor_nome),
    credor_cpf_cnpj: campoConsolidado(docs, (d) => d.credor_cpf_cnpj),
    devedor: campoConsolidado(docs, (d) => d.devedor),
    valor_rs: campoConsolidado(docs, (d) => d.valor_rs),
    data_transito: campoConsolidado(docs, (d) => d.data_transito),
    orgao_julgador: campoConsolidado(docs, (d) => d.orgao_julgador),
    url_verificacao_tribunal: campoConsolidado(docs, (d) => d.url_verificacao_tribunal),
    codigo_verificador: campoConsolidado(docs, (d) => d.codigo_verificador),
    decisao_resumo: campoConsolidado(docs, (d) => d.decisao_resumo),
    status_processual: campoConsolidado(docs, (d) => d.status_processual),
  };

  // Merge arrays: processos, partes, autoridades, datas, observações — concatena sem duplicar
  const mergeArray = (pick: (d: DocAnalise) => any[]) => {
    const all: any[] = [];
    const seen = new Set<string>();
    for (const d of docs) {
      for (const item of pick(d) || []) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          all.push({ ...item, _fonte_ordem: d.ordem, _fonte_doc: d.file_original_name });
        }
      }
    }
    return all;
  };

  chk["processos_identificados"] = {
    valor: mergeArray((d) => d.processos_identificados),
    fontes: docs.map((d) => ({ ordem: d.ordem, validation_id: d.validation_id, doc: d.file_original_name })),
    conflito: false,
  };
  chk["partes"] = {
    valor: mergeArray((d) => d.partes),
    fontes: docs.map((d) => ({ ordem: d.ordem, validation_id: d.validation_id, doc: d.file_original_name })),
    conflito: false,
  };
  chk["autoridades"] = {
    valor: mergeArray((d) => d.autoridades),
    fontes: docs.map((d) => ({ ordem: d.ordem, validation_id: d.validation_id, doc: d.file_original_name })),
    conflito: false,
  };
  chk["datas_identificadas"] = {
    valor: mergeArray((d) => d.datas_identificadas),
    fontes: docs.map((d) => ({ ordem: d.ordem, validation_id: d.validation_id, doc: d.file_original_name })),
    conflito: false,
  };
  chk["observacoes_gerais"] = {
    valor: mergeArray((d) => (d.observacoes_gerais || []).map((o) => ({ obs: o }))),
    fontes: docs.map((d) => ({ ordem: d.ordem, validation_id: d.validation_id, doc: d.file_original_name })),
    conflito: false,
  };

  const totalConflitos = Object.values(chk).filter((it) => it.conflito).length;
  const campos_preenchidos = Object.values(chk).filter((it) => {
    const v = it.valor;
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;

  return {
    total_docs: docs.length,
    cnjs_encontrados: cnjsEncontrados,
    cnj_consolidado: cnjConsolidado,
    provavelmente_mesmo_caso: provavelmente_mesmo,
    partes_em_comum,
    checklist_consolidado: chk,
    total_conflitos: totalConflitos,
    campos_preenchidos,
    total_campos: Object.keys(chk).length,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Loader: busca docs de um lote no banco
// ══════════════════════════════════════════════════════════════════════════
export async function loadLoteDocs(loteId: string): Promise<DocAnalise[]> {
  const rows = await query<any>(
    `SELECT
       a.id AS analise_id, a.validation_id, ld.ordem, a.file_original_name,
       a.numero_cnj, a.tribunal, a.natureza_documento, a.tipo,
       a.credor_nome, a.credor_cpf_cnpj, a.devedor,
       a.valor_rs, a.data_transito, a.orgao_julgador,
       a.url_verificacao_tribunal, a.codigo_verificador,
       a.processos_identificados, a.partes, a.autoridades,
       a.datas_identificadas, a.decisao_resumo, a.status_processual,
       a.observacoes_gerais
     FROM v2_lote_docs ld
     JOIN v2_analises a ON a.id = ld.analise_id
     WHERE ld.lote_id = $1
     ORDER BY ld.ordem`,
    [loteId],
  );

  return rows.map((r) => ({
    analise_id: r.analise_id,
    validation_id: r.validation_id,
    ordem: r.ordem,
    file_original_name: r.file_original_name,
    numero_cnj: r.numero_cnj,
    tribunal: r.tribunal,
    natureza_documento: r.natureza_documento,
    tipo: r.tipo,
    credor_nome: r.credor_nome,
    credor_cpf_cnpj: r.credor_cpf_cnpj,
    devedor: r.devedor,
    valor_rs: r.valor_rs != null ? Number(r.valor_rs) : null,
    data_transito: r.data_transito,
    orgao_julgador: r.orgao_julgador,
    url_verificacao_tribunal: r.url_verificacao_tribunal,
    codigo_verificador: r.codigo_verificador,
    processos_identificados: r.processos_identificados ?? [],
    partes: r.partes ?? [],
    autoridades: r.autoridades ?? [],
    datas_identificadas: r.datas_identificadas ?? [],
    decisao_resumo: r.decisao_resumo,
    status_processual: r.status_processual,
    observacoes_gerais: r.observacoes_gerais ?? [],
  }));
}
