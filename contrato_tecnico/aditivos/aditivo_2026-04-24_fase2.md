# Aditivo Técnico — 2026-04-24 — Fase 2
## Auditoria de Conformidade TRF1 — Aprofundamento driver PJe + Parser + EvidencePack

**UUID v4:** `396bed76-1d11-4264-b33c-cca943bb0d58`
**SHA-256 deste arquivo:** ver `aditivo_2026-04-24_fase2.md.sha256` (manifest companion)
**Timestamp UTC:** `2026-04-24T10:28:06Z`
**Autorizado por:** Marcos Costa (titular)
**Executado por:** Claude Code (agente local)
**Regra de execução:** apenas leitura — nenhum script executado, nenhum dado alterado.

**Aditivo pai:** `aditivo_2026-04-24_fase1.md` (UUID `0a2d9a26-90fa-45cd-b056-34ba5c31e294`)
**Aditivo de correção anterior:** `aditivo_2026-04-24_fase1_correcao_G3.md` (UUID `84a0f07b-95bd-4b98-8274-79f7c2d13982`) — commit local `5bb67a4`

---

## 0. Divergência de caminho detectada — reportada conforme regra 3

O prompt do auditor listou:

> 3. `server/v2/evidence_pack.ts`

**Arquivo não existe nesse caminho.** O arquivo real utilizado por `server/services/estoque_datajud.ts` (L2: `import { EvidencePack, computeSHA256 } from "./evidence_pack";`) está em:

```
server/services/evidence_pack.ts
```

**Decisão:** auditoria prosseguida com o arquivo real (`server/services/evidence_pack.ts`) — é conceitualmente o mesmo objeto que o auditor pediu. Reportado nesta seção para que o auditor possa corrigir o caminho em futuras solicitações ou confirmar que se referia a outro artefato inexistente.

---

## 1. `server/scripts/robo_pje/drivers/trf1.cjs` (529 linhas)

Código validado em 12/04/2026 (407 processos INCRA extraídos). Expõe 3 funções: `consultarPorCNJ`, `consultarPorCNPJ`, `consultarPJe1g`.

### A. Endpoint e método

| Função | URL | Método |
|---|---|---|
| `consultarPorCNJ` | `https://processual.trf1.jus.br/consultaProcessual/numeroProcesso.php?secao=TRF1` (L15) | Playwright |
| `consultarPorCNPJ` | `https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1` (L16) | Playwright |
| `consultarPJe1g` | `https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam` (L17) | Playwright |

**Cobertura PJe 2g:** ❌ **NÃO coberto.** Driver atinge apenas 1º grau. Precatórios em grau recursal (p.ex. acórdãos) não são acessíveis por este driver — exige novo driver ou complemento.

**Configuração anti-detecção** (L24-43):
- `--disable-blink-features=AutomationControlled`
- user-agent Chrome 124 Windows
- viewport 1920×1080, locale pt-BR
- `Object.defineProperty(navigator, 'webdriver', {get: () => false})`

**Seletores validados**: `input#proc`, `input#cpf_cnpj`, `input#enviar`, `input[id*="processo"]`, `input[id*="Processo"]`.

**Anti-reCAPTCHA:** submissão via `press('Enter')` em vez de click no botão (L89, L240) — validado 13/04/2026 como estratégia que contorna o CAPTCHA do PJe.

### B. Persistência

- **PostgreSQL:** ❌ não grava.
- **Arquivo próprio:** ❌ não grava. Retorna objeto `resultado` em memória.
- **Screenshot opcional:** `options.screenshot` (L165-167, L351-354, L166) — PNG na path passada.
- **Log:** `console.log` apenas — **não persistido**.

### C. Cadeia de custódia

| Item | Status | Local |
|---|---|---|
| Timestamp ISO UTC | ✅ | L55, L215, L382 — `timestamp: new Date().toISOString()` no objeto resultado |
| SHA-256 de payload/resposta | ❌ | Driver não calcula hash de nada |
| URL exata | ⚠️ | Constantes em `URLS` (L14-18); não é incluída por registro coletado |
| HTTP status | ❌ | Playwright não expõe; detecta Cloudflare apenas por título (L68-79, L397-407) |
| `storageState` (persistir sessão) | ❌ | Não usa — cada execução cria contexto novo |

