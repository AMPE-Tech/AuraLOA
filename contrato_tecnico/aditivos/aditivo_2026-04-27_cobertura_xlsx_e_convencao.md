# Aditivo Técnico — Cobertura xlsx + Convenção de Diretórios

**ID:** `aditivo_2026-04-27_cobertura_xlsx_e_convencao`
**Data:** 2026-04-27
**Tipo:** Patch de governança de cobertura
**Autorizado por:** Marcos Costa (DPO/titular AuraTECH)
**Status:** Aplicado e validado
**Manifesto referência:** `manifesto_integridade_v3.1.json`
**Aditivo nº:** 3 da sessão DPO 2026-04-27 (sequência: 1 = saneamento, 2 = fix decimal _BR.csv, 3 = este patch de cobertura)

---

## 1. Origem do aditivo

Achados do **teste de cadeia de custódia AuraTRUST** executado ao final da sessão DPO 2026-04-27:

- **R1:** `precatorios_loa_2026.xlsx` presente em `…\CONCILIADO\upload 27apr2026\` mas **não declarado** em `arquivos_saida[]` do manifesto v3 (regressão de cobertura vs v2, que cobria o xlsx).
- **R2:** ausência de documentação formal sobre a separação dos diretórios `upload 27apr2026/` (artefatos do pipeline) e `CONCILIADO # 3-sim/` (manifesto v3+).
- **R3 (não tratada neste aditivo):** decisão arquitetural sobre consolidação dos diretórios — encaminhada para sessão dedicada.

---

## 2. Resolução R1 — Cobertura do `xlsx`

| Campo | Valor |
|---|---|
| Arquivo | `precatorios_loa_2026.xlsx` |
| Caminho | `…\CONCILIADO\upload 27apr2026\` |
| SHA-256 (calculado) | `5668df828f0ad3d53e30a52444ffc0fd3859041bcdec0b8706c7ad6cd04d1cfc` |
| Tamanho | 900.468 bytes |
| `mtime` | 2026-04-27 03:18 (timestamp do pipeline original — arquivo não foi tocado) |
| Origem | pipeline de extração LOA 2026 (fonte original Excel) |
| Inclusão | nova entrada em `arquivos_saida[]` do `manifesto_integridade_v3.1.json` |
| Ordem | adicionada **ao final** de `arquivos_saida[]` para preservar a ordem das 5 entradas pré-existentes (escolha conservadora) |

---

## 3. Resolução R2 — Bloco `convencao_diretorios`

Acrescentado bloco novo no manifesto v3.1 documentando o **propósito** e **conteúdo esperado** de cada diretório:

| Diretório | Propósito | Conteúdo declarado |
|---|---|---|
| `CONCILIADO/upload 27apr2026/` | Artefatos brutos e derivados do pipeline | 9 arquivos (manifestos v1, v2; log; xlsx; 3 CSVs consolidados; 2 agregados) |
| `CONCILIADO # 3-sim/` | Manifestos consolidados v3+ apontando para artefatos do diretório irmão | `manifesto_integridade_v3.json` e `manifesto_integridade_v3.1.json` |

O bloco também referencia explicitamente **R3 como pendência arquitetural** com:
- recomendação técnica inicial: `"Consolidar em diretorio unico para honrar principio de fonte unica (AuraDATA)"`
- status: `"pendente_revisao_arquitetural"`
- decisão DPO atual: `"adiada_para_sessao_dedicada"`

---

## 4. Encaminhamento R3 — Pendência registrada

**R3 não foi tratada neste aditivo.** Justificativa:

- Envolve decisão arquitetural com impacto em referências externas potenciais (consumers downstream que podem apontar para os caminhos atuais).
- Requer análise de risco sobre quebra de links em pipelines a jusante.
- Mover artefatos automaticamente sem mapear consumers violaria Cláusula 7 (fail-fast) do CONTRATO_TECNICO_MASTER.

**Recomendação:** sessão dedicada com cobertura de impacto completa antes de qualquer movimentação.

---

## 5. Cadeia de custódia (hashes oficiais)

| Arquivo | Local | SHA-256 |
|---|---|---|
| `manifesto_integridade.json` (v1, intocado) | `upload 27apr2026/` | `f2983eccd0023094f01919e3e145c5f40de49a585ab43fbd9410f30a79cfcacf` |
| `manifesto_integridade_v2.json` (intocado) | `upload 27apr2026/` | `4f52f740caa9b4e3ea0411f9aa39bc09c04b95742c23e2a9baa99c6d7e419c9a` |
| `manifesto_integridade_v3.json` (intocado) | `CONCILIADO # 3-sim/` | `0863c0fbc3b5a182030ff22f48eeff1e98672bc8dd711751512793f62c0be90e` |
| **`manifesto_integridade_v3.1.json` (NOVO)** | `CONCILIADO # 3-sim/` | **`86ce097c6756072de81972cae468c761050c1d188fb536f8cd891dd5191ffbdb`** |
| `precatorios_loa_2026.xlsx` (recém-coberto, intocado) | `upload 27apr2026/` | `5668df828f0ad3d53e30a52444ffc0fd3859041bcdec0b8706c7ad6cd04d1cfc` |

