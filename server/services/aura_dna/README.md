# AuraDNA™ — Motor de Validação de Ativos Judiciais

Módulo NOVO. Não altera nada de `server/services/*` existente.
Pode reusar (copiar trecho, importar tipos públicos), nunca modificar.

## Premissa de produto

Cliente entra com identificador que ele JÁ POSSUI (CNJ, CPF, CNPJ, número precatório, ofício requisitório).
O motor enriquece em 5 camadas e devolve dossiê + Score de Confiabilidade.

Não baixamos lista massiva de credores. Não violamos sigilo CNJ 303/2019.
Cliente é parte legítima ou cessionário — tem direito de consultar o ativo dele.

## 5 camadas

| # | Camada | Fonte | O que extrai |
|---|--------|-------|--------------|
| 1 | Processo | DataJud CNJ (api-publica) classe 1265/1266 | metadados processuais, movimentos, classe |
| 2 | Tribunal | Mapa Anual Precatórios (Art. 85 Res CNJ 303/2019) — TRF1-6 | nº precatório, CNJ originário, valor, data protocolo, fila |
| 3 | LOA | SIOP `expedidos_AAAA.csv` + LOA_FULL_CONCILIADO | inclusão na LOA do exercício, dotação, UO devedora |
| 4 | Execução | Portal Transparência — empenho, liquidação, pagamento, restos a pagar | empenhado vs pago, ordens bancárias, status financeiro |
| 5 | Evidência | e-DJF (Diário Eletrônico) — regex em PDF | despachos públicos, expedição, habilitação, alvará, sucessores, cessão |

## Fluxo

```
INPUT (CNJ | CPF | CNPJ | nº precatório)
  │
  ├── orchestrator chama 5 camadas em paralelo (Promise.allSettled)
  │
  ├── cada camada devolve { ok, dados, evidencias[], confianca }
  │
  ├── score.ts agrega → Score 0-100 (cada camada vale 20 pontos)
  │
  └── OUTPUT { input, camadas[], score, classificacao, dossie_md }
```

## Saída-exemplo

```
DNA do Ativo
  Identificador: CNJ 0007378-77.1998.4.01.3600
  
  Camada 1 (Processo) ✅ Existe no Judiciário, classe 1265, TRF1
  Camada 2 (Tribunal) ✅ Precatório 1666808420254010000, fila posição 47
  Camada 3 (LOA)      ✅ Incluído na LOA 2026, R$ 26.400.020, UO 49201 INCRA
  Camada 4 (Execução) ⚠️ Empenhado parcial em 03/2026, sem pagamento ainda
  Camada 5 (Evidência) ✅ 12 publicações no e-DJF, última: "expedição confirmada"
  
  Score: 88/100 (ALTA confiabilidade)
  Status: PRECATÓRIO VÁLIDO, PENDENTE DE PAGAMENTO 2026
```

## Estrutura

```
aura_dna/
├── README.md                          (este arquivo)
├── types.ts                           (interfaces DNAInput, DNAOutput, CamadaResult)
├── orchestrator.ts                    (chama 5 camadas em paralelo)
├── score.ts                           (calcula 0-100)
├── routes.ts                          (endpoint REST POST /aura-dna/lookup)
├── camadas/
│   ├── 01_processo_datajud.ts
│   ├── 02_tribunal_mapa_anual.ts
│   ├── 03_loa_siop.ts
│   ├── 04_execucao_transparencia.ts
│   └── 05_evidencia_diario.ts
└── __tests__/
    └── caso_0811636_incra.test.ts    (caso real end-to-end)
```

## O que NÃO fazer

- Não alterar `server/services/estoque_datajud.ts`, `dd_pipeline.ts` etc — pode importar/copiar trechos
- Não mover ou renomear arquivos existentes
- Não escrever em CSVs/bases compartilhadas — saídas próprias em `Saida/aura_dna/`
- Não baixar listas massivas de credores — cliente entra com identificador

## Status

Esqueleto criado em 2026-04-27. Próximo passo: implementar Camada 3 (LOA SIOP) que é a mais barata e já temos os dados.