### D. Tratamento de erro

| Cenário | Status | Evidência |
|---|---|---|
| **Cloudflare** | ✅ **DETECTADO** — título "Just a moment"/"Cloudflare" → aguarda 8-10s; se persistir, retorna erro (L68-79, L397-407) |
| Timeout | ⚠️ | default 45s (L46, L205); `setDefaultTimeout` em PJe (L223) — **sem ajuste dinâmico** |
| Retry automático | ❌ | Nenhum dentro do driver |
| **Fallback sistema antigo → PJe 1g** | ✅ | **Implementado** — se sistema antigo falha ou traz <2 movs, tenta PJe 1g (L175-194). Merge preserva campos mais ricos. |
| Sessão | N/A | Consulta pública, sem login |
| Catch global | ✅ | try/catch em cada função com `resultado.erro = e.message.substring(0, 300)` (L169-173, L361-365, L519-523) |
| `browser.close()` no finally | ✅ | Garante liberação de recursos (L171-173, L363-365, L521-523) |

### E. Deduplicação

| Tipo | Status | Detalhe |
|---|---|---|
| Dentro de `consultarPorCNPJ`, entre páginas | ✅ | `if (!resultado.processos.find(p => p.cnj === numProcesso))` (L471) |
| Fallback regex (quando tabela falha) | ✅ | `[...new Set(...)]` (L488) |
| Cross-run (mesma consulta 2x) | ❌ | Cada execução é independente, sem cache |
| Cross-fonte (DataJud + este driver) | ❌ | Sem reconciliação |

### Tempo estimado por processo

Inferido a partir dos `waitForTimeout` + `waitFor`:

- Goto + wait inicial: 3s + 3s
- Fill + Enter: ~1s
- Wait resultado: 5-6s
- Extração de texto: <1s
- **Sistema antigo OK:** ~15-20s
- **Com Cloudflare detectado:** +8-10s → ~25-30s
- **Fallback PJe 1g (se antigo falha):** +~15-25s → 40-55s totais

**Para os 192 precatórios ≥ R$10M:** entre **50 min (melhor cenário)** e **3h (pior cenário com fallback em todos)**.

---

## 2. `server/scripts/robo_pje/parser.cjs` (116 linhas)

Parser puro — opera sobre estrutura já normalizada `{codigo, nome, dataHora, complementosTabelados?}`.

### A. Endpoint e método
- N/A — parser offline.

### B. Persistência
- N/A — retorna objeto em memória (L113 `return resultado`).

### C. Cadeia de custódia
- N/A (parser puro, não coleta).

### D. Tratamento de erro
- **Robusto a inputs inconsistentes:**
  - `mov.codigo || 0` (L75)
  - `(mov.nome || '').toLowerCase()` (L76)
  - `(mov.complementosTabelados || []).map(...)` (L77)
  - Nunca faz throw.
- **Ausência de validação de integridade:** ⚠️ não verifica se `dataHora` é formato DD/MM/AAAA, se `codigo` é conhecido, se `nome` não é placeholder.

### E. Normalização / Extração

**Campos de saída** (L56-67):
- `total_movimentacoes`
- `status_pagamento` ∈ {`PENDENTE`, `PAGO`, `SAQUE_DISPONIVEL`}
- `data_pagamento`
- `oficio_requisitorio {dataHora, descricao}`
- `gravames[]` (array — refina indicadores de penhora/bloqueio)
- `movimentacoes_pagamento[]`, `_oficio[]`, `_gravame[]`
- `primeira_movimentacao`, `ultima_movimentacao`

**Dicionários hardcoded:**

| Bloco | Códigos | Propósito |
|---|---|---|
| `CODIGOS_PAGAMENTO` | 12217, 12218, 12282, 12287 | Detecção estrutural de depósito |
| `CODIGOS_OFICIO` | 60, 581 | Expedição de documento/ofício |
| `CODIGOS_RELEVANTES` | 18 códigos (85, 51, 22, 848, …) | Mapeamento semântico |
| `TERMOS_PAGAMENTO` | 11 termos | Detecção textual quando código ausente |
| `TERMOS_GRAVAME` | 8 termos | Detecção de penhora/bloqueio |
| `TERMOS_OFICIO` | 3 termos | Detecção textual de ofício requisitório |

