/**
 * extrair_loa.cjs — Extrai precatórios do PDF LOA 2026 usando pdf-parse
 *
 * ATENÇÃO: pdf-parse concatena colunas sem separador.
 * O formato da linha de dados é:
 *   TIPO_CAUSA + NUMERO_PRECATORIO + VALOR + ANO (tudo junto)
 *
 * Exemplos reais do texto bruto:
 *   STJ:  "ALIMENTAR011.161.6342024"
 *   STJ:  "Administrativo - Militar - Pensão12830322.4922024"
 *   TRF3: "1235479720244030000188.9622026"
 *   TRF4: "Aposentadoria Especial (Art. 57/8)50333047620244000000188.0682026"
 *
 * Estratégia: capturar do FINAL — valor (com pontos) + ano (4 dígitos)
 * O prefixo contém tipo_causa + nº precatório (+ possível CNJ nos TRFs)
 */

const fs = require('fs');
const pdf = require('pdf-parse');

const PDF_PATH = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/Área de Trabalho/ClaudeCode/ArquivosLOA/LOA_2026/LOA_2026_Federal/LOA2026_CONSULTA_PRECATORIOS.pdf';
const CSV_PATH = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/Área de Trabalho/ClaudeCode/ArquivosLOA/LOA_2026/precatorios_extraidos.csv';

