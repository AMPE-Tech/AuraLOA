# Pipeline Due Diligence AuraLOA — Estrutura Completa

**Versão:** 1.0 | **Data:** 13/04/2026 | **Status:** Parcialmente operacional

---

## VISÃO GERAL DO FLUXO

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENTRADA: Nº PRECATÓRIO                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 1 — LOA (dados orçamentários)                          ✅ ATIVO │
│ Fonte: precatorios_extraidos.csv (42.174 registros, 6.4 MB)        │
│ Campos: Nº Precatório, UO Cadastradora, UO Devedora, Ano,          │
│         Tipo Causa, Valor                                           │
│ Status: VALIDADO — parsing pdfplumber confirmado                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 2 — SIOP (cruzamento orçamentário)                     ✅ ATIVO │
│ Fonte: 22 CSVs SIOP/MPO (2.039.610 registros, 874 MB)              │
│ Cruzamento: UO + Tipo Causa + Valor → Chave SIOP                   │
│ Campos adicionados: Chave SIOP, Data Ajuizamento, Data Autuação,   │
│   Tipo Despesa, Valor Original, Valor Atualizado, Faixa, Class.     │
│ Taxa match: 94,7% (1.505 de 1.590 registros ≥R$1M)                │
│ Status: VALIDADO — LOA_FULL_CONCILIADO.csv (32 colunas, 737 KB)    │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 3 — TRF (enriquecimento CNJ)                           ✅ ATIVO │
│ Caminho: UO Devedora → Mapa CNJ (CNPJ) → TRF1 busca CPF/CNPJ     │
│ Resultado: CNJ Processo Execução + CNJ Processo Originário          │
│ Testado: INCRA (407 processos), SUFRAMA, DNIT, UFBA, FIOCRUZ       │
│ Cobertura: 33 PRCs com CNJ confirmado (23 entidades específicas)    │
│ Limitação: 169 "EFU - Sentenças Judiciais" (CNPJ genérico)         │
│ Status: VALIDADO — caminho LOA→CNPJ→TRF1→CNJ funcional             │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 4 — ROBÔ PJe (verificação processual)            ✅ TRF1 ATIVO │
│ Motor: Playwright (headless browser)                                │
│ Estrutura: server/scripts/robo_pje/                                 │
│   ├── index.cjs — orquestrador (CLI + módulo)                       │
│   ├── parser.cjs — identifica códigos pagamento/gravame/ofício      │
│   └── drivers/trf1.cjs — TRF1 funcional (testado 66 movimentações) │
│                                                                      │
│ O que extrai:                                                        │
│   ├── Movimentações processuais (todas, desde 2007)                 │
│   ├── Status pagamento (código 12217 = depósito efetuado)           │
│   ├── Ofício requisitório (código 60 = expedição documento)         │
│   ├── Gravames/impedimentos (penhora, bloqueio, indisponibilidade)  │
│   └── Partes do processo (autor, réu, advogados)                    │
│                                                                      │
│ Drivers pendentes: TRF2, TRF3, TRF4, TRF5, TRF6, STF, STJ         │
│ Status: TRF1 FUNCIONAL — processual.trf1.jus.br (Enter contorna    │
│         reCAPTCHA). PJe 1g instável (too many connections).          │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 5 — CONFIRMAÇÃO DE PAGAMENTO (tripla verificação)              │
│                                                                      │
│ Caminho A (primário) — Movimentação PJe               ✅ FUNCIONAL   │
│   Input: CNJ originário → processual.trf1.jus.br                   │
│   Busca: código 12217 (depósito), 60 (ofício), termos pagamento    │
│   Se encontrar → PAGO                                               │
│                                                                      │
│ Caminho B (reconfirmação) — Cronograma CJF            ✅ DOCUMENTADO │
│   Input: CNJ ou Nº Precatório                                      │
│   Fonte: cjf.jus.br comunicados anuais de desembolso               │
│   Se na lista → LIBERADO CJF                                       │
│                                                                      │
│ Caminho C (validação) — Portal Transparência          ✅ API ATIVA   │
│   Input: CNPJ credor ou UG pagadora                                │
│   Fonte: API Portal Transparência (106 endpoints, chave ativa)      │
│   Busca: Ordem Bancária (fase=3)                                    │
│   Se encontrar OB → PAGAMENTO EFETIVADO PELO TESOURO               │
│                                                                      │
│ Status: Fluxo 1-2-3 documentado e testado parcialmente              │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 6 — AGREGADOR DE VERIFICAÇÃO (dados credor/advogado)           │
│                                                                      │
│ CNPJ → BrasilAPI                                      ✅ FUNCIONAL   │
│   brasilapi.com.br/api/cnpj/v1/{cnpj}                              │
│   Retorna: razão social, situação, QSA (sócios), endereço          │
│   Testado: INCRA verificado (ATIVA, Brasília/DF)                    │
│                                                                      │
│ OAB → API WCF CNA                                    ⏳ PENDENTE KEY │
│   www5.oab.org.br/Integracao/CNA.svc                               │
│   11 operações (ConsultaAdvogado, AdvogadoRegular, PorCpf, etc.)   │
│   Email enviado para sistemas@oab.org.br (13/04/2026)              │
│                                                                      │
│ Cada dado recebe badge: "✅ Verificado" ou "⚠️ Não verificado"      │
│                                                                      │
│ Status: CNPJ funcional, OAB aguardando token                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FASE 7 — RELATÓRIO DD (geração do documento)            ✅ FUNCIONAL │
│                                                                      │
│ Modelo: Profissional (fusão Adimix + V3)                            │
│ Formato: HTML standalone, dark theme, 4 abas                        │
│   ├── Resumo (hero, KPIs, classificação, alerta)                    │
│   ├── Dados do Processo (12 campos, assuntos, status grid)          │
│   ├── Credor & Advogados (nome, CNPJ, CPF, tel, email, sócios, OAB)│
│   └── Evidência (SHA-256, timestamp, Lei 13.964, disclaimer)       │
│                                                                      │
│ Topbar: logo AuraLOA + CNJ + badges                                │
│ Footer: copyright + email + Lei 13.964                              │
│ Watermark: CONFIDENCIAL                                              │
│ Print CSS: incluso                                                   │
│                                                                      │
│ Status: FUNCIONAL via mockup no dashboard v3                        │
│ Pendente: integrar com backend real (dd_pipeline.ts — 1021 linhas)  │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ SAÍDA: RELATÓRIO DD COMPLETO                                        │
│                                                                      │
│ Dados do precatório + CNJ + status pagamento + gravames             │
│ + credor (CNPJ verificado) + sócios + advogados (OAB pendente)     │
│ + cadeia de custódia digital (SHA-256 + timestamp + Lei 13.964)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## COMPONENTES — ARQUIVOS E STATUS