**Refinamento de status:**
- Se há "alvará" → `SAQUE_DISPONIVEL` (L106-111)
- Padrão: `PAGO` se detecta pagamento, senão `PENDENTE`

**Fallback quando HTML muda:** ⚠️ parser não tem fallback próprio — **responsabilidade do driver** enviar estruturas consistentes. Se driver mudar schema, parser silenciosamente produz output vazio sem avisar.

---

## 3. `server/services/evidence_pack.ts` (84 linhas)

Biblioteca de cadeia de custódia. Sub-exporta `computeSHA256` (função pura) e classe `EvidencePack`.

### A. Endpoint e método
- N/A — utilitário local de FS + hash.

### B. Persistência

Diretório base por instância: `./Saida/evidence/{processId}/` (L14-19).

| Arquivo | Método | Formato |
|---|---|---|
| `request.json` | `saveRequest(data)` | JSON indent 2 |
| `response.json` | `saveResponse(data)` → retorna SHA-256 do conteúdo | JSON indent 2 |
| `raw/{filename sanitizado}` | `saveRawPayload(filename, data)` → retorna `{path, sha256}` | binário/texto original |
| `hashes.json` | `saveHashes(hashes)` — recebe Record já montado pelo chamador | JSON indent 2 |
| `run.log` | `saveLog()` | TS ISO + mensagem por linha |

**DB PostgreSQL:** ❌ não grava — confirma ressalva do auditor ("arquivo ≠ banco").

### C. Cadeia de custódia

| Item | Status | Evidência |
|---|---|---|
| SHA-256 de response | ✅ | L40-47 `computeSHA256(content)` |
| SHA-256 de raw payload | ✅ | L49-59 com filename sanitizado |
| Timestamp ISO UTC por linha de log | ✅ | L28-29 `${ts} ${message}` |
| URL exata | ❌ | Não é responsabilidade do EvidencePack — chamador decide salvar |
| HTTP status | ❌ | Idem — chamador captura |
| **Método de verificação** | ✅ | `verifyFile(relativePath, expectedHash)` (L76-82) recalcula SHA-256 e compara |
| Manifesto cumulativo auto-gerado | ❌ | `saveHashes` exige Record montado pelo chamador — sem auto-tracking |
| Assinatura digital (GPG/PGP/X.509) | ❌ | Apenas SHA-256, sem assinatura |

### D. Tratamento de erro

| Cenário | Status |
|---|---|
| Diretório não existe | ✅ `ensureDir` mkdir recursive (L21-25) |
| `saveResponse` sobrescreve `response.json` sem backup | ❌ **Risco de perda silenciosa** se chamado 2x no mesmo processId |
| Retry | ❌ Não implementado (responsabilidade do chamador) |
| Timeout | N/A (FS local síncrono) |
| Captcha | N/A |

### E. Deduplicação

| Tipo | Status |
|---|---|
| Filename sanitization | ⚠️ L53 `filename.replace(/[^a-zA-Z0-9._-]/g, "_")` — se 2 filenames originais diferentes normalizam para o mesmo, o segundo sobrescreve o primeiro **sem aviso** |
| Dedup por hash (mesmo conteúdo 2x) | ❌ Salva 2 arquivos iguais sem detectar |
| `response.json` idempotente? | ❌ Sobrescreve sem backup nem versionamento |

---

## 4. Matriz de Conformidade consolidada — 7 critérios × 7 artefatos

Fase 1 (4 artefatos) + Fase 2 (3 artefatos). INDETERMINADO resolvidos.

