# Aditivo Técnico — 2026-04-24 — Fase 1
## Inventário de Coleta Real — TRF1 (baseline)

**UUID v4:** `0a2d9a26-90fa-45cd-b056-34ba5c31e294`
**SHA-256 deste arquivo:** ver arquivo `aditivo_2026-04-24_fase1.md.sha256` ao lado (padrão manifest — hash não é embutido no próprio documento para evitar auto-referência)
**Timestamp UTC:** `2026-04-24T10:08:57Z`
**Autorizado por:** Marcos Costa (titular)
**Executado por:** Claude Code (agente local)
**Regra de execução:** apenas leitura — nenhum script executado, nenhum dado alterado.

---

## 0. Escopo e método

Mapeamento de 4 artefatos de coleta relacionados a TRF1 conforme solicitação do auditor:

1. `server/services/estoque_datajud.ts`
2. `server/scripts/robo_pje/index.cjs`
3. `enriquecer_precatorio_cnpj.cjs` (raiz)
4. `C:/Temp/gerar_full.py`

Para cada artefato preencheu-se:
- **A.** Endpoint e método
- **B.** Persistência
- **C.** Cadeia de custódia (SHA-256, timestamp, HTTP status, URL)
- **D.** Tratamento de erro (retry, captcha, timeout, sessão)
- **E.** Deduplicação

Marcações: ✅ implementado · ⚠️ parcial · ❌ ausente · `INDETERMINADO` (não inferível sem ler outro arquivo).

---

## 1. `server/services/estoque_datajud.ts` (887 linhas)

### A. Endpoint e método
- **Base URL:** `https://api-publica.datajud.cnj.jus.br` (linha 4)
- **Endpoint padrão:** `/api_publica_{tribunal_alias}/_search` — gerado em 3 funções (`fetchEstoqueFromDataJud` L225, `consultarTribunal` L463, `buscarCNJPorPrecatorio` L660)
- **Método:** `POST` com corpo Elasticsearch JSON
- **Autenticação:** header `Authorization: APIKey ${DATAJUD_API_KEY}` (env var, obrigatória — L6-8 throw se ausente)
- **Content-Type:** `application/json`

**Observação específica TRF1** — DataJud indexa `numeroProcesso` como 20 dígitos SEM pontuação. Pontuado retorna 0 hits (L464-467, validado empiricamente 23/04/2026). Implementado em L468: `numeroCNJNorm.replace(/\D/g, "")`.

**Observação histórica (linha 16):** `TRIBUNAIS_SEM_DADOS_DATAJUD = ["trf1", "trf2", "trf5"]` — esta constante foi mantida mas está em conflito com testes empíricos posteriores que provaram TRF1 funcional. **Gap de integridade documental.**

### B. Persistência
- **PostgreSQL:** ❌ **NÃO grava em nenhuma tabela.** Não chama `query()`, não usa `pg`, não grava em `v2_audit_log`.
- **Arquivo via EvidencePack:**
  - `evidencePack.saveRawPayload(rawFilename, rawText)` → retorna `{sha256, path, bytes}` (L276)
  - Filename: `datajud_{tribunal_alias}_page{N}.json` (L275)
  - Log textual: `evidencePack.log(...)` (L235, 256, 297, 316, 340)
- **Retorno da função:** estrutura `{processos, summary, evidences}` em memória — quem chama decide persistir.

### C. Cadeia de custódia
| Item | Status | Detalhe |
|---|---|---|
| SHA-256 do payload de resposta | ✅ | `saveRawPayload` retorna `sha256` (L276) usado em `evidences.raw_payload_sha256` (L281) |
| SHA-256 adicional (buscar CNJ) | ✅ | `crypto.createHash("sha256")` explícito em L502, 579, 640, 646, 766, 779, 818, 869, 883 |
| Timestamp ISO UTC | ✅ | `captured_at_iso = new Date().toISOString()` (L252) + `consultado_em` (L540) + `timestamp` (L635) |
| URL exata | ✅ | Gravada em `source_url: endpoint` dentro de `evidences` (L279) |
| HTTP status | ⚠️ | Verificado com `response.ok` (L254, 484, 705, 817) — gravado em **log textual** (L256) e em `observacoes` do summary (L268), **não em campo estruturado separado** |