### Dados (CSVs)

| Arquivo | Localização | Registros | Status |
|---|---|---|---|
| LOA 2026 parseada | `ArquivosLOA/LOA_2026/precatorios_extraidos.csv` | 42.174 | ✅ |
| SIOP histórico (22 CSVs) | `C:/Temp/auraloa-saida/siop_historico/` | 2.039.610 | ✅ |
| FULL conciliado | `C:/Temp/auraloa-saida/conciliacao/LOA_FULL_CONCILIADO.csv` | 1.590 | ✅ |
| Precatórios ≥R$10M | `C:/Temp/auraloa-saida/precatorios_acima_10M.csv` | 192 | ✅ |
| Precatórios ≥R$1M | `C:/Temp/auraloa-saida/precatorios_acima_1M.csv` | ~1.590 | ✅ |
| Pagamentos Portal | `C:/Temp/auraloa-saida/portal_transparencia_historico_pagamentos.csv` | 13 anos | ✅ |
| Ações judiciais Portal | `C:/Temp/auraloa-saida/portal_transparencia_acoes_judiciais.csv` | 6 códigos | ✅ |

### Scripts e Robôs

| Script | Localização | Função | Status |
|---|---|---|---|
| Robô PJe (orquestrador) | `server/scripts/robo_pje/index.cjs` | CLI + módulo, detecta tribunal | ✅ |
| Robô PJe (parser) | `server/scripts/robo_pje/parser.cjs` | Identifica códigos pagamento | ✅ |
| Robô PJe (TRF1) | `server/scripts/robo_pje/drivers/trf1.cjs` | Consulta processual TRF1 | ✅ |
| Verificador CNPJ/OAB | `server/scripts/verificador_oab.cjs` | BrasilAPI + OAB SOAP | ✅/⏳ |
| Consulta OAB Python | `server/scripts/consulta_oab.py` | CNA Python (endpoint 404) | ❌ |
| Portal Transparência Py | `server/scripts/portal_transparencia_py/` | Biblioteca GitHub | ✅ |

