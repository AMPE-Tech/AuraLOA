# Aditivo Técnico — 2026-04-24 — Correção G12
## Fase 2.5 — Backup automático em EvidencePack antes da Fase 3

**UUID v4:** `dbdd12d5-a2d2-47e0-8314-b878e90c5c4e`
**SHA-256 deste arquivo:** ver `aditivo_2026-04-24_fase2_5_correcao_G12.md.sha256` (manifest companion)
**Timestamp UTC:** `2026-04-24T10:46:40Z`
**Autorizado por:** Marcos Costa (titular)
**Executado por:** Claude Code (agente local)
**Escopo:** estritamente o especificado na autorização do auditor — blindar EvidencePack antes de chamadas em massa na Fase 3.

---

## 1. Referência

- **Aditivo pai imediato:** `aditivo_2026-04-24_fase2.md` (UUID `396bed76-1d11-4264-b33c-cca943bb0d58`)
- **Gap tratado:** G12 — "EvidencePack.saveResponse e saveRequest sobrescrevem sem backup"
- **Severidade original:** ALTA
- **Por que ANTES da Fase 3:** Fase 3 integrará driver TRF1 + `enriquecer_precatorio_cnpj` ao EvidencePack. Sem G12 resolvido, re-enriquecimento dos 192 processos ≥ R$10M poderia perder evidência durante o próprio retrofit.

---

## 2. Diff aplicado

**Arquivo:** `server/services/evidence_pack.ts`

```diff
@@ -24,6 +24,18 @@ export class EvidencePack {
     }
   }

+  // Backup automático antes de sobrescrever (fase2.5 G12).
+  // Evita perda silenciosa de evidência quando o mesmo processId
+  // é usado em 2+ execuções. Ref: aditivo_2026-04-24_fase2.md G12.
+  private backupIfExists(filePath: string): void {
+    if (fs.existsSync(filePath)) {
+      const ts = new Date().toISOString().replace(/[:.]/g, "-");
+      const bkpPath = `${filePath}.${ts}.bkp`;
+      fs.renameSync(filePath, bkpPath);
+      this.log(`backup: ${path.basename(filePath)} -> ${path.basename(bkpPath)}`);
+    }
+  }
+
   log(message: string) {
     const ts = new Date().toISOString();
     const line = `${ts} ${message}`;
@@ -33,12 +45,14 @@ export class EvidencePack {

   saveRequest(data: any) {
     const filePath = path.join(this.basePath, "request.json");
+    this.backupIfExists(filePath);
     fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
     this.log(`saved request.json`);
   }

   saveResponse(data: any): string {
     const filePath = path.join(this.basePath, "response.json");
+    this.backupIfExists(filePath);
     const content = JSON.stringify(data, null, 2);
     fs.writeFileSync(filePath, content, "utf-8");
     const hash = computeSHA256(content);
```

**Resumo:** 1 arquivo · **+14 / −0** linhas. Zero remoção. Puramente aditivo.

---

## 3. Justificativa técnica detalhada

### Comportamento antes

`saveRequest(data)` e `saveResponse(data)`:

```typescript
const filePath = path.join(this.basePath, "request.json");
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
```

`fs.writeFileSync` **sobrescreve sem aviso** se o arquivo existir. Se um `processId` for reutilizado (deliberadamente ou por coincidência de hash curto), a chamada 2ª apaga a evidência da 1ª silenciosamente.

### Comportamento depois

Antes do `writeFileSync`, chama `this.backupIfExists(filePath)`:

1. Se o arquivo não existe → no-op (sem custo).
2. Se existe → renomeia para `{file}.{ISO-ts}.bkp`, gera linha no `run.log` registrando o evento.
3. `writeFileSync` prossegue normal.

### Por que timestamp com `:` e `.` substituídos

```typescript
const ts = new Date().toISOString().replace(/[:.]/g, "-");
// ex: "2026-04-24T10:46:40.123Z" → "2026-04-24T10-46-40-123Z"
```

**Motivo:** NTFS (Windows) não aceita `:` em nomes de arquivo. `.` é permitido mas quebra parsers quando houver múltiplas extensões. Substituir ambos por `-` garante portabilidade entre Windows/Linux/macOS.

### Por que NÃO mexer em `saveRawPayload`, `saveHashes`, `saveLog`

