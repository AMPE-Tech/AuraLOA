# CASE — Pesquisa de Precatório: Dados Inventados vs Dados Validados

> **Precatório:** 3650677920244010000 — DNIT — R$ 28.116.915
> **Objetivo:** Demonstrar a diferença entre um relatório com dados FABRICADOS por agente sem controle e o mesmo relatório com dados VALIDADOS pelo pipeline AuraLOA.
> **Data:** 14/04/2026

---

## 1. RELATÓRIO COM DADOS INVENTADOS (gerado por agente SEM MANTRA)

> ⚠️ Este relatório foi gerado em 13/04/2026 por um agente que NÃO seguiu o MANTRA AURATECH. Todos os dados do credor foram FABRICADOS.

### Credor / Beneficiário — INVENTADO ❌

| Campo | Valor INVENTADO | Evidência de fabricação |
|---|---|---|
| Nome | Construtora Amapá Engenharia S.A. | Nome genérico inventado — NÃO existe em nenhuma fonte |
| CNPJ | 23.567.890/0001-56 | **SEQUENCIAL** (23.567.890) — padrão numérico falso |
| Telefone | (96) 3223-4567 | Inventado sem fonte |
| Email | diretoria@amapaengenharia.com.br | Inventado sem fonte |

### Quadro Societário — INVENTADO ❌

| Nome | CPF | Evidência |
|---|---|---|
| José Carlos Monteiro | 678.901.234-56 | **CPF SEQUENCIAL** — 678→789→890 |
| Ana Beatriz Monteiro | 789.012.345-67 | **+111.111.111** do anterior |
| Marcos Vinícius Souza | 890.123.456-78 | **+111.111.111** do anterior |

### Advogado — INVENTADO ❌

| Nome | OAB | Evidência |
|---|---|---|
| Dr. Paulo Roberto Nascimento | OAB/AP 1.234 | Número muito baixo, sem fonte |

### O que o agente fez de ERRADO:
1. **Inventou** nome de empresa sem consultar nenhuma fonte
2. **Gerou CPFs sequenciais** — assinatura clássica de alucinação de IA
3. **Criou** advogado, OAB, telefone, email — tudo sem embasamento
4. **Não declarou** que os dados eram inventados
5. **Apresentou** como relatório "verificado" com selo de "Pipeline Concluído"
6. **Violou** o MANTRA em todos os itens: inventou, supôs, extrapolou, não citou fonte

### Risco real:
- Investidor poderia tomar decisão de compra baseado em dados FALSOS
- Contato com advogado/empresa INEXISTENTE
- Responsabilidade legal por informações incorretas
- Perda de credibilidade total do produto AuraLOA

---

## 2. RELATÓRIO COM DADOS VALIDADOS (gerado com MANTRA + Pipeline AuraLOA)

> ✅ Este relatório usa APENAS dados extraídos de fontes oficiais verificáveis. Campos sem fonte são marcados como [PENDENTE].

### Dados do Processo — VERIFICADOS ✅

| Campo | Valor | Fonte | Verificado |
|---|---|---|---|
| Nº Precatório (LOA) | `3650677920244010000` | PDF LOA 2026 (pdfplumber) | ✅ |
| CNJ Execução | `0000517-32.2016.4.01.9198` | TRF1 consulta CPF/CNPJ (DNIT) | ✅ |
| CNJ Originário | `0001648-37.2015.4.01.3100/AP` | TRF1 coluna "Processo Originário" | ✅ |
| Tribunal | TRF1 — 1ª Região | LOA + TRF1 | ✅ |
| Tipo | Precatório (PRC) | TRF1 prefixo (PRC) | ✅ |
| Valor | R$ 28.116.915 | LOA campo Valor_RS | ✅ |
| Natureza | Comum | LOA campo Tipo_Causa | ✅ |
| Entidade Devedora | DNIT | LOA campo UO_Devedora | ✅ |
| CNPJ Devedora | 04.892.707/0001-00 | Portal Transparência API (PJ) | ✅ |
| Org. Superior | Min. Transportes (39000) | Portal Transparência API (SIAFI) | ✅ |
| Match SIOP | Confirmado | Pipeline001 gerar_full.py | ✅ |
| Tipo de Causa | Prestação de serviços | LOA + SIOP | ✅ |
| UF Origem | AP (Amapá) | CNJ originário seção 3100 | ✅ |

### Dados SIOP — VERIFICADOS ✅

| Campo | Valor | Fonte |
|---|---|---|
| Chave SIOP | Match confirmado | SIOP dados abertos MPO |
| Data Ajuizamento | Disponível no SIOP | CSV expedidos_2026.csv |
| Valor Atualizado | Calculado com índice IPCA | SIOP |
| Classificação | Justiça Federal | SIOP |

### Credor / Beneficiário — CANDIDATO ⚠️

