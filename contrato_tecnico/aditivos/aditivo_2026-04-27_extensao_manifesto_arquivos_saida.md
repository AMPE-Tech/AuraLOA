# ADITIVO TÉCNICO — 2026-04-27

**ID:** `aditivo_2026-04-27_extensao_manifesto_arquivos_saida`
**Vinculação:** Cláusula N1 (Obrigação de Consolidação Diária) e Cláusula 10 (Evidence Pack System) do `CONTRATO_TECNICO_MASTER.md` v3.1
**Status:** APLICADO — não destrutivo
**Aditivo nº:** 1 de 2 da sessão (sequencial). O Aditivo 2 (regra UO 10101 → 71103) será emitido em mensagem separada após aprovação deste.

---

## a) Descrição objetiva da mudança

Saneamento estrutural do `manifesto_integridade.json` da entrega **LOA 2026 Federal — CONCILIADO/upload 27apr2026**.

O manifesto v1, gerado pelo pipeline de extração em 2026-04-27 06:15:47 UTC, cobria apenas a fronteira de **input** do pipeline (58 PDFs de origem com `sha256_pdf` cada). Os 7 artefatos **derivados** produzidos pelo pipeline (consolidados CSV BR/INTL, XLSX, ranking, resumo, log de extração e o próprio manifesto v1) **não eram cobertos por hash de integridade**.

Foi criado o `manifesto_integridade_v2.json` no mesmo diretório, **sem sobrescrever o v1**, adicionando blocos novos para fechar a cadeia de custódia dos derivados.

---

## b) Arquivos impactados

