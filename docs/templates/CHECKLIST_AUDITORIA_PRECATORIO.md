# Checklist de Auditoria — Precatório Federal AuraLOA

> Cada variável DEVE ser preenchida com dado REAL ou marcada como `[PENDENTE]`.
> NUNCA inventar. NUNCA deduzir. Fonte obrigatória para cada ✅.

---

## VARIÁVEIS DO PROCESSO

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `P01` | Nº Precatório (LOA) | PDF LOA (pdfplumber) | `[ ]` | |
| `P02` | CNJ Execução | TRF consulta CPF/CNPJ | `[ ]` | |
| `P03` | CNJ Processo Originário | TRF coluna "Processo Originário" | `[ ]` | |
| `P04` | Tribunal | LOA + TRF | `[ ]` | |
| `P05` | Tipo (PRC/RPV) | TRF prefixo | `[ ]` | |
| `P06` | Valor (R$) | LOA campo Valor_RS | `[ ]` | |
| `P07` | Natureza (Comum/Alimentar) | LOA campo Tipo_Causa | `[ ]` | |
| `P08` | Tipo de Causa | LOA + SIOP | `[ ]` | |
| `P09` | UF Origem | CNJ originário (seção) | `[ ]` | |
| `P10` | Match SIOP | pipeline001 + gerar_full | `[ ]` | |

## VARIÁVEIS DO DEVEDOR

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `D01` | Entidade Devedora | LOA campo UO_Devedora | `[ ]` | |
| `D02` | CNPJ Devedora | Portal Transparência (PJ) | `[ ]` | |
| `D03` | Órgão Superior (SIAFI) | Portal Transparência (SIAFI) | `[ ]` | |
| `D04` | Ação Orçamentária | Portal Transparência (func. prog.) | `[ ]` | |

## VARIÁVEIS DO CREDOR

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `C01` | Razão Social | Receita Federal (BrasilAPI) | `[ ]` | |
| `C02` | Nome Fantasia | Receita Federal (BrasilAPI) | `[ ]` | |
| `C03` | CNPJ | Portal Transparência (recursos-recebidos) + BrasilAPI | `[ ]` | |
| `C04` | Situação Cadastral | Receita Federal (BrasilAPI) | `[ ]` | |
| `C05` | Data Abertura | Receita Federal (BrasilAPI) | `[ ]` | |
| `C06` | CNAE Principal | Receita Federal (BrasilAPI) | `[ ]` | |
| `C07` | Endereço | Receita Federal (BrasilAPI) | `[ ]` | |
| `C08` | Telefone | Receita Federal (BrasilAPI) | `[ ]` | |
| `C09` | Capital Social | Receita Federal (BrasilAPI) | `[ ]` | |
| `C10` | Natureza Jurídica | Receita Federal (BrasilAPI) | `[ ]` | |
| `C11` | Sanções (CEIS/CNEP/CEPIM) | Portal Transparência (PJ) | `[ ]` | |

## VARIÁVEIS DO QUADRO SOCIETÁRIO

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `S01` | Nome Sócio 1 | Receita Federal (BrasilAPI QSA) | `[ ]` | |
| `S02` | CPF Sócio 1 | Receita Federal (mascarado) | `[ ]` | |
| `S03` | Qualificação Sócio 1 | Receita Federal (BrasilAPI QSA) | `[ ]` | |
| `S04` | Data Entrada Sócio 1 | Receita Federal (BrasilAPI QSA) | `[ ]` | |
| `S05-S08` | Sócios adicionais | Receita Federal (BrasilAPI QSA) | `[ ]` | |

## VARIÁVEIS DE CONTRATOS (com o devedor)

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `CT01` | Qtd contratos encontrados | Portal Transparência (contratos CPF/CNPJ) | `[ ]` | |
| `CT02` | Contrato principal (nº) | Portal Transparência | `[ ]` | |
| `CT03` | Objeto do contrato | Portal Transparência | `[ ]` | |
| `CT04` | Valor do contrato | Portal Transparência | `[ ]` | |
| `CT05` | Vigência | Portal Transparência | `[ ]` | |
| `CT06` | UG contratante | Portal Transparência | `[ ]` | |
| `CT07` | Gestor responsável DNIT | Portal Transparência | `[ ]` | |

## VARIÁVEIS DE REPRESENTAÇÃO LEGAL

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `A01` | Nome Advogado Principal | TRF processo originário | `[ ]` | |
| `A02` | OAB | TRF processo originário | `[ ]` | |
| `A03` | CPF Advogado | TRF processo originário | `[ ]` | |

## VARIÁVEIS DE PAGAMENTO

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `PG01` | Status pagamento | PJe movimentação / Portal Transparência / CJF | `[ ]` | |
| `PG02` | Data depósito | PJe código 12217 | `[ ]` | |
| `PG03` | Cronograma CJF | CJF comunicado anual | `[ ]` | |

## VARIÁVEIS DE RISCO

| Var | Campo | Fonte | Status | Valor |
|---|---|---|---|---|
| `R01` | Gravames | CENPROT / Cartório | `[ ]` | |
| `R02` | Cessão disponível | Análise jurídica | `[ ]` | |
| `R03` | Processos incidentais | TRF consulta processual | `[ ]` | |

---

## SCORE DE COMPLETUDE

```
Total variáveis: 40
Preenchidas: ___
Pendentes: ___
Score: ___% (preenchidas / total × 100)

Classificação:
  90-100% = COMPLETO — relatório pronto para entrega
  70-89%  = AVANÇADO — faltam dados secundários
  50-69%  = PARCIAL — faltam dados importantes
  < 50%   = INCOMPLETO — NÃO entregar ao cliente
```

## EXEMPLO — CASE DNIT (14/04/2026)

```
Preenchidas: 30 de 40 (75%) = AVANÇADO
Pendentes: A01-A03 (advogado), PG01-PG03 (pagamento), R01-R03 (risco), CT07 (gestor)
Fontes: LOA + TRF1 + SIOP + Portal Transparência + BrasilAPI
Tempo: ~2 horas (incluindo descoberta do método)
```

## PIPELINE DE PREENCHIMENTO (ordem de execução)

```
FASE 1 — LOA (P01, P06, P07, P08, D01)
  Script: extrair_loa_completo.py → precatorios_extraidos.csv
  
FASE 2 — TRF1 CNPJ (P02, P03, P04, P05, P09, D02, D03)
  Script: enriquecer_precatorio_cnpj.cjs
  
FASE 3 — SIOP (P10, D04)
  Script: pipeline001.py + gerar_full.py
  
FASE 4 — Portal Transparência: Credor (C03)
  MCP: portal_recursos_recebidos_recursosrecebidos
  Params: orgaoSuperior + uf + nomeFavorecido
  
FASE 5 — BrasilAPI: Receita Federal (C01-C10, S01-S04)
  URL: https://brasilapi.com.br/api/cnpj/v1/{CNPJ}
  GRATUITO
  
FASE 6 — Portal Transparência: Sanções + Contratos (C11, CT01-CT07)
  MCP: portal_pessoa_juridica_pj (sanções)
  MCP: portal_cpf_cnpj_contratoporcpfcnpj (contratos)
  
FASE 7 — TRF1 Processo Originário: Advogado (A01-A03)
  Script: consulta seção judiciária correta
  
FASE 8 — Pagamento + Risco (PG01-PG03, R01-R03)
  Caminho A: PJe movimentação
  Caminho B: Cronograma CJF
  Caminho C: Portal Transparência OB
```
