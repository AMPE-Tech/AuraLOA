// Parsear TODOS os editais de acordo (30 PDFs)
// Extracao: CNJs (20-digitos) + metadados (entidade, ano, codigo_comunicado, codigo_filefetch)
// Valores/credores estao em IMAGEM - nao extractiveis sem OCR (nao feito nesta fase)

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/editais_acordo';
const OUT_CSV = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/ArquivosLOA/camada2/tjsp/tjsp_editais_acordo_cnjs.csv';
const OUT_CSV_PUB = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/\u00c1rea de Trabalho/ClaudeCode/AuraLOA/client/public/data/tjsp_editais_acordo_cnjs.csv';

// Mapeamento nome amigavel + codigo comunicado (origem)
const MAPA_ENTIDADE = {
  '64600': 'MUNICÍPIO DE ITANHAÉM',
  '64599': 'MUNICÍPIO DE ITAPIRA',
  '20128': 'PREFEITURA MUNICIPAL DE ROSANA',
  '32394': 'PREFEITURA MUNICIPAL DE OSASCO',
  '64471': 'FAZENDA DO ESTADO DE SÃO PAULO',
  '32395': 'PREFEITURA MUNICIPAL DE MARÍLIA',
  '19842': 'PREFEITURA MUNICIPAL DE GUARULHOS',
  '32392': 'PREFEITURA MUNICIPAL DE CAMPINAS',
  '32453': 'PREFEITURA MUNICIPAL DE COTIA',
  '26998': 'PREFEITURA MUNICIPAL DE ANDRADINA',
};

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

