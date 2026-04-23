# Manual de Pesquisa e Conciliação de Precatórios — AuraLOA

> **Versão:** 2.0 — 12/04/2026
> **Autor:** Marcos Costa + Claude Code
> **Status:** Pipeline validado — FULL de 32 colunas gerado
> **Aplica-se a:** Precatórios federais (TRF1–TRF6)

---

## 0. TRILHA COMPLETA — Como chegamos ao FULL (32 colunas, 1.590 registros)

Este manual documenta **passo a passo** como a equipe AuraTECH construiu a base de dados conciliada de precatórios da LOA 2026, desde o PDF bruto até o CSV FULL com 32 colunas de 3 fontes cruzadas.

### Diagrama da trilha

```
  FASE 1                    FASE 2                    FASE 3                   FASE 4
  EXTRAÇÃO LOA              ENRIQUECIMENTO TRF1       DADOS ABERTOS SIOP       CONCILIAÇÃO FULL
  ─────────────             ───────────────────       ──────────────────       ─────────────────
                                                      
  PDF LOA 2026              Mapa CNJ Dívida           Portal MPO/SOF           LOA + TRF1 + SIOP
  (5.887 páginas)           (Res. CNJ 303/2019)       (dados abertos)          = 32 colunas
       │                         │                         │                        │
       ▼                         ▼                         ▼                        ▼
  ┌──────────┐             ┌──────────┐              ┌──────────┐            ┌──────────────┐
  │pdfplumber│             │ CNPJ por │              │ CSV SIOP │            │  LOA_FULL_   │
  │ parser   │             │ entidade │              │ 164.012  │            │ CONCILIADO   │
  │          │             │ devedora │              │registros │            │  .csv        │
  └────┬─────┘             └────┬─────┘              └────┬─────┘            │              │
       │                        │                         │                  │ 1.590 reg    │
       ▼                        ▼                         │                  │ 32 campos    │
  ┌──────────┐             ┌──────────┐                   │                  │              │
  │ CSV LOA  │             │ TRF1     │                   │                  │ 8 LOA        │
  │ 42.174   │────────────▶│"CPF/CNPJ │                   │                  │ 9 TRF1       │
  │registros │  UO_Devedora│ da parte"│                   │                  │15 SIOP       │
  │ 8 campos │             │          │                   │                  └──────────────┘
  └────┬─────┘             └────┬─────┘                   │                        ▲
       │                        │                         │                        │
       │                        ▼                         │                        │
       │                   ┌──────────┐                   │                        │
       │                   │ 10.736   │                   │                        │
       │                   │processos │                   │                        │
       │                   │(1.857PRC)│                   │                        │
       │                   │CNJ+Orig  │                   │                        │
       │                   └────┬─────┘                   │                        │
       │                        │                         │                        │
       ▼                        ▼                         ▼                        │
  ┌─────────────────────────────────────────────────────────────────┐              │
  │                    pipeline001.py + gerar_full.py               │──────────────┘
  │  Cruzamento: LOA x TRF1 (prefix16) x SIOP (UO+valor+-10%)     │
  └─────────────────────────────────────────────────────────────────┘
```

### Fases detalhadas

#### FASE 1 — Extração do PDF da LOA (11/04/2026)

| Passo | O que fez | Script | Resultado |
|---|---|---|---|
| 1.1 | Parsear PDF LOA 2026 (5.887 páginas) com pdfplumber | `extrair_loa_completo.py` | `precatorios_extraidos.csv` — 42.174 registros |
| 1.2 | Filtrar >= R$10M | Python inline | `precatorios_acima_10M.csv` — 192 registros |
| 1.3 | Filtrar >= R$1M | Python inline | `precatorios_acima_1M.csv` — 1.590 registros |

**Campos obtidos (8):** UO_Cadastradora (código+nome), UO_Devedora (código+nome), Ano, Nº Precatório, Tipo_Causa, Valor_RS

**Descoberta crítica:** o "Nº Precatório" da LOA NÃO é um CNJ — é ID interno de registro do tribunal. Verificação empírica em 11/04/2026 (0 hits em PJe-TRF1 + API DataJud).

#### FASE 2 — Enriquecimento via TRF1 (11-12/04/2026)