- **`saveRawPayload`**: o filename é passado pelo chamador — cada payload tem nome único lógico (`datajud_trf1_page0.json`, `datajud_trf1_page1.json`, etc.). Colisão real é detectada como G15 (severidade BAIXA), tratada em fase posterior.
- **`saveHashes`**: chamada UMA vez no fechamento do pack — não há cenário de sobrescrita com pack ativo.
- **`saveLog`**: idem — chamada final; o log é cumulativo em memória até o momento da escrita.

Limitar o escopo a `saveRequest`/`saveResponse` respeita estritamente a ordem do auditor ("não mexer em mais nada") e reduz risco de regressão.

---

## 4. Validação de tipos (typecheck)

Comando: `npm run check` (equivale a `tsc`).

**Resultado:** zero erros em `server/services/evidence_pack.ts`.

```
npm run check 2>&1 | grep "evidence_pack"
→ (sem output) = CLEAN
```

Erros pré-existentes em outros arquivos (billing, kyc, due_diligence_viewer, consolidador, revisor_extracao, routes_lote) **não foram introduzidos nem afetados** por esta correção.

---

## 5. Commit local

| Item | Valor |
|---|---|
| Branch | `feat/v2-pipeline-freemium` |
| Commit SHA (short) | **`5227023`** |
| Mensagem | `fix(evidence_pack): backup on overwrite for request/response (fase2.5 G12)` |
| Arquivos alterados | 1 (`server/services/evidence_pack.ts`) |
| Linhas +/− | +14 / 0 |
| Push? | ❌ Não |
| PR aberto? | ❌ Não |

---

## 6. Impacto esperado

### Prospectivo (chamadas futuras)
- Qualquer execução repetida de `saveRequest` / `saveResponse` com o mesmo `processId` agora **preserva as evidências anteriores** em arquivos `.bkp` com timestamp.
- Log (`run.log`) registra cada backup com linha `backup: request.json -> request.json.{ts}.bkp`.

### Retroativo (packs já gerados)
- **Nenhuma alteração.** Packs existentes em `Saida/evidence/*` não são afetados. Este fix é prospectivo.

### Custo operacional
- Disco: linear no número de reexecuções. Cada re-enriquecimento dos 192 processos ≥ R$10M geraria no máximo 192 pares `.bkp` adicionais (≤ 50 KB cada) — irrelevante.
- Desempenho: `fs.existsSync` é O(1) local, imperceptível.

### Não impacta
- G1 (persistência em DB) — continua aberto.
- G10 (integração driver ↔ EvidencePack) — fica para Fase 3.
- G13, G14, G15, G16 — continuam abertos.
- Outros scripts que **não usam** EvidencePack hoje (driver TRF1, enriquecer_cnpj, robo_pje/index, gerar_full) — continuam sem cadeia de custódia até Fase 3.

---

## 7. Conformidade com regras Fase 2.5

| Regra do auditor | Cumprida |
|---|---|
| APENAS `server/services/evidence_pack.ts` | ✅ 1 arquivo |
| Não mexer em `saveRawPayload` | ✅ intacto |
| Não mexer em `saveHashes` | ✅ intacto |
| Não mexer em `saveLog` | ✅ intacto |
| Typecheck antes do commit | ✅ executado, limpo |
| Commit isolado com mensagem exata | ✅ `5227023` |
| Não abrir PR / push | ✅ apenas local |
| Aditivo + manifest SHA-256 | ✅ este documento + `.sha256` companion |

---

## 8. Próxima fase autorizada

Após este aditivo: **Fase 3 — Retrofit driver TRF1 + enriquecer_cnpj ↔ EvidencePack.**

Regras da Fase 3 já documentadas no prompt do auditor. Pontos críticos a endereçar primeiro:

1. **3.1 — Compatibilidade CJS × ESM**: confirmar como consumir `EvidencePack` (TS/ESM) a partir dos `.cjs` (CommonJS). Caminhos A (compilar/wrapper) vs B (converter scripts). Reportar achado antes de prosseguir para 3.2.
2. Se inviável, PARAR e reportar.

---

**Confidencialidade & Traceability**
- UUID: `dbdd12d5-a2d2-47e0-8314-b878e90c5c4e`
- SHA-256 deste documento: arquivo manifest companion `aditivo_2026-04-24_fase2_5_correcao_G12.md.sha256`
- Timestamp UTC: `2026-04-24T10:46:40Z`
- Retenção: conforme contrato técnico master
- Aditivo pai: `aditivo_2026-04-24_fase2.md` (UUID `396bed76-1d11-4264-b33c-cca943bb0d58`)
- Git commit local: `5227023` (branch `feat/v2-pipeline-freemium`)
- Commits anteriores relacionados: `5bb67a4` (G3)