### D. Tratamento de erro
| Cenário | Status | Detalhe |
|---|---|---|
| Retry | ❌ | Nenhum retry implementado. Falha → retorna summary `status: ERRO`. |
| Timeout | ⚠️ | `AbortSignal.timeout(15000)` em `fetchEstoqueFromDataJud` (L249) e `buscarCNJPorPrecatorio` (L702, 814). **Removido** em `consultarTribunal` (L475-482, fetch sem signal). |
| HTTP 5xx | ⚠️ | Detectado por `response.ok`, logado, **sem retry**. |
| Captcha | N/A | API REST — não se aplica. |
| Sessão expirada | N/A | API stateless com API Key. |
| Catch global | ✅ | `try/catch` retornando summary ERRO (L339-356, 778-782, 882-886). |

### E. Deduplicação
| Tipo | Status | Detalhe |
|---|---|---|
| Mesmo CNJ, múltiplos hits no mesmo índice (G1+G2) | ⚠️ | `hits.sort` por número de movimentos e pega o primeiro (L499-500). Estratégia conservadora, mas **não dedup formal** — os outros hits são descartados sem log. |
| Mesmo CNJ em múltiplos tribunais | ⚠️ | `buscarCNJPorPrecatorio` consulta em paralelo (L554-557), retorna o **primeiro** `encontrado=true` (L560). Demais resultados descartados. |
| Mesmo arquivo/request repetido | ❌ | Não verifica cache nem histórico. |

---

## 2. `server/scripts/robo_pje/index.cjs` (149 linhas) + drivers (INDETERMINADO)

### A. Endpoint e método
- **Arquitetura:** orquestrador delega a drivers por tribunal (L18-27).
- **TRF1:** driver em `./drivers/trf1.cjs` — **status "ATIVO"** (L19).
- **Demais (TRF2-6, STF, STJ):** status "PENDENTE" (L20-26) — bloqueiam execução com mensagem de erro (L64-71).
- **Método real de coleta:** Playwright (importado nos drivers — não no index). URL e seletores estão **em `trf1.cjs` (não lido nesta fase)**.

### B. Persistência
- **PostgreSQL:** ❌ Não grava.
- **Arquivo:** `C:/Temp/auraloa-saida/robo_pje_resultado.json` (L143) — **sobrescreve a cada execução** (sem nome com timestamp).
- **Screenshot:** `C:/Temp/robo_pje_resultado.png` (L133).
- **Output também é retornado** via `module.exports.consultarProcesso` (L149).

### C. Cadeia de custódia
| Item | Status | Detalhe |
|---|---|---|
| SHA-256 | ❌ | Não calcula nada no orquestrador. `INDETERMINADO` no driver. |
| Timestamp UTC | ❌ | Não grava no orquestrador. `INDETERMINADO` no driver. |
| URL exata | `INDETERMINADO` | URL real está hardcoded no driver. |
| HTTP status | N/A | Playwright não expõe status como API REST. |

### D. Tratamento de erro
| Cenário | Status | Detalhe |
|---|---|---|
| Retry | ❌ | Nenhum no orquestrador. `INDETERMINADO` no driver. |
| Timeout | ⚠️ | Passa `timeout: options.timeout \|\| 30000` ao driver (L80). Comportamento do driver ao timeout é `INDETERMINADO`. |
| Captcha | `INDETERMINADO` | Probabilidade alta — TRF1 tem Cloudflare. Depende do driver. |
| Sessão | `INDETERMINADO` | Depende do driver. |

### E. Deduplicação
- ❌ **Ausente.** Orquestrador não checa histórico, não reconcilia com outras fontes. Cada chamada é independente.

**Nota para Fase 2:** a leitura de `server/scripts/robo_pje/drivers/trf1.cjs` é obrigatória para fechar os `INDETERMINADO` acima. Os 3890 bytes de `parser.cjs` também devem ser lidos.

---

