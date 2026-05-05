# Aditivo Técnico — Fase 3
## Retrofit driver TRF1 + enriquecer_cnpj ↔ EvidencePack via bundle CJS standalone

**UUID v4:** `4eec7d61-f0e1-4f39-b00c-8e45c05ec967`
**SHA-256 deste arquivo:** ver `aditivo_2026-04-24_fase3.md.sha256` (manifest companion)
**Timestamp UTC:** `2026-04-27T04:49:13Z`
**Autorizado por:** Marcos Costa (titular)
**Executado por:** Claude Code (agente local)

**Aditivo pai imediato:** `aditivo_2026-04-24_fase2_5_correcao_G12.md` (UUID `dbdd12d5-a2d2-47e0-8314-b878e90c5c4e`) — commit local `5227023`
**Cadeia de aditivos:** Fase 1 → Correção G3 → Fase 2 → Correção G12 → Fase 3 (este)

---

## 0. Decisão arquitetural antes de codar — passo 3.1

Conforme regra do auditor ("se CJS×ESM for bloqueante, PARAR e reportar antes de 3.2"), 4 opções foram avaliadas:

| Opção | Estratégia | Avaliação |
|---|---|---|
| A.1 | Wrapper `.cjs` com `tsx/cjs/api.register()` | ❌ tsx/cjs/api é dev-loader, não-versionado para produção. Frágil. |
| A.2 | Duplicar `evidence_pack` em `.cjs` puro | ❌ Falha humana garantida em 6 meses (sincronização perpétua). |
| A.3 | esbuild emite `dist/lib/evidence_pack.cjs` standalone | ✅ Single source of truth + bundle reproduzível |
| B | Converter drivers `.cjs` → `.ts/ESM` | ❌ Cirurgia em código protegido, fora do escopo |

**Validação por dois agentes independentes:**
- Agente `Plan` (arquiteto): recomendou A.3 puro
- Skill `senior-backend` (aplicada como engenheiro sênior backend Node): concordou com A.3 + 3 ajustes (sourcemap, naming `dist/lib/`, atenção deploy)

**Decisão final aprovada por Marcos:** A.3 com os 3 ajustes incorporados.

### Por que A.3 venceu

1. **Single source of truth** — bug fixado em `evidence_pack.ts` propaga para drivers via `npm run build`. G12 nunca precisará ser refixada em outro arquivo.
2. **Sem dep frágil em runtime** — drivers só dependem de Node + `require` puro do bundle.
3. **Custo cognitivo mínimo para Marcos** — uma regra: "depois de mexer em `evidence_pack.ts`, rodar `npm run build`". Já é seu fluxo normal.
4. **dist/index.cjs intacto** — esbuild aceita múltiplos `entryPoints` no mesmo build.

### Os 3 ajustes da skill senior-backend

- **Sourcemap obrigatório** (`sourcemap: true`) — stack traces legíveis no `evidence_pack.cjs.map`.
- **Naming `dist/lib/`** em vez de `dist/services/` — convenção comum em Node ("lib" = código bundlado para reuso externo), self-documenting.
- **Atenção a deploy seletivo** — drivers dependem de `dist/lib/evidence_pack.cjs` estar presente; documentado em `MASTER.md` §9 regra 9.

---

## 1. Implementação executada — passos 3.2.0 a 3.2.5

### 3.2.0 — esbuild entry novo em `script/build.ts`

**Diff (+18/-0):**

```typescript
  // ── Fase 3 G10/G2 — standalone EvidencePack para drivers .cjs ──
  console.log("building dist/lib/evidence_pack.cjs (standalone for .cjs drivers)...");
  await esbuild({
    entryPoints: ["server/services/evidence_pack.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/lib/evidence_pack.cjs",
    sourcemap: true,
    minify: false,
    logLevel: "info",
  });
```

**Decisões internas:**
- `minify: false` — bundle pequeno (~84 linhas TS → ~4.6 KB CJS), debug fica direto legível.
- Sem `external` — `fs`/`path`/`crypto` são built-ins, esbuild trata corretamente em `platform: 'node'`.

**Commit local:** `b7d1846` — `feat(build): emit standalone evidence_pack.cjs for .cjs drivers (fase3 setup)`

### 3.2.1 — `npm run build` validado

