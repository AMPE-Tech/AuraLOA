#!/usr/bin/env tsx
// AuraLEGAL — CLI de Análise Processual
// Uso: npx tsx scripts/analisar-processo.ts --processo="..." --tribunal=tjsp

import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

// ── Parse de argumentos ───────────────────

const { values } = parseArgs({
  options: {
    processo:  { type: 'string' },
    tribunal:  { type: 'string', default: 'tjsp' },
    senha:     { type: 'string' },
    defensora: { type: 'string' },
    cliente:   { type: 'string' },
    saida:     { type: 'string' },
    retomar:   { type: 'boolean', default: false },
    ajuda:     { type: 'boolean', default: false },
  },
})

if (values.ajuda || !values.processo) {
  console.log(`
AuraLEGAL — Motor de Análise Processual
AuraTECH · Legal Intelligence Engine

Uso:
  npx tsx scripts/analisar-processo.ts [opções]

Opções obrigatórias:
  --processo    Número CNJ do processo (ex: 1503896-55.2022.8.26.0050)

Opções opcionais:
  --tribunal    Tribunal (padrão: tjsp)
  --senha       Senha de acesso (processos com segredo de justiça)
  --defensora   Nome da defensora/advogada
  --cliente     Nome do réu/cliente
  --saida       Diretório de saída (padrão: ./Saida/aura-legal/<processo>)
  --retomar     Retomar análise de onde parou (checkpoint)
  --ajuda       Exibe esta mensagem

Exemplos:
  npx tsx scripts/analisar-processo.ts \\
    --processo="1503896-55.2022.8.26.0050" \\
    --senha="[lida do .env via TJSP_SENHA]" \\
    --defensora="Dra. Márcia Mirtes" \\
    --cliente="[Nome do Réu]" \\
    --saida=./Saida/aura-legal/1503896

  # Retomar após interrupção:
  npx tsx scripts/analisar-processo.ts \\
    --processo="1503896-55.2022.8.26.0050" \\
    --retomar

Saída gerada:
  <saida>/
  ├── relatorio.html      → Relatório navegável (4 camadas)
  ├── laudo.pdf           → Laudo formal para protocolo
  ├── subsidios.docx      → Subsídios para Resposta à Acusação
  ├── inventario.csv      → Inventário completo de peças
  ├── analise.json        → Dados brutos da análise
  └── pipeline.log        → Log completo do pipeline
`)
  process.exit(0)
}

// ── Configuração ──────────────────────────

const processoNum = values.processo!
// Senha: argumento CLI tem prioridade, depois .env
const senha = values.senha || process.env.TJSP_SENHA || ''

const saidaDir = values.saida
  ? resolve(values.saida)
  : resolve(`./Saida/aura-legal/${processoNum.replace(/[^0-9]/g, '_')}`)

if (!existsSync(saidaDir)) {
  mkdirSync(saidaDir, { recursive: true })
}

// ── Banner ────────────────────────────────

console.log(`
─────────────────────────────────────────────────
  AuraLEGAL — Legal Intelligence Engine
  AuraTECH · Digital Trust Infrastructure
─────────────────────────────────────────────────

  Processo  : ${processoNum}
  Tribunal  : ${(values.tribunal ?? 'tjsp').toUpperCase()}
  Defensora : ${values.defensora ?? '—'}
  Cliente   : ${values.cliente ?? '—'}
  Saída     : ${saidaDir}
  Modo      : ${values.retomar ? 'Retomando checkpoint' : 'Nova análise'}

`)

// ── Execução ──────────────────────────────

async function main() {
  console.log('⏳ Inicializando pipeline...\n')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY não configurada no .env')
    process.exit(1)
  }

  if (!senha) {
    console.warn('⚠  TJSP_SENHA não encontrada — processos com segredo de justiça exigem senha')
  }

  try {
    const { OrquestradorAuraLEGAL } = await import('../src/agents/orquestrador.js')

    const processo = {
      id: processoNum.replace(/[^0-9]/g, ''),
      numeroCNJ: {
        raw: processoNum,
        sequencial: processoNum.split('-')[0] ?? '',
        digito: '00',
        ano: 2022,
        segmento: 8,
        tribunal: 26,
        origem: '0050',
        tribunalNome: (values.tribunal ?? 'TJSP').toUpperCase(),
      },
      tipo: 'criminal' as const,
      fase: 'denuncia' as const,
      segredoJustica: !!senha,
      totalLaudas: 0,
      defensora: values.defensora,
      cliente: values.cliente,
      dataAjuizamento: new Date(),
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    }

    const orquestrador = new OrquestradorAuraLEGAL({
      processo,
      diretorioArquivos: saidaDir,
      onProgresso: (estado) => {
        const concluidos = estado.agentes.filter(a => a.status === 'concluido').length
        const total = estado.agentes.length
        const barra = '█'.repeat(concluidos) + '░'.repeat(total - concluidos)
        process.stdout.write(`\r  Pipeline [${barra}] ${estado.progresso}% • ${estado.status}    `)
      },
    })

    console.log('  Iniciando análise...\n')
    const resultado = await orquestrador.executar()

    console.log(`\n\n✓ Análise concluída\n`)
    console.log(`  Peças analisadas  : ${resultado.totalPecasAnalisadas}`)
    console.log(`  Nulidades críticas: ${resultado.nulidades.absolutas}`)
    console.log(`  Score de risco    : ${resultado.scoreRiscoGeral}/100`)
    console.log(`\n  Saída gerada em   : ${saidaDir}\n`)

  } catch (erro) {
    console.error(`\n✗ Erro no pipeline:`, erro)
    process.exit(1)
  }
}

main()