## 3. `enriquecer_precatorio_cnpj.cjs` (137 linhas, raiz do projeto)

### A. Endpoint e método
- **URL:** `https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1` (L18, hardcoded)
- **Método:** Playwright com `headless: false` (L27) — **obrigatório por causa do Cloudflare ativo no TRF1 desde 04/2026**.
- **Sem autenticação** (consulta pública).
- **Fluxo:** fill input → click enviar → click na entidade → paginação da tabela.

### B. Persistência
- **PostgreSQL:** ❌ Não grava.
- **CSV:** `C:/Temp/auraloa-saida/enriquecimento/{NOME}_processos_trf1.csv` (L113-116)
  - Separador: `;`
  - Schema: `numero_processo;processo_originario;pagina`
- **Screenshot:** `{OUT_DIR}{NOME}_lista.png` (L57)

### C. Cadeia de custódia
| Item | Status | Detalhe |
|---|---|---|
| SHA-256 | ❌ | Não calcula. |
| Timestamp UTC | ❌ | Não grava. Nem no CSV nem em filename. |
| URL exata | ⚠️ | Constante no código (L18), **não registrada por linha** extraída. |
| HTTP status | N/A | Playwright, não expõe status como REST. |

### D. Tratamento de erro
| Cenário | Status | Detalhe |
|---|---|---|
| Retry | ❌ | Nenhum. Falha → fatal (L136 `catch → process.exit(1)`). |
| Timeout | ⚠️ | `timeout: 60000` na navegação (L33), `waitFor({timeout: 10000})` no link (L44). `waitForTimeout(2000/3000/4000/5000)` fixos entre passos — **frágil**. |
| Captcha | ❌ | Assume que `headless:false` contorna. **Sem detecção, sem alerta, sem fallback.** |
| Sessão expirada | ❌ | Sem tratamento. |
| Fallback parcial | ⚠️ | Se link da entidade não encontrar, tenta clicar no primeiro link da tabela (L51-54) — pode coletar entidade errada sem avisar. |

### E. Deduplicação
- ❌ **Completamente ausente.** 
  - Não checa se CNPJ já foi consultado antes.
  - Não deduplica linhas da tabela entre páginas.
  - Sobrescreve o CSV existente sem backup.

**Severidade:** este é o script que extraiu os 407 processos INCRA + 2.397 SUFRAMA + 10.736 totais. Toda conciliação CNJ × LOA depende deste output. A ausência de SHA-256, timestamp e dedup é **gap alto** para audit trail.

---

## 4. `C:/Temp/gerar_full.py` (175 linhas)

### A. Endpoint e método
- **N/A — script offline.**
- Lê 2 CSVs: `LOA_CONCILIACAO_COMPLETA.csv` (conciliação anterior) e `SIOP_2026_ACIMA_1M.csv`.
- Não faz rede.

### B. Persistência
- **CSV:** `C:/Temp/auraloa-saida/conciliacao/LOA_FULL_CONCILIADO.csv` (L15)
- **Console:** relatório textual (L145-172) — **não persistido em arquivo**.
- **PostgreSQL:** ❌ Não grava.

### C. Cadeia de custódia
| Item | Status | Detalhe |
|---|---|---|
| SHA-256 | ❌ | Não calcula do output, nem dos inputs. |
| Timestamp UTC | ❌ | Não grava nem no CSV nem em filename. |
| URL exata | N/A | Script offline. |
| HTTP status | N/A | Offline. |
| Log de qual input foi lido | ⚠️ | `print` em L20, 25 mostra total de linhas — **não persistido**. |

### D. Tratamento de erro
- Script offline, matching determinístico. Categorias de erro relevantes:
  - `parse_valor` retorna 0 silenciosamente em falha (L73) — **pode mascarar dados corrompidos**.
  - Se CSV input não existir, falha com traceback — não graceful.
  - Sem retry (irrelevante em script offline determinístico).