| Passo | O que fez | Script | Resultado |
|---|---|---|---|
| 2.1 | Ler manual oficial TRF1 de precatórios (2006) | `baixar_manual_trf1.cjs` | Manual extraído via archive.org (317 KB) |
| 2.2 | Mapear 8 opções literais de pesquisa do TRF1 | `trf1_caminho_oficial.cjs` | ❌ NÃO existe campo "Nº Precatório" |
| 2.3 | Baixar Mapas CNJ Dívida Federal 2024-2025 | Manual (Marcos) | CNPJ das entidades devedoras obtido |
| 2.4 | **Descoberta do caminho:** busca por "CPF/CNPJ da parte" | `trf1_consulta_e_portaria.cjs` | INCRA retornou 407 processos! |
| 2.5 | Clicar no INCRA → tabela CNJ + Processo Originário | Marcos no browser | **Caminho validado!** |
| 2.6 | Automatizar extração para 9 entidades | `enriquecer_precatorio_cnpj.cjs` | 10.736 processos (1.857 PRC + 8.879 RPV) |
| 2.7 | Match LOA x PRC por prefix16 (padrão confirmado) | `pipeline001.py` | 33 PRC identificados com CNJ + Originário |

**Padrão confirmado:**
```
LOA (19 dig): SSSSSSSDDAAAAJTTOOOO  (sem zero, orig=0000)
PRC (20 dig): 0SSSSSSSDDAAAAJTT9198 (com zero, orig=9198)
Match: '0' + LOA[:15] == PRC_digits[:16]
```

**Campos obtidos (9):** conciliacao_status, conciliacao_tipo, cnj_processo_execucao, cnj_processo_originario, cnj_candidato, match_metodo, cnpj_entidade_devedora, causa_provavel, tribunal_cobertura

#### FASE 3 — Dados Abertos SIOP/MPO (12/04/2026)

| Passo | O que fez | Script | Resultado |
|---|---|---|---|
| 3.1 | Buscar fontes oficiais do governo federal | WebSearch | Achado: MPO lançou Painel de Sentenças Judiciais (30/03/2026) |
| 3.2 | Identificar página de dados abertos | WebFetch | URL: `gov.br/planejamento/.../dados-abertos` |
| 3.3 | Baixar CSV expedidos_2026.csv do SIOP | curl | 71 MB, 164.012 registros, 34 tribunais |
| 3.4 | Converter para formato Excel-friendly | `gerar_full.py` | CSV com `,`, decimais `.`, UTF-8 BOM |
| 3.5 | Dividir por tribunal | Python inline | 34 arquivos por tribunal + ACIMA_1M |

**Campos obtidos (15):** siop_chave, siop_tribunal, siop_data_ajuizamento, siop_data_autuacao, siop_tipo_despesa, siop_tributario, siop_natureza_despesa, siop_valor_original, siop_valor_atualizado, siop_fundef, siop_anos_decorridos, siop_class_tempo, siop_class_nfgc, siop_faixa_valor, siop_match_status

#### FASE 4 — Conciliação FULL (12/04/2026)

| Passo | O que fez | Script | Resultado |
|---|---|---|---|
| 4.1 | Cruzar LOA+TRF1 x SIOP por UO+valor (±10%) | `gerar_full.py` | 1.265 matches (79,6%) |
| 4.2 | Gerar CSV FULL 32 colunas | `gerar_full.py` | `LOA_FULL_CONCILIADO.csv` — 737 KB |

**Resultado FULL:**
```
Registros: 1.590
Campos: 32 (8 LOA + 9 TRF1 + 15 SIOP)
Match LOA x SIOP: 79,6% (1.265 de 1.590)
Match LOA x TRF1 (CNJ): 2,1% (33 de 1.590)
```

### Resumo dos scripts (ordem de execução)

| # | Script | Fase | Input | Output |
|---|---|---|---|---|
| 1 | `extrair_loa_completo.py` | F1 | PDF LOA | CSV 42.174 reg |
| 2 | `enriquecer_precatorio_cnpj.cjs` | F2 | CNPJ entidade | CSV processos TRF1 |
| 3 | `pipeline001.py` | F2 | CSVs LOA + TRF1 | 4 CSVs conciliação |
| 4 | `gerar_full.py` | F4 | Conciliação + SIOP | **LOA_FULL_CONCILIADO.csv** |

