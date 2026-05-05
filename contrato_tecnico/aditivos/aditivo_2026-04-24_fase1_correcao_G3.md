# Aditivo Técnico — 2026-04-24 — Correção G3
## Fase 1 — Correção de gap identificado

**UUID v4:** `84a0f07b-95bd-4b98-8274-79f7c2d13982`
**SHA-256 deste arquivo:** ver `aditivo_2026-04-24_fase1_correcao_G3.md.sha256` (manifest companion)
**Timestamp UTC:** `2026-04-24T10:20:05Z`
**Autorizado por:** Marcos Costa (titular)
**Executado por:** Claude Code (agente local)
**Escopo:** estritamente o especificado na autorização do auditor — correção pontual de 1 constante.

---

## 1. Referência

- **Aditivo pai:** `aditivo_2026-04-24_fase1.md` (UUID `0a2d9a26-90fa-45cd-b056-34ba5c31e294`)
- **Gap tratado:** G3 — "Constante TRIBUNAIS_SEM_DADOS_DATAJUD empiricamente desmentida"
- **Severidade original:** ALTA
- **Regras de escopo seguidas:**
  - Apenas a linha 16 + comentário acima.
  - Nada mais alterado no arquivo.
  - Sem PR, sem push — apenas commit local.
  - Sem testes novos (reservado para Fase 5).

---

## 2. Diff aplicado

**Arquivo:** `server/services/estoque_datajud.ts`

```diff
@@ -10,10 +10,13 @@ if (!DATAJUD_API_KEY) {
 const CLASSE_PRECATORIO = 1265;
 const CLASSE_RPV = 1266;

-// Tribunais confirmados sem dados de precatórios/RPV no DataJud (classes 1265/1266)
-// Verificado em 29/03/2026 — HTTP 200 com total.value=0 — problema na fonte (CNJ)
-// Não tentar fallback automático — registrar como PARCIAL_FONTE no summary
-export const TRIBUNAIS_SEM_DADOS_DATAJUD = ["trf1", "trf2", "trf5"] as const;
+// Constante mantida por compatibilidade, porém esvaziada.
+// Testes empíricos em 23/04/2026 e 12/04/2026 comprovaram
+// que TRF1 retorna dados via DataJud. TRF2 e TRF5 precisam
+// ser revalidados individualmente antes de reinserir nesta
+// lista. Até lá, assume-se disponibilidade (fail-open).
+// Ref: aditivo_2026-04-24_fase1.md achado G3.
+export const TRIBUNAIS_SEM_DADOS_DATAJUD: string[] = [];

 export const TRIBUNAIS_FEDERAIS: { alias: string; nome: string }[] = [
   { alias: "trf1", nome: "Tribunal Regional Federal da 1ª Região" },
```

**Resumo:** 1 arquivo modificado · 7 inserções · 4 deleções.

---

## 3. Justificativa

A constante bloqueava, em L645-657 de `estoque_datajud.ts`, toda consulta a `buscarCNJPorPrecatorio` para `tribunal_alias ∈ {trf1, trf2, trf5}` — retornava vazio com `metodo: "datajud_indisponivel"` **antes mesmo de realizar o POST** à API.

Evidências empíricas que desmentiram a premissa original (de 29/03/2026):

| Data | Consulta | Resultado |
|---|---|---|
| 12/04/2026 | TRF1 Processual por CNPJ INCRA (`00375972000160`) | 407 processos retornados (61 PRC + 346 RPV) |
| 23/04/2026 | DataJud `/api_publica_trf1/_search` com CNJ Santa Casa (20 dígitos puros) | 2 hits + 117 movimentos |

A premissa de 29/03 pode ter sido verdadeira naquela data ou pode ter resultado de query mal formatada (ex: CNJ com pontuação). Em ambos os casos, foi superada pela evidência posterior.

**Decisão defensiva:** fail-open com array vazio em vez de remover a constante. Motivos:
1. Preserva o símbolo `export const TRIBUNAIS_SEM_DADOS_DATAJUD` para quem importa de fora.
2. Permite reinserção TRF2/TRF5 caso testes empíricos futuros reconfirmem indisponibilidade — sem novo refactor.
3. `.includes(tribunal_alias)` com array vazio é o comportamento correto (sempre `false` → prossegue para API).