**Re-validação pós-operação confirmou:**
- `manifesto_integridade_v3.json` permanece com SHA `0863c0fb…62c0be90e` (intocado).
- `precatorios_loa_2026.xlsx` permanece com SHA `5668df82…04d1cfc` (intocado).

---

## 6. Não-execuções (Cláusula de transparência)

- ❌ Manifesto v3 **não foi sobrescrito** — preservado byte-a-byte.
- ❌ Nenhum arquivo de dados foi modificado (xlsx, CSVs, log, PDFs).
- ❌ R3 **não foi resolvida** — encaminhada para sessão dedicada.
- ❌ Linha 79.156 TRF4 zerada **não foi investigada** (escopo não autorizado).
- ❌ Agregados (`ranking_devedores.csv`, `resumo_por_tribunal.csv`) **não foram regenerados** (Aditivo 4 futuro).

---

## 7. Conformidade AuraTECH

| Princípio | Status | Evidência |
|---|---|---|
| ✅ Imutabilidade | Cumprido | v3 e xlsx mantêm SHA idêntico antes e depois da operação |
| ✅ Cadeia de custódia | Cumprido | Hash do xlsx agora declarado no manifesto v3.1 |
| ✅ Aprovação DPO | Cumprido | Autorização explícita registrada (chat 2026-04-27) |
| ✅ Não-mascaramento | Cumprido | R3 documentada como pendência explícita; ordem da nova entrada em `arquivos_saida[]` declarada |
| ✅ Timestamps UTC | Cumprido | ISO 8601 com sufixo `+00:00` em todos os campos |
| ✅ Determinismo | Cumprido | Cópia de v3 via `json.dumps/loads`, alterações pontuais e idempotentes |
| ✅ Fail-fast (Cláusula 7) | Cumprido | Script aborta se v3.1 já existir, ou se SHA de v3/xlsx divergir do esperado |

---

## 8. Achados ainda pendentes (acumulados da sessão)

1. **Linha 79.156 TRF4** com `valor_brl=0,00` — sem investigação. Possíveis causas: linha-totalizador residual, precatório quitado, bug de extração. Recomendação: aditivo separado.
2. **Regeneração de agregados** (`ranking_devedores.csv`, `resumo_por_tribunal.csv`) a partir do `_v2_decimal_corrigido.csv` — Aditivo 4 futuro.
3. **Fix definitivo upstream** do producer do pipeline (`_BR.csv` deve emitir decimal `,` nativamente) — encerra validade do Aditivo 2.
4. **R3 — Consolidação dos diretórios** — análise arquitetural em sessão dedicada (encaminhada por este aditivo).
5. **CLAUDE.md ausente no projeto root** (detectado no session-start desta sessão) — verificação anti-regressão fica comprometida sem ele.
6. **Campos `a_definir` no manifesto v2** (`origem_pipeline`, `fonte_derivada_de`, `mtime_timezone`) — mantidos como pendência declarada.

---

## 9. Recomendação para próxima sessão

Priorizar nesta ordem:

1. **Criar `CLAUDE.md` no projeto root** (anti-regressão crítica — bloqueia o `/session-start` de validar adequadamente).
2. **Resolver R3** — decisão arquitetural sobre consolidação dos diretórios.
3. **Investigar linha 79.156** zerada (TRF4 / FUNASA / Custas).
4. **Regenerar agregados** a partir do `_v2_decimal_corrigido.csv` (Aditivo 4).
5. **Documentar requisito de fix upstream** ao producer do pipeline (gera ticket externo).

---

## 10. Referências

- `aditivo_2026-04-27_extensao_manifesto_arquivos_saida.md` (Aditivo 1 — saneamento)
- `aditivo_2026-04-27_fix_decimal_br_csv.md` (Aditivo 2 — fix decimal)
- `manifesto_integridade.json` v1 (pipeline original)
- `manifesto_integridade_v2.json` (Aditivo 1)
- `manifesto_integridade_v3.json` (Aditivo 2)
- `manifesto_integridade_v3.1.json` (este aditivo — Aditivo 3)
- Teste AuraTRUST executado pós-Aditivo 2 (achados R1, R2, R3 documentados em chat 2026-04-27)

---

**FIM DO ADITIVO 3 — sessão DPO 2026-04-27 com 3 aditivos aplicados.**
