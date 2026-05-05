// Passo 1: Mostrar texto bruto de páginas distribuídas para validar padrão
// NÃO parsear ainda — apenas mostrar o que pdf-parse gera

const fs = require('fs');
const pdf = require('pdf-parse');

const PDF_PATH = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/Área de Trabalho/ClaudeCode/ArquivosLOA/LOA_2026/LOA_2026_Federal/LOA2026_CONSULTA_PRECATORIOS.pdf';

async function main() {
  console.log('[AMOSTRA] Lendo PDF...');
  const data = fs.readFileSync(PDF_PATH);
  const result = await pdf(data);

  console.log('Total páginas:', result.numpages);
  console.log('Tamanho texto:', (result.text.length / 1024 / 1024).toFixed(1), 'MB');

  // Dividir por páginas (separadas por "Pág.")
  const paginas = result.text.split(/\d+ de 5887\nPág\./);
  console.log('Blocos encontrados:', paginas.length);

  // Mostrar amostra de 3 páginas: início (STF/STJ), meio (TRF3), fim (TRT)
  const indices = [1, Math.floor(paginas.length * 0.3), Math.floor(paginas.length * 0.7)];

  for (const idx of indices) {
    if (!paginas[idx]) continue;
    const linhas = paginas[idx].split('\n').filter(l => l.trim());
    console.log(`\n${'='.repeat(80)}`);
    console.log(`BLOCO ${idx} — primeiras 25 linhas:`);
    console.log('='.repeat(80));
    linhas.slice(0, 25).forEach((l, i) => {
      console.log(`${String(i).padStart(2)}: [${l}]`);
    });
  }
}

main().catch(e => console.error('ERRO:', e.message));