(async () => {
  const arquivos = fs.readdirSync(BASE).filter(f => f.endsWith('.pdf'));
  console.log(`PDFs: ${arquivos.length}`);

  const registros = [];
  let totalCnjs = 0, totalPdfsComTexto = 0, totalPdfsSemTexto = 0;

  for (const arq of arquivos) {
    // parse nome: edital_{codigo}_{idx}_{slug}.pdf
    const m = arq.match(/^edital_(\d+)_(\d+)_(.+)\.pdf$/);
    if (!m) continue;
    const codCom = m[1];
    const idxAnexo = m[2];
    const slug = m[3];
    const entidade = MAPA_ENTIDADE[codCom] || '?';

    // Deduz ano do edital pelo slug (ex: "01_2025", "01_2024")
    const anoMatch = slug.match(/0\d[_-](\d{4})|_(\d{4})[_-]/);
    const anoEdital = anoMatch ? (anoMatch[1] || anoMatch[2]) : null;

    // Deduz n edital (ex: 01/2025)
    const nEditalMatch = slug.match(/(\d{2})[_-](\d{4})/);
    const nEdital = nEditalMatch ? `${nEditalMatch[1]}/${nEditalMatch[2]}` : null;

    const buf = fs.readFileSync(path.join(BASE, arq));
    try {
      const d = await pdf(buf);
      const txt = d.text || '';
      // Extrai CNJs 20-digitos
      const cnjs = [...(txt.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [])];
      const cnjsUnicos = [...new Set(cnjs)];

      // Extrai data de protocolo (cabecalho digital)
      const dataProto = txt.match(/Protocolado em (\d{2}\/\d{2}\/\d{4})/);
      const dataProtocolo = dataProto ? dataProto[1] : null;

      // Extrai numero protocolo (WDEP...)
      const numProto = txt.match(/n[\u00fa\u00b0]mero (WDEP\d+)/);
      const numeroProtocolo = numProto ? numProto[1] : null;

      // Extrai codigo de acesso aos autos (4-8 chars apos 'codigo')
      const codAcesso = txt.match(/c[\u00f3o]digo ([a-zA-Z0-9]{4,10})\b/);
      const codigoAcesso = codAcesso ? codAcesso[1] : null;

      if (cnjsUnicos.length === 0) {
        totalPdfsSemTexto++;
        continue;
      }
      totalPdfsComTexto++;
      totalCnjs += cnjsUnicos.length;

      for (const cnj of cnjsUnicos) {
        registros.push({
          cnj,
          entidade_devedora: entidade,
          tipo_entidade: entidade.startsWith('FAZENDA') ? 'estadual' : 'municipal',
          codigo_comunicado: codCom,
          idx_anexo: idxAnexo,
          numero_edital: nEdital,
          ano_edital: anoEdital,
          data_protocolo: dataProtocolo,
          numero_protocolo: numeroProtocolo,
          codigo_acesso_esaj: codigoAcesso,
          arquivo_pdf: arq,
          paginas_pdf: d.numpages,
          url_comunicado: `https://www.tjsp.jus.br/Precatorios/Comunicados/Comunicado?codigoComunicado=${codCom}&pagina=1`,
          url_esaj_consulta: codigoAcesso
            ? `https://esaj.tjsp.jus.br/cpopg/search.do?cbPesquisa=NUMPROC&dadosConsulta.valorConsulta=${encodeURIComponent(cnj)}`
            : `https://esaj.tjsp.jus.br/cpopg/search.do?cbPesquisa=NUMPROC&dadosConsulta.valorConsulta=${encodeURIComponent(cnj)}`,
          status_acordo: 'EM_EDITAL',
          fonte: 'TJSP Edital de Acordo (PDF oficial)',
          observacao: 'Valores, des\u00e1gio e credor est\u00e3o em imagem do PDF (scan) - n\u00e3o extra\u00eddos nesta fase.',
        });
      }
    } catch (e) {
      console.log(`ERRO ${arq}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`\nPDFs com CNJ extra\u00eddo: ${totalPdfsComTexto}`);
  console.log(`PDFs sem CNJ (imagem pura): ${totalPdfsSemTexto}`);
  console.log(`CNJs totais (com duplicatas entre editais): ${totalCnjs}`);

  // Deduplicar por (cnj + codigo_comunicado + idx_anexo)
  const mapa = new Map();
  for (const r of registros) {
    const k = `${r.cnj}|${r.codigo_comunicado}|${r.idx_anexo}`;
    if (!mapa.has(k)) mapa.set(k, r);
  }
  const unicos = [...mapa.values()];
  console.log(`Registros \u00fanicos (cnj+edital): ${unicos.length}`);

  // Sumario por entidade
  const porEnt = {};
  for (const r of unicos) {
    porEnt[r.entidade_devedora] = (porEnt[r.entidade_devedora] || 0) + 1;
  }
  console.log('\nCNJs por entidade:');
  for (const [e, n] of Object.entries(porEnt).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${e.padEnd(45)} ${n}`);
  }

  // Sumario por ano de edital
  const porAno = {};
  for (const r of unicos) {
    const a = r.ano_edital || '?';
    porAno[a] = (porAno[a] || 0) + 1;
  }
  console.log('\nCNJs por ano edital:');
  for (const [a, n] of Object.entries(porAno).sort()) {
    console.log(`  ${a}: ${n}`);
  }

  // Escrever CSV
  const header = [
    'cnj', 'entidade_devedora', 'tipo_entidade',
    'codigo_comunicado', 'idx_anexo',
    'numero_edital', 'ano_edital',
    'data_protocolo', 'numero_protocolo', 'codigo_acesso_esaj',
    'arquivo_pdf', 'paginas_pdf',
    'url_comunicado', 'url_esaj_consulta',
    'status_acordo', 'fonte', 'observacao',
  ];
  const csv = [header.join(',')];
  for (const r of unicos) {
    csv.push(header.map(h => csvEscape(r[h])).join(','));
  }
  const txt = csv.join('\n') + '\n';
  fs.writeFileSync(OUT_CSV, txt, 'utf-8');
  fs.writeFileSync(OUT_CSV_PUB, txt, 'utf-8');
  console.log(`\n[CSV] ${OUT_CSV}`);
  console.log(`[CSV] ${OUT_CSV_PUB}`);
  console.log(`Total: ${unicos.length} linhas`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