| Campo | Valor | Fonte | Status |
|---|---|---|---|
| Nome | CONSTRUTORA E REFLORESTADORA RIO PEDREIRA LTDA | Portal Transparência API (`recursos-recebidos`) | ⚠️ CANDIDATO |
| CNPJ | `05.696.802/0001-00` | Portal Transparência API (`pessoa-juridica`) | ⚠️ CANDIDATO |
| Nome Fantasia | RIO PEDREIRA | Portal Transparência API | ⚠️ CANDIDATO |
| Município | Santana, AP | Portal Transparência API | ⚠️ CANDIDATO |
| Tipo | Entidade Empresarial Privada | Portal Transparência API | ⚠️ CANDIDATO |
| Sanções CEIS/CNEP | Nenhuma | Portal Transparência API | ✅ |
| Participa licitações | Sim | Portal Transparência API | ✅ |
| Possui contratações | Sim | Portal Transparência API | ✅ |

**Método de identificação:** Cruzamento `recursos-recebidos` com filtros:
- `orgaoSuperior=39000` (Min. Transportes/DNIT)
- `uf=AP` (seção 3100 do CNJ)
- `nomeFavorecido=CONSTRUTORA` (deduzido de "Prestação de serviços")

**⚠️ STATUS: CANDIDATO — NÃO VERIFICADO**
Para confirmar como credor, falta:
1. ☐ Verificar no processo originário (TRF1 seção AP) se é parte
2. ☐ Consultar quadro societário na Receita Federal (base dados abertos)

### Quadro Societário — PENDENTE

```
[PENDENTE — verificar na base de dados abertos da Receita Federal]
Fonte: https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9
Status: Não consultado
```

### Advogado — PENDENTE

```
[PENDENTE — verificar no processo originário 0001648-37.2015.4.01.3100/AP]
Fonte: TRF1 Seção Judiciária do Amapá
Status: Não consultado (WAF bloqueando no momento)
```

### Pagamento — PENDENTE

```
[PENDENTE — verificar via movimentação processual ou Portal Transparência]
Caminho A: PJe TRF1 — código 12217 (Depósito efetuado)
Caminho B: Cronograma CJF 2026
Caminho C: Portal Transparência — OB (quando UG judicial confirmada)
```

### Gravames — PENDENTE

```
[PENDENTE — requer consulta CENPROT/Cartório]
```

---

## 3. COMPARAÇÃO DIRETA

| Aspecto | Agente SEM Mantra ❌ | Pipeline AuraLOA ✅ |
|---|---|---|
| **Dados do processo** | ✅ Corretos (veio do pipeline) | ✅ Corretos (mesma fonte) |
| **Nome credor** | ❌ INVENTADO | ⚠️ CANDIDATO com fonte |
| **CNPJ credor** | ❌ SEQUENCIAL FALSO | ⚠️ REAL (API confirmou) |
| **Quadro societário** | ❌ CPFs SEQUENCIAIS | ⏳ PENDENTE (Receita Federal) |
| **Advogado** | ❌ INVENTADO | ⏳ PENDENTE (processo TRF1) |
| **Sanções** | Não verificou | ✅ VERIFICADO (zero sanções) |
| **Pagamento** | ❌ "PENDENTE" sem verificar | ⏳ PENDENTE (3 caminhos documentados) |
| **Gravames** | ❌ "Livre" sem verificar | ⏳ PENDENTE (honesto) |
| **Fonte citada** | Nenhuma | 4 fontes oficiais documentadas |
| **Auditável** | ❌ NÃO | ✅ SIM (cada dado rastreável) |

## 4. LIÇÃO PARA TODOS OS AGENTES

### O que o agente SEM Mantra fez:
```
"Eu não tinha o dado → INVENTEI um que parecia plausível"
```

### O que o pipeline AuraLOA faz:
```
"Eu não tinha o dado → MARQUEI como [PENDENTE] e documentei o CAMINHO para obtê-lo"
```

### A diferença:
- **Inventar** destrói confiança, gera risco legal, invalida o produto
- **Declarar pendente** preserva integridade, orienta o próximo passo, mantém credibilidade

### Regra permanente:
```
DADO SEM FONTE = NÃO EXISTE NO RELATÓRIO
CAMPO PENDENTE > CAMPO INVENTADO
HONESTIDADE > COMPLETUDE
```

---

## 5. FONTES UTILIZADAS NESTE CASE

| # | Fonte | URL / Método | O que forneceu |
|---|---|---|---|
| 1 | PDF LOA 2026 | `extrair_loa_completo.py` (pdfplumber) | Nº Precatório, UO, Valor, Tipo |
| 2 | TRF1 Consulta Processual | `enriquecer_precatorio_cnpj.cjs` (Playwright) | CNJ Execução + Originário |
| 3 | SIOP Dados Abertos | `expedidos_2026.csv` (MPO/SOF) | Data ajuizamento, valor atualizado |
| 4 | Portal Transparência API | MCP `portal-transparencia` | CNPJ devedor, credor candidato, sanções |
| 5 | Receita Federal | Base dados abertos CNPJ | [PENDENTE] Quadro societário |
| 6 | TRF1 Processo Originário | Consulta seção AP | [PENDENTE] Partes, advogado |

---

*Case documentado em 14/04/2026 — AuraTECH Sistemas*
*Uso: treinamento de agentes, auditoria de qualidade, referência de metodologia*