### Fontes utilizadas (verificadas empiricamente)

| Fonte | URL | O que forneceu |
|---|---|---|
| PDF LOA 2026 | Congresso Nacional | Nº Precatório, UO, Valor, Tipo Causa |
| TRF1 Consulta Processual | `processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php` | CNJ + Processo Originário |
| Mapas CNJ Dívida Federal | Portal TRF1 (Res. CNJ 303/2019) | CNPJ entidades devedoras |
| SIOP Dados Abertos | `www1.siop.planejamento.gov.br/siopdoc/` | Chave SIOP, datas, valores, classificações |
| Manual TRF1 Precatórios | archive.org (original TRF1) | Conceitos: nº registro ≠ CNJ |
| Resolução CJF 822/2023 | `cjf.jus.br` | Regulamentação atual |

### Mapa de arquivos (onde tudo foi salvo)

#### Pasta principal: `C:/Temp/auraloa-saida/`

```
C:/Temp/auraloa-saida/
│
├── precatorios_acima_10M.csv          ← LOA filtro >= R$10M (192 reg)
├── precatorios_acima_1M.csv           ← LOA filtro >= R$1M (1.590 reg)
│
├── conciliacao/                       ← SAÍDA FINAL
│   ├── LOA_FULL_CONCILIADO.csv        ★ FULL 32 colunas (737 KB) — ARQUIVO PRINCIPAL
│   ├── LOA_CONCILIACAO_COMPLETA.csv   ← Conciliação LOA x TRF1 (17 col)
│   ├── LOA_IDENTIFICADOS_PRC.csv      ← 33 PRC com CNJ confirmado
│   ├── LOA_IDENTIFICADOS_RPV.csv      ← RPV identificados
│   └── LOA_NAO_IDENTIFICADOS.csv      ← 1.557 com causa provável
│
├── enriquecimento/                    ← PROCESSOS TRF1 POR ENTIDADE
│   ├── INCRA_processos_trf1.csv       ← 406 processos (61 PRC)
│   ├── SUFRAMA_processos_trf1.csv     ← 2.397 processos (1.073 PRC)
│   ├── UFBA_processos_trf1.csv        ← 6.231 processos (400 PRC)
│   ├── UFPA_processos_trf1.csv        ← 1.246 processos (213 PRC)
│   ├── ANS_processos_trf1.csv         ← 358 processos (70 PRC)
│   ├── CHICO_MENDES_processos_trf1.csv ← 89 processos (38 PRC)
│   ├── FIOCRUZ_processos_trf1.csv     ← 4 processos (1 PRC)
│   ├── DNIT_processos_trf1.csv        ← 1 processo (1 PRC) ⚠️
│   ├── INSS_processos_trf1.csv        ← 4 processos (0 PRC) ⚠️
│   └── CRUZAMENTO_LOA_TRF1_v*.csv     ← Versões intermediárias do cruzamento
│
├── portal_transparencia/              ← DADOS ABERTOS SIOP/MPO
│   ├── SIOP_2026_COMPLETO.csv         ← 164.012 reg, 67.8 MB (todos tribunais)
│   ├── SIOP_2026_ACIMA_1M.csv         ← 3.671 reg, 1.7 MB (filtro >= R$1M)
│   ├── SIOP_2026_TRF1a..csv           ← 31.032 reg (só TRF1)
│   ├── SIOP_2026_TRF2a..csv           ← 13.400 reg
│   ├── SIOP_2026_TRF3a..csv           ← 39.330 reg
│   ├── SIOP_2026_TRF4a..csv           ← 37.676 reg
│   ├── SIOP_2026_TRF5a..csv           ← 11.042 reg
│   ├── SIOP_2026_TRF6ª.csv            ← 10.527 reg
│   ├── SIOP_2026_STJ.csv              ← 1.078 reg
│   ├── SIOP_2026_STF.csv              ← 32 reg
│   ├── SIOP_2026_CNJ.csv              ← 15.334 reg
│   ├── SIOP_2026_TRT*.csv             ← 25 arquivos TRTs
│   └── SIOP_2026_AMOSTRA_50.csv       ← Amostra para validação
│
└── manuais/                           ← DOCUMENTAÇÃO OFICIAL BAIXADA
    ├── ManualPRECATRIOeRPV.DOC        ← Manual TRF1 (2006, via archive.org)
    ├── ManualPRECATRIOeRPV.txt        ← Texto extraído (antiword)
    ├── Res822-2023_CJF.pdf            ← Resolução CJF 822/2023
    ├── PortariaPRESI8886381.pdf       ← Certidão Eletrônica Negativa
    └── mapas_cnj/                     ← Mapas da Dívida (Res. CNJ 303)
        ├── Mapa_CNJ_2025_Federais.htm
        └── Mapa_CNJ_2024_Federal.htm
```