| Tipo | Caminho | Ação |
|---|---|---|
| Criado | `…\CONCILIADO\upload 27apr2026\manifesto_integridade_v2.json` | NOVO — 21.402 B |
| Preservado intacto | `…\CONCILIADO\upload 27apr2026\manifesto_integridade.json` | INALTERADO — sha256 idêntico antes e depois |
| Inspecionados (somente leitura) | 58 PDFs em `…\LOA_2026_Por_Tribunal\` | Hash recalculado para validar integridade vs v1 |
| Inspecionados (somente leitura) | 7 derivados em `…\upload 27apr2026\` | Hash calculado para entrar em `arquivos_saida[]` |
| Criado | `…\AuraLOA\contrato_tecnico\aditivos\aditivo_2026-04-27_extensao_manifesto_arquivos_saida.md` | Este aditivo |

**Nenhum CSV foi tocado. Nenhuma transformação de dados foi feita. Apenas governança.**

---

## c) Diff técnico (antes / depois)

### Antes — `manifesto_integridade.json` (v1, 14.541 B, sha `f2983ecc…fcacf`)

```
{
  "data_emissao_relatorio_origem": "2025-09-17",
  "timestamp_processamento_utc":  "2026-04-27T06:15:47.183526+00:00",
  "qtd_pdfs_processados": 58,
  "qtd_registros_total": 79156,
  "qtd_warnings_total": 0,
  "valor_total_consolidado_brl": 22306037833.0,
  "qtd_uos_devedoras_unicas": 56,
  "padroes_numeracao": { "CNJ":12773, "CNJ_COMPACTO":64834, "SEQUENCIAL":1549, "OUTRO":0 },
  "pdfs_origem": [ ... 58 entradas ... ]
}
```

### Depois — `manifesto_integridade_v2.json` (v2, 21.402 B, sha `4f52f740…419c9a`)

```
{
  "schema_version": "2.0",                            ← NOVO
  "schema_changelog": [v1, v2],                       ← NOVO
  "auto_referencia": { "predecessor": {sha256 v1} },  ← NOVO
  "data_emissao_relatorio_origem": "2025-09-17",      ← idêntico ao v1
  "timestamp_processamento_utc":  "...",              ← idêntico ao v1
  "qtd_pdfs_processados": 58,                         ← idêntico ao v1
  "qtd_registros_total": 79156,                       ← idêntico ao v1
  "qtd_warnings_total": 0,                            ← idêntico ao v1
  "valor_total_consolidado_brl": 22306037833.0,       ← idêntico ao v1
  "qtd_uos_devedoras_unicas": 56,                     ← idêntico ao v1
  "padroes_numeracao": { ... },                       ← idêntico ao v1
  "pdfs_origem": [ ... 58 entradas ... ],             ← CÓPIA BYTE-A-BYTE do v1 (assert no script)
  "diretorios_referencia": {pdfs_origem, arquivos_saida}, ← NOVO
  "arquivos_saida": [ ... 7 entradas com sha256 ... ],    ← NOVO
  "transformacoes": []                                ← NOVO (vazio — populado pelo Aditivo 2)
}
```

### Campos adicionados (declarados em `auto_referencia.predecessor.campos_adicionados`)

- `schema_version`
- `schema_changelog`
- `auto_referencia`
- `diretorios_referencia`
- `arquivos_saida`
- `transformacoes`

### Campos alterados ou removidos

**Nenhum.** Todos os campos do v1 foram preservados com valores idênticos.

---

## d) Saída funcional comprovando a alteração

### Estado do diretório canônico após a operação

```
…\CONCILIADO\upload 27apr2026\
├── log_extracao.txt                                144 B  mtime 03:18
├── manifesto_integridade.json                  14.541 B  mtime 03:18  ← v1 INTOCADO
├── manifesto_integridade_v2.json               21.402 B  mtime 05:51  ← NOVO
├── precatorios_loa_2026.xlsx                  900.468 B  mtime 03:18
├── precatorios_loa_2026_consolidado_BR.csv 40.063.193 B  mtime 03:18
├── precatorios_loa_2026_consolidado_INTL.csv 43.704.412 B  mtime 03:18
├── ranking_devedores.csv                       14.724 B  mtime 03:18
└── resumo_por_tribunal.csv                      1.366 B  mtime 03:18
```

### Hashes oficiais registrados no v2 (`arquivos_saida[]`)

| Arquivo | SHA-256 |
|---|---|
| `log_extracao.txt` | `58c72f2a03b0587f494927c95f02ba5341757d14373cc85f0c1698baf7620d5c` |
| `manifesto_integridade.json` | `f2983eccd0023094f01919e3e145c5f40de49a585ab43fbd9410f30a79cfcacf` |
| `precatorios_loa_2026.xlsx` | `5668df828f0ad3d53e30a52444ffc0fd3859041bcdec0b8706c7ad6cd04d1cfc` |
| `precatorios_loa_2026_consolidado_BR.csv` | `232d87951fe5136ad1fb7c1bf2d87cd54fca836865259966c95c903fef69bf4e` |
| `precatorios_loa_2026_consolidado_INTL.csv` | `cb90baeadd17638350eb898530f299e3295466a3485bf6a48230942ccb8a62c3` |
| `ranking_devedores.csv` | `816a030d0e3f3878091525c2d5237b86d7a724b55c04f671c77c03e052658c6c` |
| `resumo_por_tribunal.csv` | `862a1c996024c24471a8c79fcde877fee005817d6c7bfbd84ca9777615a22c43` |

### Validação de integridade da fronteira de input (58 PDFs)

| Métrica | Valor |
|---|---|
| PDFs declarados em `manifesto_v1.pdfs_origem[]` | 58 |
| PDFs encontrados em `…\LOA_2026_Por_Tribunal\` | 58 |
| PDFs com `sha256_pdf` íntegro | **58 / 58** |
| PDFs com `sha256_pdf` divergente | 0 |
| Veredito | **INTEGRO** |

---

## e) Log de execução

```
2026-04-27T08:50:46.758Z — Re-listagem do diretório canônico antes da gravação. 7 arquivos confirmados, mtimes 03:18. Sem alteração desde a leitura anterior.
2026-04-27T08:51:xx Z   — Script Python `_temp_gerar_manifesto_v2.py` executado:
                          • leu v1 (14.541 B, sha f2983ecc…)
                          • assertou qtd_pdfs_origem == 58
                          • assertou pdfs_origem cópia byte-a-byte
                          • escreveu v2 (21.402 B, sha 4f52f740…)
                          • abortaria se v2 já existisse (proteção contra sobrescrita)
