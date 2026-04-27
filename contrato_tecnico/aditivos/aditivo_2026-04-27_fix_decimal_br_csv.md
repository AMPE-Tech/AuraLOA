# Aditivo Técnico — Fix de Locale Decimal no `_BR.csv`

**ID:** `aditivo_2026-04-27_fix_decimal_br_csv`
**Data:** 2026-04-27
**Tipo:** Fix temporário de governança de dados
**Autorizado por:** Marcos Costa (DPO/titular AuraTECH)
**Status:** Aplicado e validado
**Manifesto referência:** `manifesto_integridade_v3.json`
**Aditivo nº:** 2 de 2 da sessão (sequência: Aditivo 1 = saneamento manifesto v2; Aditivo 2 = este)

---

## 1. Diagnóstico do bug

### 1.1 Achado

O arquivo `precatorios_loa_2026_consolidado_BR.csv` emitido pelo pipeline de extração apresenta **incoerência de locale**:

- **Separador de campo:** `;` (correto para locale BR — Excel BR usa `;` porque `,` é decimal)
- **Separador decimal nos valores:** `.` (formato locale **INTL** — incorreto para um CSV nomeado `_BR`)

### 1.2 Evidência

Auditoria 2.A.1 confirmou em **79.156 / 79.156 linhas** (100% da base):

| Verificação | Resultado |
|---|---|
| Distribuição de formatos em `valor_brl` | 100% `com_ponto` (zero ocorrências de vírgula) |
| Casas decimais | 100% com 1 casa (`.0`) |
| Valores inválidos | 0 |
| Valores negativos | 0 |
| Valores zero | 1 (linha 79.156, registrada como achado pendente) |

Amostra literal da linha 2 do `_BR.csv`:
```
TRF2;12103;TRF - 2a. Região;71103;EFU - Sentenças Judiciais;...;569022567.0;TRF2.pdf;...
                                                              ^^^^^^^^^^^^^^^
                                                              decimal "." em arquivo nominalmente BR
```

### 1.3 Impacto operacional

**Excel BR** abre `_BR.csv` esperando locale BR completo (campo `;`, decimal `,`). Ao encontrar `569022567.0`, o Excel BR interpreta o `.` como **separador de milhar** (porque em locale BR o `.` é milhar e `,` é decimal). Resultado:

| Valor real (intenção) | Valor lido por Excel BR | Erro |
|---|---|---|
| `569022567.0` (R$ 569,02 mi) | **5.690.225.670** (R$ 5,69 bi) | **10× inflado** |

Idem para Power BI BR, LibreOffice Calc com locale BR, e qualquer pandas configurado com `decimal=','`. **Todo relatório AuraLOA derivado do `_BR.csv` produzia valores 10× errados quando aberto em ferramenta com locale BR padrão.**

Fere o princípio AuraTRUST de evidência verificável.

---

## 2. Auditoria pré-transformação (Passo 2.A.1)

Cinco verificações executadas, **todas em modo somente-leitura**:

| # | Verificação | `_BR.csv` | `_INTL.csv` |
|---|---|---|---|
| 1 | Distribuição formatos `valor_brl` | 79.156 `com_ponto` (100%) | 79.156 `com_ponto` (100%) |
| 2 | Casas decimais (qtd dígitos após `.`) | 100% `1 casa` (`.0`) | 100% `1 casa` (`.0`) |
| 3a | Valores inválidos / não-parseáveis | 0 | 0 |
| 3b | Valores `< 0` | 0 | 0 |
| 3c | Valores `== 0` | 1 (linha 79.156, TRF4) | 1 (mesma linha) |
| 4 | Cross-check BR ↔ INTL linha-a-linha | 0 divergências em 79.156 linhas | (idem) |
| 5 | Soma global vs manifesto v1 | R$ 22.306.037.833,00 = ✅ | R$ 22.306.037.833,00 = ✅ |

**Conclusão da auditoria:** base 100% homogênea, fix determinístico e seguro. `_INTL.csv` não precisa de fix (decimal `.` é coerente com locale INTL).

---

## 3. Decisão DPO

| Item | Escolha | Justificativa |
|---|---|---|
| Formato canônico de saída | **β** — `<dígitos>,00` (decimal vírgula, 2 casas, sem separador de milhar) | Padrão monetário BR (centavos), sem conflito de parsing, alinhamento SIAFI/SICONV, princípio AuraDATA: armazenar dado limpo, formatação visual é responsabilidade de relatório. |
| Escopo | apenas `_BR.csv` | `_INTL.csv` está coerente com seu locale; não tocar. |
| Aditivo separado para regra UO 10101 → 71103 | **não necessário** — anotação no Passo 2.E deste aditivo | Auditoria mostrou regra já aplicada em 32/32 linhas STF. Invariante, não transformação. |
| Aditivo separado para agregados (ranking, resumo) | **sim — Aditivo 3 (futuro)** | Atomicidade. Estado intermediário de dessincronia entre consolidado v2 e agregados v1 está documentado. |

---