### Backend (Express)

| Rota | Arquivo | Método | Status |
|---|---|---|---|
| `/api/duediligence/pipeline` | `server/routes/dd_pipeline.ts` | POST | ⚠️ 1 erro compilação |
| `/api/auth/login` | `server/routes/auth.ts` | POST | ✅ |
| `/api/dashboard/precatorios` | `server/routes/dashboard.ts` | GET | ✅ |
| `/due-diligence/:id` | `server/routes/due_diligence_viewer.ts` | GET | ✅ |

### Frontend

| Arquivo | Localização | Função | Status |
|---|---|---|---|
| Dashboard v3 | `client/public/dashboard-loa-v3.html` | Dashboard SaaS + DD mockup | ✅ Deploy |
| Dashboard v1 | `client/public/dashboard-loa.html` | Dashboard original | ✅ Preservado |

### MCPs configurados (.mcp.json)

| MCP | Pacote | Tools | Status |
|---|---|---|---|
| portal-transparencia | mcp-portal-transparencia-brasil | 106 endpoints | ✅ Chave ativa |
| dados-brasil | mcp-dadosbr | 23 tools (CNPJ, CEP, DataJud, BC) | ✅ Configurado |
| brasil-api | brasil-api-mcp-server | BrasilAPI completa | ✅ Configurado |

### Bibliotecas Python instaladas

| Biblioteca | Uso | Status |
|---|---|---|
| DadosAbertosBrasil | Dados abertos gov (IBGE, BACEN, Câmara) | ✅ |
| requests | API Portal Transparência (testado R$2,08B) | ✅ |
| beautifulsoup4 | Parsing HTML | ✅ |
| pdfplumber | Parsing PDF LOA | ✅ |

---

## O QUE FUNCIONA HOJE (end-to-end)

```
Nº Precatório (LOA)
  → busca no CSV (42.174) → encontra UO, Valor, Tipo         ✅
  → cruza com SIOP (94,7% match) → Chave SIOP, Datas         ✅
  → UO Devedora → Mapa CNJ → CNPJ                            ✅
  → CNPJ → TRF1 consulta por CPF/CNPJ → CNJ orig + exec      ✅
  → CNJ → Robô PJe → movimentações (66 extraídas)             ✅ TRF1
  → Movimentações → parser → status pagamento                  ✅
  → CNPJ credor → BrasilAPI → razão social, situação, QSA     ✅
  → Portal Transparência API → ação 0625/0022/218Y             ✅
  → Relatório DD → 4 abas + SHA-256 + Lei 13.964              ✅ mockup
```

## O QUE FALTA PARA PRODUÇÃO

| Item | Impacto | Complexidade |
|---|---|---|
| Corrigir compilação dd_pipeline.ts (1 erro crypto) | Alto | Baixo |
| Integrar robô PJe + verificador CNPJ no backend Express | Alto | Médio |
| Conectar dashboard v3 ao backend (substituir mockup) | Alto | Médio |
| Drivers TRF2-6, STF, STJ | Médio | Médio |
| Key OAB para verificação advogados | Médio | Aguardando |
| UGs SIAFI para Portal Transparência | Médio | Médio |
| Conciliar dados CJF (R$124,58B) | Baixo | Médio |

---

*Documento gerado em 13/04/2026 — Pipeline AuraLOA v3*