#### Fonte LOA (OneDrive)
```
C:/Users/MarcosCosta/OneDrive - CTS Brasil/Área de Trabalho/ClaudeCode/
└── ArquivosLOA/LOA_2026/
    └── precatorios_extraidos.csv       ← Base completa 42.174 reg, 6.4 MB
```

#### Scripts (projeto AuraLOA)
```
c:/Users/MarcosCosta/OneDrive - CTS Brasil/Área de Trabalho/ClaudeCode/AuraLOA/
├── extrair_loa_completo.py             ← Fase 1: parser PDF LOA
├── enriquecer_precatorio_cnpj.cjs      ← Fase 2: extração TRF1 por CNPJ
├── buscar_por_nome_trf1.cjs            ← Fase 2: extração TRF1 por nome
├── verificar_cnj_candidato.cjs         ← Fase 2: verificação direta CNJ
├── verificar_sem_zeros.cjs             ← Fase 2: teste variantes
└── docs/templates/
    └── MANUAL_PESQUISA_PRECATORIO.md   ← Este manual
```

#### Pipelines (C:\Temp)
```
C:/Temp/
├── pipeline001.py                      ← Conciliação LOA x TRF1
├── gerar_full.py                       ← FULL LOA + TRF1 + SIOP
└── cruzamento_v3.py                    ← Cruzamento intermediário
```

---

### Gaps conhecidos (o que ainda falta)

| Gap | Impacto | Próximo passo |
|---|---|---|
| 126 precatórios sem CNJ no TRF1 | INCRA (109) + outros | PRC de 2025 não sincronizados — retestar ou e-PrecWeb |
| 836 EFU sem CNPJ específico | 52,6% da base ≥R$1M | Portal Transparência / Editais CJF / SisPreq CNJ |
| TRF2–TRF6 não testados | Cobertura parcial | Replicar caminho CNPJ em cada TRF |
| DNIT só 1 PRC (CNPJ filiais) | 18 precatórios | Buscar CNPJs superintendências regionais |
| INSS sem PRC (CNPJ incorreto) | 300 precatórios | Resolver CNPJ correto |
| Deploy no servidor | Dashboard | Após revisão de todos TRFs → Hetzner 178.104.66.47 |

---

## 1. Visão geral

Este manual documenta o caminho **validado empiricamente** para obter o **CNJ do processo originário** e o **CNJ do processo de execução** a partir do **Nº Precatório da LOA Federal**.

Esses dois campos são **MANDATÓRIOS** no schema AuraLOA. Sem eles, o pipeline de Due Diligence não prossegue.

## 2. Dados de entrada (LOA 2026)

| Campo | Fonte | Exemplo |
|---|---|---|
| `UO_Cadastradora` | PDF LOA | `12102 — TRF 1a. Região` |
| `UO_Devedora` | PDF LOA | `INCRA` |
| `Ano` | PDF LOA | `2026` |
| `Precatorio` (Nº registro TRF) | PDF LOA | `1344378720254010000` |
| `Tipo_Causa` | PDF LOA | `Desapropriação por Interesse Social` |
| `Valor_RS` | PDF LOA | `130.604.993` |

**⚠️ O campo "Precatorio" da LOA NÃO é um CNJ.** É um ID interno de registro do tribunal. Verificação empírica em 11/04/2026: 0 hits em PJe-TRF1, 0 hits em API DataJud.