---

## 4. Validação de tipos (typecheck)

Comando executado: `npm run check` (equivale a `tsc`).

**Resultado:** zero erros em `server/services/estoque_datajud.ts`.

Erros pré-existentes em outros arquivos (`billing_auraloa.ts`, `kyc_nda.ts`, `due_diligence_viewer.ts`, `consolidador.ts`, `revisor_extracao.ts`, `routes_lote.ts`) **não foram introduzidos nem afetados por esta correção** — são gaps anteriores, fora do escopo G3.

**Verificação:**
```
npm run check 2>&1 | grep "estoque_datajud"
→ (sem output) = CLEAN
```

Mudança de tipo `readonly ["trf1", "trf2", "trf5"]` (literais via `as const`) → `string[] = []` **é retrocompatível** com o único uso em L645:

```typescript
if ((TRIBUNAIS_SEM_DADOS_DATAJUD as readonly string[]).includes(tribunal_alias)) { ... }
```

O cast para `readonly string[]` continua válido — `string[]` é atribuível a `readonly string[]`.

---

## 5. Commit local

| Item | Valor |
|---|---|
| Branch | `feat/v2-pipeline-freemium` |
| Commit SHA (short) | **`5bb67a4`** |
| Mensagem | `fix(datajud): empty false-negative list for TRF1 (fase1 G3)` |
| Arquivos alterados | 1 (`server/services/estoque_datajud.ts`) |
| Linhas +/- | +7 / -4 |
| Push? | ❌ Não (regra do auditor) |
| PR aberto? | ❌ Não (regra do auditor) |

---

## 6. Impacto esperado

### Imediato
Qualquer chamada subsequente a `buscarCNJPorPrecatorio` para TRF1 agora **prossegue para a API DataJud** em vez de curto-circuitar com `datajud_indisponivel`.

### Retroativo (dados já gerados)
Registros existentes em `LOA_FULL_CONCILIADO.csv` marcados como sem match por conta dessa constante **continuam marcados** — este fix é prospectivo. Se quisermos re-enriquecer, é necessário nova execução do pipeline (fica para fase subsequente, fora do escopo G3).

### Não impacta
- Cadeia de custódia (continua registrada via EvidencePack).
- Retry/timeout (gap G6 permanece aberto).
- Audit log em banco (gap G1 permanece aberto).
- Enriquecimento via TRF1 Processual (gap G2 permanece aberto — não tocado nesta correção).

---

## 7. Ressalva do auditor — reforço incorporado

O auditor registrou em sua aprovação:

> "Em `estoque_datajud.ts` a cadeia de custódia está ✅ para ARQUIVO, mas ⚠️ para AUDITORIA CONSULTÁVEL. EvidencePack grava em arquivo, não em banco indexável. Para due diligence forense escalável precisa ambos. Achado G1 já cobre isso — apenas reforçando o critério para decisões futuras: 'arquivo ≠ banco' para auditoria."

Este aditivo **não trata** G1 (centralização em DB). Registra a ressalva aqui para que qualquer leitor futuro desta correção entenda que a cadeia de custódia atual permanece em arquivo — a correção G3 não mudou isso.

---

## 8. Próximo passo autorizado

Após este aditivo, **Fase 2** inicia automaticamente conforme autorização — leitura de:

1. `server/scripts/robo_pje/drivers/trf1.cjs`
2. `server/scripts/robo_pje/parser.cjs`
3. `server/v2/evidence_pack.ts`

Entregável Fase 2: `aditivo_2026-04-24_fase2.md` + manifest SHA-256 separado.

---

**Confidencialidade & Traceability**
- UUID: `84a0f07b-95bd-4b98-8274-79f7c2d13982`
- SHA-256 deste documento: arquivo manifest companion `aditivo_2026-04-24_fase1_correcao_G3.md.sha256`
- Timestamp UTC: `2026-04-24T10:20:05Z`
- Retenção: conforme contrato técnico master
- Aditivo pai: `aditivo_2026-04-24_fase1.md` (UUID `0a2d9a26-90fa-45cd-b056-34ba5c31e294`)
- Git commit local: `5bb67a4` (branch `feat/v2-pipeline-freemium`)