async function main() {
  console.log('[extrair_loa] Lendo PDF...');
  const data = fs.readFileSync(PDF_PATH);
  const result = await pdf(data);

  console.log('[extrair_loa] Páginas:', result.numpages);
  console.log('[extrair_loa] Texto:', (result.text.length / 1024 / 1024).toFixed(1), 'MB');

  const linhas = result.text.split('\n');
  console.log('[extrair_loa] Linhas totais:', linhas.length);

  // Estado do parser
  let uoCadastradora = '';
  let uoCadastradoraCodigo = '';
  let uoDevedora = '';
  let uoDevedoraCodigo = '';
  let tipoCausaBuffer = ''; // Acumula linhas de tipo_causa que quebram em múltiplas linhas

  const registros = [];
  let linhasIgnoradas = 0;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;

    // Ignorar cabeçalhos de página
    if (l.includes('CONGRESSO NACIONAL') ||
        l.includes('PRECATÓRIOS 2026') ||
        l.includes('TIPO CAUSA') ||
        l.includes('VALOR (R$)') ||
        l.match(/^\d+ de 5887$/) ||
        l === 'Pág.' ||
        l.match(/^\d{2}\/\d{2}\/\d{4}/) ||
        l === 'Emissão:' ||
        l === 'ANO' ||
        l === 'UO CADASTRADORA' ||
        l === 'UO DEVEDORA') {
      continue;
    }

    // Detectar UO Cadastradora
    // Formato: "Superior Tribunal de Justiça11101" ou "TRF - 3a. Região12104"
    if (l.startsWith('UO CADASTRADORA:')) {
      continue; // A próxima linha terá o código + nome
    }

    // Formato: "11101Superior Tribunal de Justiça" (código no início)
    const cadMatch = l.match(/^(\d{5})(.+)$/);
    if (cadMatch && !l.match(/\d{4}$/) && cadMatch[2].length > 3) {
      // Verificar se a linha anterior era "UO CADASTRADORA:" ou "UO DEVEDORA:"
      const prev = (linhas[i-1] || '').trim();
      if (prev === 'UO CADASTRADORA:' || prev.includes('UO CADASTRADORA')) {
        uoCadastradoraCodigo = cadMatch[1];
        uoCadastradora = cadMatch[2].trim();
        continue;
      }
      if (prev === 'UO DEVEDORA:' || prev.includes('UO DEVEDORA')) {
        uoDevedoraCodigo = cadMatch[1];
        uoDevedora = cadMatch[2].trim();
        continue;
      }
    }

    // Formato do cabeçalho: "Supremo Tribunal Federal10101" (nome + código no final)
    const cadMatch2 = l.match(/^([A-Za-zÀ-ú\s.\-]+?)(\d{5})$/);
    if (cadMatch2) {
      // Pode ser UO Cadastradora ou outra coisa — verificar contexto
      const nextLine = (linhas[i+1] || '').trim();
      if (nextLine === 'UO CADASTRADORA' || nextLine === 'UO CADASTRADORA:') {
        uoCadastradoraCodigo = cadMatch2[2];
        uoCadastradora = cadMatch2[1].trim();
      }
      continue;
    }

    // Linha de dados: termina com VALOR.PONTUADO + ANO(2024|2025|2026)
    const dataMatch = l.match(/(\d{1,3}(?:\.\d{3})+)(20(?:24|25|26))$/);
    if (dataMatch) {
      const valorStr = dataMatch[1];
      const ano = dataMatch[2];
      const valor = parseInt(valorStr.replace(/\./g, ''));

      if (isNaN(valor) || valor <= 0) {
        linhasIgnoradas++;
        continue;
      }

      // O prefixo contém tipo_causa + nº precatório (concatenados)
      const prefixo = l.substring(0, l.length - dataMatch[0].length);

      // Se o prefixo está vazio, o tipo_causa estava nas linhas anteriores
      let tipoCausa = '';
      let blocoDigitos = '';

      if (prefixo) {
        // Separar texto (tipo_causa) dos dígitos finais (nº prec + possível CNJ)
        const sepMatch = prefixo.match(/^(.*?)(\d+)$/);
        if (sepMatch) {
          tipoCausa = (sepMatch[1] || tipoCausaBuffer).trim().replace(/\s*-\s*$/, '');
          blocoDigitos = sepMatch[2];
        } else {
          // Prefixo é só texto (tipo_causa) — dígitos são do valor
          tipoCausa = (prefixo || tipoCausaBuffer).trim().replace(/\s*-\s*$/, '');
        }
      } else {
        tipoCausa = tipoCausaBuffer.trim().replace(/\s*-\s*$/, '');
      }

      // Limpar tipo_causa de artefatos
      if (tipoCausa.startsWith('ALIMENTAR') || tipoCausa.startsWith('COMUM')) {
        // STF: formato "ALIMENTAR" ou "COMUM - FUNDEF"
        // blocoDigitos contém o nº precatório
      }

      registros.push({
        uo_cadastradora: uoCadastradoraCodigo + ' ' + uoCadastradora,
        uo_devedora: uoDevedoraCodigo + ' ' + uoDevedora,
        ano,
        precatorio: blocoDigitos || '',
        tipo_causa: tipoCausa || '',
        valor,
      });

      tipoCausaBuffer = ''; // Reset
      continue;
    }

    // Se a linha não é cabeçalho nem dados, pode ser continuação do tipo_causa
    if (l.match(/^[A-Za-zÀ-ú]/) && !l.match(/^\d{5}/) && l.length > 5) {
      tipoCausaBuffer = (tipoCausaBuffer ? tipoCausaBuffer + ' ' : '') + l;
    }
  }

  console.log('[extrair_loa] Registros extraídos:', registros.length);
  console.log('[extrair_loa] Linhas ignoradas:', linhasIgnoradas);

  // Estatísticas
  const totalValor = registros.reduce((s, r) => s + r.valor, 0);
  console.log('[extrair_loa] Valor total: R$', (totalValor / 1e9).toFixed(2), 'bilhões');

  const acima10M = registros.filter(r => r.valor >= 10000000);
  console.log('[extrair_loa] >= R$10M:', acima10M.length);

  // Amostra
  console.log('\n[extrair_loa] Amostra (primeiros 5):');
  registros.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i+1}. UO_CAD: ${r.uo_cadastradora.substring(0,30)} | UO_DEV: ${r.uo_devedora.substring(0,25)} | Prec: ${r.precatorio.substring(0,15)} | Tipo: ${r.tipo_causa.substring(0,30)} | R$ ${r.valor.toLocaleString('pt-BR')} | ${r.ano}`);
  });

  console.log('\n[extrair_loa] Amostra (maiores 5):');
  registros.sort((a, b) => b.valor - a.valor).slice(0, 5).forEach((r, i) => {
    console.log(`  ${i+1}. R$ ${r.valor.toLocaleString('pt-BR')} | ${r.uo_cadastradora.substring(0,30)} | ${r.tipo_causa.substring(0,40)}`);
  });

  // Salvar CSV
  // Reordenar por UO Cadastradora + valor
  registros.sort((a, b) => {
    if (a.uo_cadastradora !== b.uo_cadastradora) return a.uo_cadastradora.localeCompare(b.uo_cadastradora);
    return b.valor - a.valor;
  });

  const header = 'UO_Cadastradora;UO_Devedora;Ano;Precatorio;Tipo_Causa;Valor_RS\n';
  const csv = header + registros.map(r =>
    [r.uo_cadastradora, r.uo_devedora, r.ano, r.precatorio, r.tipo_causa.replace(/;/g, ','), r.valor].join(';')
  ).join('\n');

  fs.writeFileSync(CSV_PATH, csv);
  console.log('\n[extrair_loa] CSV salvo:', CSV_PATH);
  console.log('[extrair_loa] Tamanho:', (fs.statSync(CSV_PATH).size / 1024).toFixed(0), 'KB');
}

main().catch(e => console.error('[extrair_loa] ERRO:', e.message));