## 3. Caminho validado (LOA → CNJ)

```
ETAPA 1: LOA CSV
  │ Identificar UO_Devedora_Nome (ex: "INCRA", "DNIT", "SUFRAMA")
  │ Se UO_Devedora = "EFU - Sentenças Judiciais" → ver Seção 7
  ▼
ETAPA 2: Mapa CNJ da Dívida Federal (Res. CNJ 303/2019)
  │ Fonte: https://www.trf1.jus.br/trf1/processual/rpv-e-precatorios
  │ Arquivo: "Mapa anual CNJ 2025 - situação dívida 2025 - Federais.htm"
  │ Cruzar: Nome Entidade LOA → Nome Entidade Mapa → CNPJ
  │ Ex: INCRA → 00375972000160
  ▼
ETAPA 3: TRF1 — Consulta Processual por CPF/CNPJ da parte
  │ URL: https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1
  │ Input: CNPJ no campo `cpf_cnpj` (maxlen=18)
  │ Resultado: "Partes encontradas" com link para lista de processos
  ▼
ETAPA 4: Clicar no nome da entidade
  │ Resultado: Tabela com duas colunas:
  │   • Número do Processo (prefixo RPV ou PRC)
  │   • Processo Originário (CNJ da ação que gerou)
  │ Filtrar: apenas linhas com prefixo (PRC) = precatórios
  ▼
ETAPA 5: Cruzar com LOA
  │ Critérios de match: valor, ano, tipo causa
  │ Resultado: CNJ do precatório + CNJ do processo originário
  │ Status: CAMPOS MANDATÓRIOS PREENCHIDOS ✅
```

## 4. Consulta Processual TRF1 — 8 opções literais

URL base: `https://processual.trf1.jus.br/consultaProcessual/`

| # | Opção | URL específica | Útil para |
|---|---|---|---|
| 1 | Número do Processo | `numeroProcesso.php?secao=TRF1` | Buscar por CNJ conhecido |
| 2 | Nome da Parte | `nomeParte.php?secao=TRF1` | Buscar credor por nome |
| 3 | **CPF/CNPJ da parte** | **`cpfCnpjParte.php?secao=TRF1`** | **✅ CAMINHO PRINCIPAL** |
| 4 | Nome do Advogado | `nomeAdvogado.php?secao=TRF1` | Buscar por advogado |
| 5 | Código OAB do Advogado | `oabAdvogado.php?secao=TRF1` | Buscar por OAB |
| 6 | Número do Processo Originário | `processoOrigem.php?secao=TRF1` | Buscar por CNJ originário |
| 7 | Número do Processo de Execução | `processoExecucao.php?secao=TRF1` | Buscar por CNJ execução |
| 8 | Protocolo SEDEX | `protocoloSedex.php?secao=TRF1` | Buscar por SEDEX |

**❌ NÃO existe** opção "Número do Precatório". Confirmado em 11/04/2026.

## 5. CNPJs das entidades devedoras (Mapa CNJ 2025)

| Entidade LOA | CNPJ | Processos TRF1 |
|---|---|---|
| INCRA | `00375972000160` | 406 (61 PRC) ✅ testado |
| DNIT | `04892707000100` | a extrair |
| SUFRAMA | `04407029000143` | a extrair |
| UFBA | `15180714000104` | a extrair |
| ANS | `03589068000146` | a extrair |
| FIOCRUZ | `33781055000135` | a confirmar CNPJ |
| UFPA | `34621748000123` | a extrair |
| INSS | `29979036000140` | a extrair |
| Instituto Chico Mendes | `08829974000194` | a extrair |
| EGPA | a mapear | a mapear |
| Fundo Regime Geral Prev. Social | `16727230000197` | a extrair |
| Fundo Nacional Saúde | `00530493000171` | a extrair |
| Fundo Nacional Assist. Social | `01002940000182` | a extrair |
| IBAMA | `03659166000102` | a extrair |
| UnB | `00038174000143` | a extrair |

## 6. Script de automação

**Arquivo:** `enriquecer_precatorio_cnpj.cjs`