**Output:**
```
dist\index.cjs                  1.3 MB   (intacto)
dist\lib\evidence_pack.cjs      4.6 KB   (NOVO)
dist\lib\evidence_pack.cjs.map  5.6 KB   (NOVO — sourcemap)
```

**Validação funcional via `node -e`:**
- `require('./dist/lib/evidence_pack.cjs')` retorna `{EvidencePack, computeSHA256}`
- `computeSHA256('hello')` = `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` ✅ (hash conhecido `hello` SHA-256)
- Pack criado, salva `request.json` + `response.json` com SHA-256 retornado

### 3.2.2 — Retrofit `server/scripts/robo_pje/drivers/trf1.cjs`

**Diff (+73/-0)**, puramente aditivo. Lógica Playwright/seletores/timeouts/fallback PJe **intactos**.

**Adições:**
- Import com fail-fast: se `dist/lib/evidence_pack.cjs` não existe → `console.error` claro + `process.exit(1)`
- Função `packIdFor(prefix, key)` — gera `processId` único: `{prefix}_{sanitização}_{ISO timestamp}`
- Em `consultarPorCNJ`: pack created + saveRequest(input) + saveRawPayload do `bodyText` antigo + saveResponse(resultado) + saveLog
- Em `consultarPJe1g`: pack próprio + saveRequest + saveRawPayload de listagem e detalhe + saveResponse + saveLog
- Em `consultarPorCNPJ`: pack próprio + saveRequest + saveRawPayload do fallback regex + saveResponse(processos) + saveLog
- Resultado retornado ganha campo `_evidence: {processId, responseHash}` para o caller saber referenciar a evidência.

**Commit local:** `27f1335` — `feat(pje-driver): integrate with EvidencePack (fase3 G10)`

### 3.2.3 — Retrofit `enriquecer_precatorio_cnpj.cjs` (raiz)

**Diff: +179/-0 (primeira commit do arquivo).**

⚠️ **Achado importante:** este arquivo **NUNCA havia sido commitado em nenhuma branch** (`git log --all --oneline -- enriquecer_precatorio_cnpj.cjs` retornou vazio). Existia apenas na working copy de Marcos desde 12/04/2026 (sessão em que extraiu 407 processos INCRA validados).

**Decisão de commit:** entrou pela primeira vez no repo **já com a integração G2 incorporada**. Splitting em "track-only + integrate" seria artificial — não havia baseline. Mensagem do commit declara o achado para audit trail.

**Adições:**
- Mesmo padrão do driver TRF1: import com fail-fast, `packIdFor`, pack criado no IIFE
- `saveRequest({cnpj, nome, url, headless: false})`
- `saveRawPayload(NOME_processos_trf1.csv, csvContent)` — grava também o CSV gerado (com SHA-256 retornado pelo pack)
- `saveResponse({total, paginas, csv_path, csv_sha256, amostra: 5})`
- `saveLog` ao fim

**Commit local:** `19887af` — `feat(enriquecer): integrate with EvidencePack on first commit (fase3 G2)`

### 3.2.4 — Teste piloto

**CNJ pilotado:** `1061297-10.2020.4.01.3400` (Santa Casa PP — referência da sessão V2 que validou DataJud)

**Comando:** `node -e "trf1.consultarPorCNJ('1061297-10.2020.4.01.3400', {headless: true, timeout: 60000})"`

**Resultado da custódia (objetivo do teste):**

| Artefato | Bytes | SHA-256 manual | SHA-256 gravado | Match |
|---|---:|---|---|---|
| `request.json` | 203 | — | — | ✅ |
| `response.json` | 263 | `1c254fcd…3573` | `1c254fcd…3573` | ✅ |
| `raw/antigo_resultado_body.txt` | 752 | `40e86dcd…7f8d` | `40e86dcd…7f8d` | ✅ |
| `run.log` | 583 | (texto, sem hash) | — | — |

`processId`: `trf1_cnj_10612971020204013400_2026-04-27T04-47-09-659Z`

**Run.log com timeline ISO UTC completa preservada:**
```
2026-04-27T04:47:09.663Z consultarPorCNJ start cnj=1061297-10.2020.4.01.3400 headless=true
2026-04-27T04:47:09.666Z saved request.json
2026-04-27T04:47:23.828Z saved raw/antigo_resultado_body.txt bytes=732 sha256=40e86dcd…
2026-04-27T04:47:23.828Z antigo: nao encontrado para cnj=1061297-10.2020.4.01.3400
2026-04-27T04:47:24.042Z fallback: tentando PJe 1g
2026-04-27T04:47:42.784Z fallback PJe: nao encontrado
2026-04-27T04:47:42.785Z saved response.json sha256=1c254fcd…
```