### E. Deduplicação
| Tipo | Status | Detalhe |
|---|---|---|
| LOA × SIOP (same UO+valor) | ⚠️ | Pega o "melhor" candidato por score combinado (diff de valor + tipo). Descarta os demais sem log — **não loga quem foi descartado**. |
| LOA duplicada na entrada | ❌ | Confia que o CSV de entrada já está limpo. |
| Versionamento do output | ❌ | Sobrescreve `LOA_FULL_CONCILIADO.csv` sem backup. |

---

## 5. Tabela de Conformidade Real — TRF1 (7 critérios × 4 artefatos)

| # | Critério | estoque_datajud | robo_pje/index | enriquecer_cnpj | gerar_full |
|---|---|---|---|---|---|
| 1 | Endpoint correto | ✅ DataJud TRF1 | ⚠️ delega driver | ✅ TRF1 processual | N/A offline |
| 2 | Método coleta | ✅ API-first | ✅ Playwright | ⚠️ Playwright headless:false | N/A offline |
| 3 | Cadeia de custódia (SHA-256 + timestamp + URL + HTTP) | ✅ completa | ❌ ausente | ❌ ausente | ❌ ausente |
| 4 | Normalização schema | ✅ parseHitToProcesso | `INDETERMINADO` driver | ⚠️ 3 colunas CSV | ✅ 32 colunas FULL |
| 5 | Deduplicação | ⚠️ parcial (sort+pick) | ❌ ausente | ❌ ausente | ⚠️ pick best sem log |
| 6 | Retry/erro | ❌ sem retry | `INDETERMINADO` driver | ❌ sem retry | ❌ parse_valor silencioso |
| 7 | Logs auditáveis | ⚠️ EvidencePack (arquivo, não DB) | ❌ JSON único sobrescrito | ❌ sem log | ❌ só console |

---

## 6. Gaps identificados

| ID | Severidade | Gap | Ação proposta | Prazo |
|---|---|---|---|---|
| G1 | **CRÍTICO** | Nenhum dos 4 artefatos grava em `v2_audit_log`. A tabela existe mas só o pipeline V2 Freemium usa. | Decidir: (a) conectar os 4 artefatos ao `v2_audit_log`, ou (b) criar tabela separada `coleta_externa_log` para coleta massiva. | Antes de replicar para TRF2-6 |
| G2 | **CRÍTICO** | `enriquecer_precatorio_cnpj.cjs` — o script que produziu 10.736 processos — não tem SHA-256, timestamp, nem dedup. Não há audit trail. | Reescrever com EvidencePack ou wrapper que calcule hash do CSV gerado + log JSON com `consultado_em` + `cnpj`. | Alta |
| G3 | ALTA | `TRIBUNAIS_SEM_DADOS_DATAJUD = ["trf1", "trf2", "trf5"]` (linha 16 do estoque_datajud) está documentalmente **desmentido** pelo teste empírico de 23/04/2026. Constante mentirosa. | Corrigir para `[]` ou apenas os tribunais que testes empíricos comprovem sem dados. Atualizar comentário. | Imediata |
| G4 | ALTA | `robo_pje/drivers/trf1.cjs` não foi auditado nesta Fase 1. Os critérios C/D/E ficam `INDETERMINADO`. | Incluir na Fase 2 (leitura do driver e do `parser.cjs`). | Fase 2 |
| G5 | ALTA | `gerar_full.py` descarta candidatos alternativos sem log. Se um match "melhor" estava errado, não há rastro dos alternativos. | Adicionar coluna `siop_candidatos_descartados_json` (até 3 alternativos). | Média |
| G6 | MÉDIA | Nenhum script implementa retry. Em produção com Cloudflare/rate-limit, falhas transitórias ficam como falhas definitivas. | Adicionar wrapper `retryable()` com 3 tentativas + backoff exponencial. | Média |
| G7 | MÉDIA | Nenhum script implementa deduplicação cross-fonte. Mesmo CNJ coletado por DataJud + TRF1 processual + PJe gera 3 registros independentes sem reconciliação. | Criar tabela `coleta_cnj_reconciliada` com UNIQUE(cnj) + colunas source_*_sha256. | Média |
| G8 | BAIXA | `estoque_datajud` loga HTTP status só em texto, não em campo estruturado. Dificulta query analítica. | Adicionar coluna `http_status INTEGER` quando migrar para DB. | Baixa |
| G9 | BAIXA | Scripts sobrescrevem outputs sem backup versionado. | Adicionar timestamp ao filename ou `.bkp-{timestamp}` antes de sobrescrever. | Baixa |