```
Uso: node enriquecer_precatorio_cnpj.cjs --cnpj=00375972000160 --nome=INCRA

Saída: C:/Temp/auraloa-saida/enriquecimento/{NOME}_processos_trf1.csv
Campos: numero_processo ; processo_originario ; pagina
```

O script:
1. Abre `cpfCnpjParte.php` com o CNPJ
2. Clica no nome da entidade encontrada
3. Extrai todas as linhas da tabela (com paginação)
4. Salva CSV com `numero_processo` e `processo_originario`
5. Tira screenshot para auditoria

## 7. Entidades "EFU — Sentenças Judiciais" (169 de 192 ≥ R$10M)

**Status: caminho público direto NÃO encontrado.**

"EFU - Sentenças Judiciais" (UO 71103) é a Unidade Orçamentária genérica da União para pagamento de sentenças judiciais. Não tem CNPJ específico no Mapa CNJ — aparece como tipo "D" (Direta) sem CNPJ.

**Caminhos em investigação:**
- Portal da Transparência (portaltransparencia.gov.br) — pode ter detalhamento por precatório
- Editais CJF de inclusão na LOA — publicados no DOU com CNJ + credor
- Resolução CJF 822/2023 — ler para ver formato de disponibilização
- Anexos XLSX da LOA no site do Congresso
- TCU — auditorias de precatórios com planilhas detalhadas

## 8. Formato dos números CNJ

Resolução CNJ 65/2008: `NNNNNNN-DD.AAAA.J.TR.OOOO` (20 dígitos)

| Componente | Dígitos | Significado |
|---|---|---|
| NNNNNNN | 7 | Número sequencial |
| DD | 2 | Dígito verificador |
| AAAA | 4 | Ano de ajuizamento |
| J | 1 | Segmento (4 = Justiça Federal) |
| TR | 2 | Tribunal (01 = TRF1) |
| OOOO | 4 | Origem (Seção/Subseção) |

Formatos antigos também aceitos:
- 1997-2009: `AAAA.RE.OR.NNNNN-D` (15 dígitos)
- Anterior a 1997: `AA.TR.NNNNN-D` (10 dígitos)

## 9. Prefixos dos processos TRF1

| Prefixo | Significado | Relevância |
|---|---|---|
| **(PRC)** | **Precatório** | **✅ Principal** — valores ≥ R$10M |
| (RPV) | Requisição de Pequeno Valor | Valores menores (≤ 60 salários mínimos) |

## 10. Regras MANTRA aplicáveis

```
NUNCA tratar o Nº Precatório da LOA como CNJ.
NUNCA tratar máscara de input como evidência de CNJ.
SEMPRE mostrar dado bruto antes de afirmar.
SEMPRE citar fonte verificável.
SEMPRE marcar [NÃO VERIFICADO] o que não foi confirmado.
```

## 11. Histórico de verificações empíricas

| Data | Teste | Resultado |
|---|---|---|
| 11/04/2026 | Nº Precatório no PJe-TRF1 | ❌ "Processo não foi encontrado" |
| 11/04/2026 | Nº Precatório na API DataJud TRF1 | ❌ 0 hits |
| 11/04/2026 | Nº Precatório no processual.trf1 | ❌ Máscara cosmética, sem resultado |
| 12/04/2026 | CNPJ INCRA no processual.trf1 | ✅ 407 processos encontrados |
| 12/04/2026 | Tabela com CNJ + Processo Originário | ✅ 61 PRC + 345 RPV |
| 12/04/2026 | Extração 9 entidades TRF1 por CNPJ | ✅ 10.736 processos (1.857 PRC + 8.879 RPV) |
| 12/04/2026 | Pipeline001 conciliação LOA x TRF1 | ✅ 33 PRC identificados (R$ 0,26 bi) |
| 12/04/2026 | Verificação CNJ candidatos (126 pendentes) | ❌ 0 encontrados no TRF1 público |
| 12/04/2026 | Teste variantes sem zeros (6 combinações) | ❌ 0 encontrados |

## 12. Pipeline de Conciliação (Pipeline001)

### Execução
```bash
python C:/Temp/pipeline001.py
```