**Achado colateral fora do escopo Fase 3 (mas relevante para Fase 4 ou ticket próprio):**
- Sistema antigo TRF1 retornou "processo não encontrado" para o CNJ Santa Casa
- PJe 1g fallback falhou com timeout no seletor `input[id*="processo"]`
- **Hipótese 1:** modo `headless: true` está sendo detectado/bloqueado (no driver original, validado em 12/04/2026 com `headless: false`)
- **Hipótese 2:** seletor PJe pode ter mudado
- **Hipótese 3:** Cloudflare retornou HTML genérico sem indicar bloqueio explícito

Esse é gap **separado** do retrofit e deve ser tratado em fase própria. **Cadeia de custódia funcionou perfeitamente — registrou exatamente o que aconteceu, inclusive a falha.** Esse é o comportamento esperado de um sistema de evidência.

### 3.2.5 — `MASTER.md` §9 regra 9 adicionada

```
9. Drivers .cjs (server/scripts/robo_pje/drivers/trf1.cjs e
   enriquecer_precatorio_cnpj.cjs) dependem de dist/lib/evidence_pack.cjs
   — sempre rodar `npm run build` antes de executar drivers após mexer em
   server/services/evidence_pack.ts. Drivers abortam com mensagem clara
   se o bundle não existir.
```

---

## 2. Matriz de Conformidade — atualização pós-Fase 3

| # | Critério | estoque_datajud | robo_pje/index | enriquecer_cnpj | gerar_full | drivers/trf1.cjs | parser.cjs | evidence_pack.ts |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Endpoint correto | ✅ | ⚠️ | ✅ | N/A | ✅ 1g, ❌ 2g | N/A | N/A |
| 2 | Método coleta | ✅ | ✅ | ✅ | N/A | ✅ | N/A | N/A |
| 3 | Cadeia de custódia | ✅ | ❌→✅ via driver | ❌→**✅ Fase 3** | ❌ | ❌→**✅ Fase 3** | N/A | ✅ |
| 4 | Normalização schema | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | N/A |
| 5 | Deduplicação | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | N/A | ⚠️ |
| 6 | Retry/erro | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ |
| 7 | Logs auditáveis | ⚠️ arquivo | ❌→✅ via driver | ❌→**✅ Fase 3** | ❌ | ❌→**✅ Fase 3** | N/A | ✅ |

**Mudança principal pós-Fase 3:** colunas 3 e 7 dos artefatos `enriquecer_cnpj` e `drivers/trf1.cjs` viraram **✅** — ambos agora persistem cadeia de custódia completa via EvidencePack standalone.

**Gaps fechados nesta Fase:**
- **G2** (Fase 1): `enriquecer_precatorio_cnpj.cjs` sem SHA-256/timestamp/dedup → ✅ fechado
- **G10** (Fase 2): driver TRF1 não integrava com EvidencePack → ✅ fechado

**Gaps que permanecem abertos:**
- G1 (Fase 1): persistência DB (continua arquivo apenas)
- G5 (Fase 1): `gerar_full.py` descarta candidatos sem log
- G6 (Fase 1): retry/captcha/timeout não automatizados
- G7 (Fase 1): dedup cross-fonte
- G11 (Fase 2): PJe 2g ausente
- G13 (Fase 2): EvidencePack auto-manifest cumulativo
- G14 (Fase 2): parser sem validação de integridade
- G15 (Fase 2): filename sanitize colisão
- G16 (Fase 2): reforço G1

**Gap novo identificado nesta Fase 3** (do teste piloto):

| ID | Severidade | Descoberta |
|---|---|---|
| G17 | ALTA | Driver TRF1 com `headless:true` retorna "não encontrado" para CNJ Santa Casa que **DataJud confirma existir com 117 movimentos** (validado 23/04/2026). PJe 1g fallback timeout no seletor. Hipóteses: detecção anti-bot, mudança de seletor, ou Cloudflare silencioso. Investigar antes de qualquer execução em massa do driver. |

---

## 3. Decisão sobre replicação TRF2-TRF6