---

## 7. Decisão — TRF1 pronto para servir de gabarito para TRF2-TRF6?

- [ ] SIM — prosseguir com replicação
- [x] **NÃO** — fechar gaps antes
- [ ] PARCIAL

### Justificativa

TRF1 **funciona empiricamente** (DataJud 23/04, 407 INCRA 12/04, Santa Casa 13/04), mas **não atende 7/7 critérios** de conformidade auditável:

- **Único artefato com cadeia de custódia parcial:** `estoque_datajud.ts`.
- **Artefato de maior volume** (enriquecer_precatorio_cnpj.cjs, 10.736 processos) **é o mais frágil** — sem SHA-256, sem timestamp, sem dedup.
- **Audit log centralizado inexistente** — cada script persiste em CSV/JSON/arquivo próprio.
- **Driver PJe TRF1 não foi auditado** (arquivo `drivers/trf1.cjs` pendente de leitura).

Replicar este padrão para TRF2-6 **multiplicaria os gaps**, não os resolveria.

---

## 8. Próximos passos

1. **Fase 2 (antes da replicação):** ler `server/scripts/robo_pje/drivers/trf1.cjs` + `parser.cjs` + `server/v2/evidence_pack.ts` (usado por `estoque_datajud`).
2. **Fase 3:** decidir G1 (centralização de log) com Marcos — via `v2_audit_log` existente ou tabela nova.
3. **Fase 4:** corrigir G3 (constante TRIBUNAIS_SEM_DADOS_DATAJUD) — mudança pontual e óbvia.
4. **Fase 5:** retrofit de SHA-256 + timestamp em `enriquecer_precatorio_cnpj.cjs` (G2).
5. **Fase 6:** só então replicar o padrão corrigido para TRF2-6.

**Próxima fase recomendada:** **Fase 2 — leitura do driver PJe TRF1 e parser**, para fechar os `INDETERMINADO` do artefato 2. Sem isso, a matriz de conformidade fica com lacunas que impedem decisão final sobre replicação.

---

## 9. Divergências relevantes do prompt do auditor

Durante a leitura, foram identificadas **3 divergências** que o auditor precisa saber antes de emitir decisão final:

1. **Volume esperado da integração TRF1.** O auditor pediu "integração TRF1". Na prática, TRF1 é coletado por **3 caminhos distintos não reconciliados**: DataJud (estoque_datajud.ts), TRF1 processual por CNPJ (enriquecer), PJe 1g (robo_pje). Cada um produz output em formato diferente, sem chave comum robusta além do CNJ.

2. **Tabela `v2_audit_log`.** Existe mas só é usada pelo pipeline V2 Freemium (upload PDF → Haiku). **Não tem registro algum** das 10.736 coletas históricas TRF1. Qualquer SELECT sobre ela retornaria zero referente a TRF1 em massa — é por isso que o prompt anterior (4 SELECTs) foi abortado.

3. **Constante `TRIBUNAIS_SEM_DADOS_DATAJUD = ["trf1", "trf2", "trf5"]`** em `estoque_datajud.ts` linha 16 está **empiricamente desmentida** (G3). Código de produção ainda lê essa constante em L645-657 — qualquer chamada a `buscarCNJPorPrecatorio` para TRF1 cai na cláusula `tribunal_sem_dados_datajud` e retorna vazio **antes mesmo de consultar a API**. Esta é provavelmente a causa real de muitos "sem match" no FULL.

---

**Confidencialidade & Traceability**
- UUID: `0a2d9a26-90fa-45cd-b056-34ba5c31e294`
- SHA-256 deste documento: em arquivo manifest companion `aditivo_2026-04-24_fase1.md.sha256`
- Timestamp UTC: `2026-04-24T10:08:57Z`
- Retenção: conforme contrato técnico master