### Saída
```
C:/Temp/auraloa-saida/conciliacao/
  LOA_CONCILIACAO_COMPLETA.csv    — todos (1.590 registros)
  LOA_IDENTIFICADOS_PRC.csv       — PRC com CNJ (33 registros)
  LOA_IDENTIFICADOS_RPV.csv       — RPV com CNJ (0 registros)
  LOA_NAO_IDENTIFICADOS.csv       — com causa provável (1.557 registros)
```

### Colunas de conciliação
| Coluna | Valores |
|---|---|
| `conciliacao_status` | IDENTIFICADO_PRC / IDENTIFICADO_RPV / NAO_IDENTIFICADO |
| `conciliacao_tipo` | PRC / RPV / PENDENTE |
| `cnj_processo_execucao` | CNJ do precatório TRF1 |
| `cnj_processo_originario` | CNJ da ação original |
| `cnj_candidato` | CNJ gerado pelo algoritmo (para verificação futura) |
| `causa_provavel` | Motivo da não-identificação |

### Resultado (12/04/2026)
```
Identificados PRC:     33 (2,1%) — R$ 0,26 bi
Não identificados:  1.557 (97,9%) — R$ 20,38 bi
  - EFU sem CNPJ:        836
  - Entidade não mapeada: 295
  - Sem PRC extraído:     276
  - Formato tribunal 00:   70
  - PRC não sincronizado:  80
```

## 13. Scripts do Pipeline (referência)

| Script | Função | Uso |
|---|---|---|
| `extrair_loa_completo.py` | Extrai LOA do PDF | `python extrair_loa_completo.py` |
| `enriquecer_precatorio_cnpj.cjs` | Extrai processos TRF1 por CNPJ | `node enriquecer_precatorio_cnpj.cjs --cnpj=CNPJ --nome=LABEL` |
| `buscar_por_nome_trf1.cjs` | Busca TRF1 por nome da parte | `node buscar_por_nome_trf1.cjs --nome=NOME --label=LABEL` |
| `verificar_cnj_candidato.cjs` | Verifica CNJ direto no TRF1 | `node verificar_cnj_candidato.cjs` |
| `verificar_sem_zeros.cjs` | Testa variantes sem zeros | `node verificar_sem_zeros.cjs` |
| `pipeline001.py` | Conciliação final LOA x TRF1 | `python C:/Temp/pipeline001.py` |

## 14. Fontes obrigatórias de pesquisa (aprovadas por Marcos 12/04/2026)

Para **TODOS os lotes de precatórios**, sempre consultar estas fontes:

| # | Fonte | URL | O que buscar | Status |
|---|---|---|---|---|
| 1 | **TRF1 Consulta Processual** | `processual.trf1.jus.br/consultaProcessual/` | CPF/CNPJ da parte → CNJ + Processo Originário | ✅ Validado |
| 2 | **Portal da Transparência** | `portaltransparencia.gov.br` | Dados de pagamento com CNJ vinculado | ⬜ PENDENTE |
| 3 | **Editais CJF no DOU** | Diário Oficial da União | Relação de precatórios incluídos na LOA (CNJ + credor) | ⬜ PENDENTE |
| 4 | **e-PrecWeb** | A verificar se tem acesso público | Sistema interno de precatórios dos TRFs | ⬜ PENDENTE |
| 5 | **Mapas CNJ da Dívida** | Portal de cada TRF | CNPJ entidade devedora + montantes | ✅ Validado |
| 6 | **API DataJud/CNJ** | `api-publica.datajud.cnj.jus.br` | Verificação de CNJ | ✅ Testado (limitado) |
| 7 | **Resolução CJF 822/2023** | `cjf.jus.br` | Regulamentação de precatórios federais | ⬜ Ler integralmente |
| 8 | **SIOP/MPO Dados Abertos** | `www1.siop.planejamento.gov.br` | CSVs anuais precatórios expedidos 2008-2027 (164K registros/2026). UO + Tipo Causa + Valor + Datas | ✅ Baixado e convertido |
| 9 | **SisPreq CNJ** | `cnj.jus.br` (PDPJ-Br) | Sistema Nacional de Precatórios lançado set/2025 | ⬜ Verificar acesso público |

### Dados SIOP baixados (12/04/2026)