| # | Critério | estoque_datajud | robo_pje/index | enriquecer_cnpj | gerar_full | **drivers/trf1.cjs** | **parser.cjs** | **evidence_pack.ts** |
|---|---|---|---|---|---|---|---|---|
| 1 | Endpoint correto (PJe 1g/2g + DataJud) | ✅ DataJud | ⚠️ orquestrador | ✅ TRF1 proc | N/A offline | **✅ 1g ok, ❌ 2g ausente** | N/A | N/A |
| 2 | Método coleta (Playwright + API) | ✅ API | ✅ Playwright | ⚠️ headless:false fixo | N/A offline | **✅ Playwright anti-detect** | N/A | N/A |
| 3 | Cadeia de custódia (SHA + ts + URL + HTTP) | ✅ via EvidencePack | ❌ ausente | ❌ ausente | ❌ | **⚠️ timestamp sim, SHA não** | N/A | **✅ SHA + verify + ts** |
| 4 | Normalização schema | ✅ parseHit | ✅ via driver | ⚠️ 3 col CSV | ✅ 32 col | **✅ dados+partes+movs** | **✅ status/ofício/gravames** | N/A |
| 5 | Deduplicação | ⚠️ pick sem log | ❌ | ❌ | ⚠️ pick sem log | **✅ intra-run, ❌ cross-run** | N/A | **⚠️ sanitize pode colidir** |
| 6 | Retry/erro | ❌ sem retry | ❌ sem retry | ❌ | ❌ silencioso | **⚠️ detecta CF sem retry, ✅ fallback antigo→PJe** | ✅ tolerante | ❌ sem retry |
| 7 | Logs auditáveis | ⚠️ arquivo | ❌ JSON sobrescrito | ❌ sem log | ❌ console | **⚠️ console só** | N/A puro | **✅ run.log + hashes.json** |

---

## 5. Gaps novos (Fase 2) — continuação G10+

| ID | Severidade | Gap | Ação proposta | Prazo |
|---|---|---|---|---|
| **G10** | **CRÍTICO** | Driver TRF1 (`drivers/trf1.cjs`) **NÃO integra** com o `EvidencePack` existente. Cadeia de custódia madura já implementada, mas o robô PJe a ignora. Cada consulta perde SHA-256 da resposta HTML/JSON. | Wrap driver com `EvidencePack(processId)` — `saveRequest(input)`, `saveResponse(resultado)`, `saveRawPayload("bodyText_pagina{N}.txt", bodyText)`. Mudança de ~15 linhas. | **Fase 3** |
| **G11** | ALTA | PJe 2g não coberto. Processo incidental (acórdão — p. ex. Santa Casa R$235M tinha acórdão com transito em julgado parcial) tramita no 2g. Sem acesso automatizado. | Adicionar função `consultarPJe2g` análoga a `consultarPJe1g`, apontando para `pje2g-consultapublica.trf1.jus.br`. Reuso >80%. | Fase 4 |
| **G12** | ALTA | `EvidencePack.saveResponse` e `saveRequest` **sobrescrevem** sem backup. Chamada 2x com mesmo `processId` perde evidência anterior silenciosamente. | Renomear existente para `response.{timestamp}.json` antes de gravar novo. 3 linhas. | Fase 3 |
| **G13** | MÉDIA | `EvidencePack` sem auto-manifest. `saveHashes` exige que chamador monte o `Record` — esquecer 1 arquivo significa manifest incompleto. | Classe manter `private hashes: Record<string,string>` interno, atualizado por `saveResponse/saveRawPayload`, persistido automaticamente em `close()` ou similar. | Fase 3 |
| **G14** | MÉDIA | `parser.cjs` sem validação de integridade. Se driver retornar `codigo: NaN`, `dataHora` malformada, ou `nome` vazio, parser aceita e produz saída enganosa. | Adicionar função `validarMovimentacoes(movs)` no início com threshold de rejeição (ex: >30% de datas malformadas → erro). | Fase 4 |
| **G15** | BAIXA | `EvidencePack.saveRawPayload` sanitize de filename (L53) pode gerar **colisão silenciosa** (ex: `datajud_trf1_page1.json` e `datajud trf1 page1.json` → mesma chave). | Detectar colisão antes de gravar; se filename já existe, sufixar com hash curto. | Fase 5 |
| **G16** | BAIXA | Reforço de G1 (Fase 1): agora confirmado em 7/7 artefatos — **zero deles persistem em PostgreSQL**. Toda evidência é arquivo. | Criar tabela `coleta_externa_log` + migrar EvidencePack para persistir também em DB (duplo: arquivo + DB) ao fechar o pack. | Fase 6 (decidir com Marcos) |

---

## 6. Decisão atualizada

**TRF1 está pronto para servir de gabarito para TRF2-TRF6?**

- [ ] SIM
- [x] **NÃO**
- [ ] PARCIAL

### Justificativa (atualizada com Fase 2)