## 4. Transformação aplicada (Passo 2.B)

| Atributo | Valor |
|---|---|
| Regra | `<dígitos>.0` → `<dígitos>,00` apenas em coluna `valor_brl` do `_BR.csv` |
| Arquivo origem | `precatorios_loa_2026_consolidado_BR.csv` |
| Arquivo destino | `precatorios_loa_2026_consolidado_BR_v2_decimal_corrigido.csv` |
| Local de gravação | `…\CONCILIADO\upload 27apr2026\` |
| Linhas processadas | **79.156 (100%)** |
| Colunas adicionadas ao final | 2: `valor_brl_original_formato_decimal`, `decimal_normalizado` |
| Colunas totais no destino | 25 (= 23 originais + 2 novas) |
| Encoding | UTF-8 com BOM (preservado do origem) |
| Line terminator | CRLF (preservado do origem; 79.157 CRLFs no destino, zero LF órfão) |
| Separador de campo | `;` (preservado) |
| Tempo de execução | 1,62 s (1ª) + 1,63 s (2ª — idempotência) |

Distribuição final de `decimal_normalizado`: **`true` em 79.156 / 79.156 linhas** (Cláusula 2.B.bis).

---

## 5. Validações executadas

### 5.1 Cláusula 2.F — Invariante de soma centavo-a-centavo

| Métrica | Valor |
|---|---|
| Soma origem (parser dot, decimal `.`) | R$ **22.306.037.833,00** |
| Soma destino (parser BR, decimal `,`) | R$ **22.306.037.833,00** |
| Diferença | **R$ 0,00 (zero centavos)** |
| **Status** | ✅ **OK** |

Bate centavo-a-centavo com o `valor_total_consolidado_brl` declarado em `manifesto_integridade.json` (v1).

### 5.2 Cláusula 2.G — Idempotência

Transformação executada **2 vezes** sobre o mesmo input, em arquivos de destino diferentes:

| Execução | SHA-256 do output | Tamanho |
|---|---|---|
| 1ª (oficial) | `991da5862690c87b375f5130473e2f743dc78ece2b60fa4803d452b3b79e34ce` | 41.234.765 B |
| 2ª (em `_TEMP_idempotencia_check.csv`) | `991da5862690c87b375f5130473e2f743dc78ece2b60fa4803d452b3b79e34ce` | 41.234.765 B |

**Resultado:** ✅ **OK** — SHAs idênticos. Arquivo temporário removido após validação (`unlink()`).

---

## 6. Cadeia de custódia (hashes oficiais)

| Arquivo | Local | SHA-256 |
|---|---|---|
| `_BR.csv` (origem, **intocado**) | `CONCILIADO/upload 27apr2026/` | `232d87951fe5136ad1fb7c1bf2d87cd54fca836865259966c95c903fef69bf4e` |
| `_BR_v2_decimal_corrigido.csv` (destino, NOVO) | `CONCILIADO/upload 27apr2026/` | `991da5862690c87b375f5130473e2f743dc78ece2b60fa4803d452b3b79e34ce` |
| `manifesto_integridade.json` (v1, **intocado**) | `CONCILIADO/upload 27apr2026/` | `f2983eccd0023094f01919e3e145c5f40de49a585ab43fbd9410f30a79cfcacf` |
| `manifesto_integridade_v2.json` (intocado) | `CONCILIADO/upload 27apr2026/` | `4f52f740caa9b4e3ea0411f9aa39bc09c04b95742c23e2a9baa99c6d7e419c9a` |
| `manifesto_integridade_v3.json` (NOVO) | `CONCILIADO # 3-sim/` | `0863c0fbc3b5a182030ff22f48eeff1e98672bc8dd711751512793f62c0be90e` |

Todos os hashes calculados via `hashlib.sha256()` sobre os bytes do arquivo, sem normalização de quebras de linha.

---

## 7. Achados pendentes (não bloqueantes)

### 7.1 Linha 79.156 — TRF4 com `valor_brl=0,00`

| Campo | Valor |
|---|---|
| Tribunal | TRF4 |
| Precatório (CNJ) | `5018956-53.2024.4.00.0000` |
| UO devedora | `36211 / FUNASA` (Fundação Nacional de Saúde) |
| Tipo causa | `Custas` |
| `valor_brl` original | `0.0` |
| `valor_brl` convertido | `0,00` |
| Bloqueante | ❌ Não |

**Hipóteses não-investigadas (aditivo separado recomendado):**
- Linha-totalizador residual deixada pelo extrator do PDF
- Precatório quitado/cancelado com valor zerado mas mantido na lista
- Bug específico de extração do `TRF4.pdf` (que produziu 37.676 registros — maior produção da base)

**Investigação adiada por decisão DPO.**

---

## 8. Anotação sobre regra UO 10101 → 71103 (Passo 2.E)

A regra **"quando UO Cadastradora = 10101 (STF), alterar UO Devedora para 71103 (União Federal)"** foi auditada em 2026-04-27 e está aplicada em **32 / 32 linhas STF de ambos os consolidados** (`_BR.csv` e `_INTL.csv`).