2026-04-27T08:51:xx Z   — Re-listagem pós-gravação: 8 arquivos, v1 sha intacto (f2983ecc…), v2 sha confirmado (4f52f740…).
```

Script transitório utilizado: `AuraLOA/_temp_gerar_manifesto_v2.py` (será removido ao final desta sessão).

---

## f) Justificativa técnica

1. **Cláusula 1 (CONTRATO_TECNICO_MASTER):** "Nenhuma informação pode ser considerada confirmada sem evidência oficial verificável." Os 7 derivados estavam em uso de fato pelo pipeline AuraLOA, mas sem âncora de hash oficial — gap real de governança.
2. **Cláusula 5.1 (Anti-regressão):** Sem hash oficial dos derivados, não é possível detectar adulteração ou substituição silenciosa em entregas futuras.
3. **Cláusula 10 (Evidence Pack):** estabelece sha256 como requisito mínimo para classificação `OK`. Os derivados precisam dessa âncora para participarem do pipeline D2/D3.
4. **Cláusula 7 (Fail-fast):** durante esta mesma sessão foi detectada **divergência entre listagens consecutivas** do diretório canônico (5 arquivos na 1ª, 7 na 2ª, 8 após este aditivo). A divergência foi reportada honestamente. A existência de `auto_referencia` no v2 evita esse tipo de ambiguidade em ciclos futuros.

---

## g) Impacto

| Dimensão | Impacto |
|---|---|
| Layout / UI | Nenhum |
| Schema de banco | Nenhum |
| Regras de negócio | Nenhum |
| Dados | Nenhum (zero linha de CSV alterada) |
| Governança | Sim — manifesto agora cobre 100% dos artefatos da entrega |
| Reversibilidade | Total — v1 preservado byte-a-byte, basta apagar v2 para voltar ao estado anterior |
| Pré-condição para Aditivo 2 | **Sim** — a transformação UO 10101 → 71103 só pode ser feita com o manifesto saneado, para que `transformacoes[]` herde a cadeia de custódia |

---

## Pendências declaradas (campos `a_definir`)

O v2 marcou explicitamente como `null` + `a_definir: true`:

- **`origem_pipeline`** (em todos os 7 derivados) — nome interno do pipeline produtor a ser confirmado pelo titular
- **`fonte_derivada_de`** (em `ranking_devedores.csv` e `resumo_por_tribunal.csv`) — _BR ou _INTL como input do agregador
- **`mtime_timezone`** — TZ assumida do filesystem Windows; será resolvida quando o titular confirmar a TZ-padrão do projeto
- **`consolidado_BR.csv`** — listado nesta versão; aplica-se também a ele a regra UO no Aditivo 2

Esses campos não bloqueiam o Aditivo 2 — entram como pendência declarada e serão resolvidos em aditivo futuro.

---

## Validação por hash (selo deste aditivo)

| Arquivo | SHA-256 |
|---|---|
| `manifesto_integridade.json` (v1, intocado) | `f2983eccd0023094f01919e3e145c5f40de49a585ab43fbd9410f30a79cfcacf` |
| `manifesto_integridade_v2.json` (NOVO) | `4f52f740caa9b4e3ea0411f9aa39bc09c04b95742c23e2a9baa99c6d7e419c9a` |
| `aditivo_2026-04-27_extensao_manifesto_arquivos_saida.md` | *(será calculado e gravado em `.sha256` adjacente após este commit)* |

---

**Responsável pela aplicação:** Agente AuraLOA (sessão 2026-04-27)
**Aprovação:** Marcos Costa (titular DPO) — "rascunho aprovado" em chat 2026-04-27
**FIM DO ADITIVO 1 — aguardando aprovação para Aditivo 2 (regra UO 10101 → 71103).**