**Boa notícia da Fase 2:**
- O driver TRF1 (`drivers/trf1.cjs`) é **mais maduro** do que a Fase 1 inferiu — tem detecção Cloudflare, fallback sistema-antigo→PJe, anti-detecção completa.
- `EvidencePack` é maduro e pronto para uso — **não precisa construir do zero**, basta integrar nos scripts que ainda não usam.
- Parser é robusto a inputs inconsistentes (nunca faz throw).

**Má notícia:**
- Existe uma **infraestrutura de custódia madura e uma coleta madura, mas elas NÃO conversam.** O driver não usa EvidencePack; `enriquecer_precatorio_cnpj.cjs` também não. Quem usa é só `estoque_datajud.ts`.
- Replicar o padrão para TRF2-6 **herdaria a desconexão** entre os dois — multiplicando G10.

**Conclusão:** não replicar até G10 (integrar driver ↔ EvidencePack) estar resolvido.

---

## 7. Divergências reportadas ao auditor

1. **Caminho `server/v2/evidence_pack.ts`** não existe. Arquivo real: `server/services/evidence_pack.ts` (seção 0 acima).

2. **Estimativa de tempo na Fase 1** subestimou — com fallback PJe 1g, um processo pode chegar a **55s**. Re-enriquecimento dos 192 no pior cenário = ~3h.

3. **Confirmação empírica de que PJe 1g TEM método de coleta ativo e validado.** A hipótese cautelosa da Fase 1 ("status INDETERMINADO do robô") se resolve em **conformidade efetiva** para PJe 1g — mas NÃO para PJe 2g (nunca foi implementado).

---

## 8. Próxima fase recomendada

**Fase 3 — Retrofit: integrar `drivers/trf1.cjs` + `enriquecer_precatorio_cnpj.cjs` com `EvidencePack` existente.**

**Justificativa:** G10 e G2 (este último da Fase 1) **se resolvem com a mesma ferramenta** (EvidencePack). Reuso do que já existe em vez de construir novo — princípio de contenção + "USAR O QUE JÁ EXISTE".

**Escopo estrito proposto para Fase 3:**
1. Adicionar import de EvidencePack em `drivers/trf1.cjs` (converter CJS ↔ ESM: resolver, se necessário, via `require` compilado ou lib alternativa).
2. Instanciar pack por consulta: `new EvidencePack(cnj_ou_cnpj_hash)`.
3. Após cada goto/click chave, chamar `saveRawPayload("body_{etapa}.html", html)`.
4. Ao final, `saveResponse(resultado)` + `saveLog()` + `saveHashes(manifest)`.
5. Mesmo tratamento em `enriquecer_precatorio_cnpj.cjs`.

**Gaps que permanecem abertos após Fase 3:** G1 (DB), G5, G6, G7, G11, G13, G14, G15, G16. Decidir com auditor a ordem.

**Alternativa:** se o auditor preferir priorizar **G12** (sobrescrita sem backup), essa é mudança menor (3 linhas) que poderia ser feita antes da Fase 3.

---

## 9. Ressalva reforçada (continuação da Fase 1)

> "arquivo ≠ banco" para auditoria consultável (auditor, Fase 1)

Fase 2 confirmou: **7 de 7 artefatos ignoram PostgreSQL como destino de evidência.** O `EvidencePack`, embora maduro como sistema de arquivo/hash, não grava em banco. Para auditoria forense escalável sobre milhares de processos (os 10.736 já coletados + os 192 ≥ R$10M a re-enriquecer), grep em diretório `Saida/evidence/*` é inviável. G1 continua sendo o gap estrutural de maior impacto.

---

**Confidencialidade & Traceability**
- UUID: `396bed76-1d11-4264-b33c-cca943bb0d58`
- SHA-256 deste documento: manifest companion `aditivo_2026-04-24_fase2.md.sha256`
- Timestamp UTC: `2026-04-24T10:28:06Z`
- Retenção: conforme contrato técnico master
- Aditivo pai: `aditivo_2026-04-24_fase1.md` (UUID `0a2d9a26-90fa-45cd-b056-34ba5c31e294`)
- Correção anterior: `aditivo_2026-04-24_fase1_correcao_G3.md` (UUID `84a0f07b-95bd-4b98-8274-79f7c2d13982`) — commit `5bb67a4`