```
C:/Temp/auraloa-saida/portal_transparencia/
  SIOP_2026_COMPLETO.csv     — 164.012 registros, 67.8 MB (todos tribunais)
  SIOP_2026_ACIMA_1M.csv     — 3.671 registros, 1.7 MB (>= R$1M)
  SIOP_2026_TRF1a..csv       — 31.032 registros (só TRF1)
  SIOP_2026_TRF2a..csv       — 13.400 registros
  SIOP_2026_TRF3a..csv       — 39.330 registros
  SIOP_2026_TRF4a..csv       — 37.676 registros
  SIOP_2026_TRF5a..csv       — 11.042 registros
  SIOP_2026_TRF6ª.csv        — 10.527 registros
  + 27 arquivos TRTs, STJ, STF, CNJ
```

Formato: CSV com `,`, decimais com `.`, UTF-8 BOM — abre direto no Excel.

URLs dos CSVs originais (SIOP):
  Base: `https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/dados_abertos:sentencas:`
  - `expedidos_2026.csv` (e 2008-2027 disponíveis)
  - `serie_execucao_orcamentaria_2008-2025.csv`
  - `indice_correcao_ipca.csv`

### Pendências prioritárias

#### Caminhos validados
1. ✅ **TRF1 via CNPJ da parte** — É onde os precatórios estão registrados. 33 matches confirmados. Caminho funcional.

#### Caminhos de enriquecimento a testar
2. ⬜ **CNPJ União Federal no TRF1** — CNPJ `00394411000109` para cobrir os 836 EFU
3. ⬜ **Seções Judiciárias (1º grau)** — É onde os processos originários tramitam. Consulta nas varas federais de origem.
4. ⬜ **Portal da Transparência** — Pagamentos federais de precatórios com CNJ vinculado
5. ⬜ **Editais CJF no DOU** — relação oficial LOA 2026 com CNJ + credor + Nº Precatório
6. ⬜ **SisPreq CNJ** — Sistema Nacional de Precatórios (lançado set/2025) — verificar acesso público. Provável fonte definitiva.
7. ⬜ **e-PrecWeb / SISPREC** — sistema interno de precatórios dos TRFs — verificar acesso público

#### Caminhos refutados (não funcionam)
- ❌ **TRF1 busca direta por número** — PRC com origem 9198 não são encontrados (nem os conhecidos que achamos via CNPJ)
- ❌ **DataJud API `api_publica_trf1`** — não indexa precatórios (são procedimentos administrativos, não processos judiciais); processos originários antigos (pré-2010) também não encontrados
- ❌ **DataJud API `api_publica_stj`** — processos de precatório TRF1 nunca subiram ao STJ (fonte errada)
- ❌ **STJ Consulta Processual web** — fonte errada para precatórios TRF1. Formatos de campo não foram respeitados (violação MANTRA 12/04/2026)
- ❌ **Nº Precatório LOA como CNJ** — máscara cosmética, não é CNJ válido

#### Lição aprendida (12/04/2026) — VIOLAÇÃO MANTRA
- Precatório = **procedimento administrativo**, NÃO processo judicial → DataJud não indexa
- Cada tribunal tem **formato próprio** de pesquisa → LER MANUAL ANTES de pesquisar
- Não pesquisar em fonte sem justificativa (ex: STJ para processo que nunca subiu)
- Consultar base de conhecimento própria ANTES de testar empiricamente

#### Expansão de cobertura
6. ⬜ **TRF2–TRF6** — testar caminho CNPJ em cada tribunal
7. ⬜ **DNIT filiais** — buscar CNPJs superintendências regionais (34 filiais)
8. ⬜ **INSS** — resolver CNPJ correto (Fundo RGPS vs INSS vs Gerências)

#### Deploy
9. ⬜ **DEPLOY SERVIDOR** — após revisar TODOS os tribunais (TRF1–TRF6), salvar dados consolidados no servidor Hetzner (178.104.66.47)

---

*Este manual é vivo — será atualizado conforme novos caminhos forem validados.*
*Fonte primária: investigação empírica de Marcos Costa e Claude Code, 11-12/04/2026.*
*Pipeline001 executado em 12/04/2026 — 33 PRC identificados, 1.557 pendentes com causa provável.*