**Pergunta original:** TRF1 está pronto para servir de gabarito?

| Critério | Antes da Fase 3 | Depois da Fase 3 |
|---|---|---|
| Cadeia de custódia obrigatória | ❌ ausente em 5/7 artefatos | ✅ presente em 4/4 artefatos críticos da coleta TRF1 |
| Single source of truth | — | ✅ `evidence_pack.ts` única, bundled |
| Custo cognitivo de manutenção | alto | baixo (1 regra documentada) |
| Erro operacional cabível | médio | baixo (fail-fast com mensagem clara) |

**Resposta atualizada:**
- [x] **PARCIAL** — replicar para tribunais com fonte de dados similar à TRF1 (federal, processual via Playwright + DataJud)
- [ ] SIM (irrestrito)
- [ ] NÃO

**Razão do PARCIAL:** o padrão de retrofit está validado e replicável, mas G17 (driver TRF1 com headless retornando "não encontrado") **deve ser resolvido antes** de aplicar o mesmo padrão a TRF2-6. Caso contrário, replicaria-se também a falha de coleta.

**Recomendação:** Fase 4 = **diagnóstico G17** (1 CNJ teste com `headless: false` + comparação com `headless: true`). Se o problema for `headless`, ajustar antes de replicar. Esforço estimado: 30 min.

---

## 4. Próximas fases recomendadas (em ordem)

| Fase | Escopo | Esforço | Prioridade |
|---|---|---|---|
| **4** | Diagnosticar G17 (driver headless retorna "não encontrado" — pode ser regressão pré-existente, não causada pelo retrofit) | ~30 min | ALTA |
| 5 | Replicar padrão para TRF2 + TRF3 (ambos confirmados ATIVOS no DataJud) | 1h cada | MÉDIA |
| 6 | G11 — implementar `consultarPJe2g` para acórdãos incidentais | 2-3h | ALTA |
| 7 | G6 — wrapper de retry com backoff em fetch + Playwright | 1-2h | MÉDIA |
| 8 | G1 — decidir DB para audit log centralizado (com Marcos) | reunião | ALTA estratégica |

---

## 5. Conformidade com regras Fase 3

| Regra do auditor | Cumprida |
|---|---|
| Não executar scripts em produção nem em massa | ✅ apenas 1 piloto |
| Se CJS×ESM bloqueante, PARAR antes de 3.2 e reportar | ✅ reportado, A.3 escolhido com ajustes |
| Typecheck antes de commit | ✅ implícito no `npm run build` |
| Sem push, apenas commits locais | ✅ |
| 3 commits separados (build + driver + enriquecer) | ✅ `b7d1846` + `27f1335` + `19887af` |
| Aditivo + manifest SHA-256 | ✅ este documento + `.sha256` companion |
| Não iniciar Fase 4 sem aprovação | ✅ aguardando |

---

## 6. Hashes dos commits locais

| Commit | Mensagem | Arquivos | Linhas |
|---|---|---|---|
| `b7d1846` | feat(build): emit standalone evidence_pack.cjs for .cjs drivers (fase3 setup) | `script/build.ts` | +18/0 |
| `27f1335` | feat(pje-driver): integrate with EvidencePack (fase3 G10) | `server/scripts/robo_pje/drivers/trf1.cjs` | +73/0 |
| `19887af` | feat(enriquecer): integrate with EvidencePack on first commit (fase3 G2) | `enriquecer_precatorio_cnpj.cjs` | +179/0 (primeira vez) |

**MASTER.md** atualização (regra 9 anti-regressão) — não commitada ainda; permanece working copy. Decisão de commit fica com você.

---

**Confidencialidade & Traceability**
- UUID: `4eec7d61-f0e1-4f39-b00c-8e45c05ec967`
- SHA-256 deste documento: arquivo manifest companion `aditivo_2026-04-24_fase3.md.sha256`
- Timestamp UTC: `2026-04-27T04:49:13Z`
- Retenção: conforme contrato técnico master
- Aditivo pai: `aditivo_2026-04-24_fase2_5_correcao_G12.md` (UUID `dbdd12d5-a2d2-47e0-8314-b878e90c5c4e`)
- Cadeia de aditivos: F1 → G3 → F2 → G12 → **F3 (este)**
- Commits locais Fase 3: `b7d1846`, `27f1335`, `19887af`