**Distribuição dos casos `uo_cadastradora_codigo = "10101"`:**

| Campo | Valor único | Linhas |
|---|---|---|
| `uo_devedora_codigo` | `71103` | 32 |
| `uo_devedora_nome` | `EFU - Sentenças Judiciais` | 32 |
| `uo_devedora_nome_normalizado` | `UNIÃO FEDERAL` | 32 |
| `tribunal_origem` | `STF` | 32 |
| `cnpj_uo_devedora` | `00.394.411/0001-09` (Tesouro Nacional) | 32 |

**Soma de `valor_brl` impactada:** R$ 672.806.355,00 (3,02% do consolidado total).

**Status formal:** **INVARIANTE_VERIFICADA** (registrado também em `manifesto_integridade_v3.json` no bloco `regra_uo_10101_71103`). **Nenhuma transformação necessária.** Registro mantido para rastreabilidade institucional.

---

## 9. Recomendação ao Producer do Pipeline (correção definitiva)

### 9.1 Bug raiz

O producer do pipeline de extração de PDFs emite `_BR.csv` com **locale-INTL** (decimal `.`) apesar do separador de campos ser **BR** (`;`). Resultado: arquivo híbrido inconsistente com seu próprio nome.

### 9.2 Fix definitivo recomendado

O producer deve detectar o **sufixo do nome do arquivo** e ajustar o locale de saída de forma coerente:

| Sufixo do arquivo | Separador campo | Separador decimal | Encoding |
|---|---|---|---|
| `*_BR.csv` | `;` | **`,`** | UTF-8 com BOM |
| `*_INTL.csv` | `,` | `.` | UTF-8 |

Implementação possível: ao serializar valores numéricos, usar:
- Locale BR: `format(valor, ',.2f').replace(',', 'X').replace('.', ',').replace('X', '.')` ou bibliotecas `babel` / `locale.format_string('%.2f', valor)` com locale `pt_BR`.
- Locale INTL: `f"{valor:.2f}"` direto.

### 9.3 Status atual

- **Fix aplicado:** local, no consumer (AuraLOA), gerando `_BR_v2_decimal_corrigido.csv`.
- **Caráter:** **TEMPORÁRIO**.
- **Validade deste aditivo:** **mantém-se VÁLIDO** até confirmação documentada de fix upstream no producer do pipeline.

---

## 10. Conformidade AuraTECH

| Princípio | Atendimento |
|---|---|
| ✅ Imutabilidade | Arquivos originais (`_BR.csv`, manifesto v1, v2) preservados byte-a-byte. Re-validação SHA antes/depois confirma 0 divergências. |
| ✅ Cadeia de custódia | SHA-256 calculados, registrados em manifesto v3 e neste aditivo. |
| ✅ Aprovação DPO | Autorização explícita registrada em chat 2026-04-27 ("Opção (a) autorizada"). Reproduzida no manifesto v3 e neste aditivo. |
| ✅ Não-mascaramento | Achado da linha 79.156 reportado explicitamente. Bug do producer reportado como recomendação upstream. Bug meu (parser BR errado na 1ª iteração da auditoria) reportado honestamente em chat. |
| ✅ Idempotência | Cláusula 2.G validada (SHA-256 idêntico em 2 execuções). |
| ✅ Determinismo | Encoding, line terminator, quoting, ordem de colunas e algoritmo de conversão fixos. Output reprodutível. |
| ✅ Timestamps UTC | Todos em ISO 8601 com sufixo `+00:00`. |
| ✅ Rastreabilidade | Manifesto v3 referencia v2 e v1 por hash. Aditivo referencia manifesto v3. Cadeia completa. |

---

## 11. Estado final dos diretórios

### `…\CONCILIADO\upload 27apr2026\` (9 arquivos)
- `log_extracao.txt` (intocado)
- `manifesto_integridade.json` v1 (intocado)
- `manifesto_integridade_v2.json` (do Aditivo 1, intocado)
- `precatorios_loa_2026.xlsx` (intocado)
- `precatorios_loa_2026_consolidado_BR.csv` (intocado)
- `precatorios_loa_2026_consolidado_BR_v2_decimal_corrigido.csv` (NOVO — Passo 2.B)
- `precatorios_loa_2026_consolidado_INTL.csv` (intocado)
- `ranking_devedores.csv` (intocado)
- `resumo_por_tribunal.csv` (intocado)

### `…\CONCILIADO # 3-sim\` (1 arquivo, diretório criado nesta sessão)
- `manifesto_integridade_v3.json` (NOVO)

### `AuraLOA\contrato_tecnico\aditivos\` (este aditivo + .sha256)
- `aditivo_2026-04-27_fix_decimal_br_csv.md` (este arquivo)
- `aditivo_2026-04-27_fix_decimal_br_csv.md.sha256` (selo adjacente)

---

**FIM DO ADITIVO 2 — sessão DPO 2026-04-27 encerrada.**
