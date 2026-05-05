# Aditivo Técnico — Fase 4
## Diagnóstico G17 — anti-bot detection no PJe 1g TRF1

**UUID v4:** `c9734d7f-f583-4bc3-8d9f-2935d4c3053d`
**SHA-256 deste arquivo:** ver `aditivo_2026-04-24_fase4.md.sha256` (manifest companion)
**Timestamp UTC:** `2026-04-27T04:59:26Z`
**Autorizado por:** Marcos Costa (titular)
**Executado por:** Claude Code (agente local)
**Escopo:** estritamente diagnóstico do gap G17 levantado no aditivo Fase 3. Nenhum código alterado.

**Aditivo pai imediato:** `aditivo_2026-04-24_fase3.md` (UUID `4eec7d61-f0e1-4f39-b00c-8e45c05ec967`)
**Cadeia de aditivos:** F1 → G3 → F2 → G12 → F3 → **F4 (este)**

---

## 1. Hipóteses prévias (Fase 3)

Levantadas no §2 G17 do aditivo Fase 3 quando o teste piloto com `headless:true` retornou "não encontrado" para CNJ que DataJud confirma existir:

1. Modo `headless: true` está sendo detectado/bloqueado
2. Seletor PJe pode ter mudado
3. Cloudflare retornou HTML genérico sem indicar bloqueio explícito

---

## 2. Procedimento de teste

**CNJ pilotado (mesmo do teste anterior):** `1061297-10.2020.4.01.3400` (Santa Casa PP — referência V2 que validou DataJud com 117 movimentos em 23/04/2026)

**Comando:** `node -e "trf1.consultarPorCNJ('1061297-10.2020.4.01.3400', { headless: false, timeout: 90000 })"`

**Único parâmetro alterado vs Fase 3:** `headless: false` (e `timeout` aumentado de 60s → 90s para acomodar abertura visível do browser).

**Tudo mais idêntico:** mesmo driver retrofitado da Fase 3 (commit `27f1335`), mesmo bundle `dist/lib/evidence_pack.cjs`, mesma cadeia de custódia, mesma máquina, mesma rede.

---

## 3. Resultado factual do teste

### 3.1 Comparação direta (mesmo CNJ)

| Etapa | `headless:true` (Fase 3) | `headless:false` (Fase 4) |
|---|---|---|
| Sistema antigo TRF1 — busca CNJ | "não encontrado" — body 752 bytes | "não encontrado" — body presumido similar |
| Sistema antigo — fallback engatilhado | ✅ | ✅ |
| PJe 1g — listagem do processo | ❌ **timeout 10s** no seletor `input[id*="processo"]` | ✅ **918 bytes** salvos em `pje1g_listagem_body.txt` |
| PJe 1g — link openPopUp detectado | (não chegou) | ✅ `onclick="openPopUp('Consulta pública','/.../listView.seam?ca=d32a4fbe...')"` |
| PJe 1g — navegação para detalhe | (não chegou) | ✅ navegou para popup URL |
| PJe 1g — body do detalhe | (não chegou) | ✅ **4112 bytes** salvos em `pje1g_detalhe_body.txt` |
| Processo encontrado | ❌ false | ✅ **true** |
| Classe extraída | — | "Judicial" |
| Movimentações extraídas | 0 | **35** |
| `_evidence.responseHash` | `1c254fcd…3573` | `6880d3e5…69dce` |

### 3.2 Cadeia de custódia íntegra em ambos os testes

Em ambos os runs:
- `request.json` salvo no início
- `response.json` com SHA-256 retornado por `saveResponse()`
- `run.log` com timeline ISO UTC completa
- Backup G12 não exercitado (processIds diferentes por timestamp)

**Conclusão da custódia:** EvidencePack registrou exatamente o que aconteceu nas duas execuções, incluindo a falha. Comportamento esperado de sistema de evidência.

---

## 4. Diagnóstico

### 4.1 Causa raiz confirmada — Hipótese 1

**Anti-bot detection no JSF/PJe 1g do TRF1.**

Quando o cliente Playwright roda com `headless: true`:
- A página de busca pública carrega
- Mas o **input do CNJ (`input[id*="processo"]`) não é renderizado no DOM** (ou é renderizado fora de `visible` por classe/CSS)
- Após 10s de `waitFor`, timeout
- Driver corretamente registra erro e segue para próxima etapa

Quando roda com `headless: false`:
- Mesma URL, mesmo navegador (Chromium), mesmo viewport, mesmo user-agent
- Página renderiza completamente
- Input aparece, fluxo completa

A configuração anti-detecção atual no driver (linhas 24-43 de `drivers/trf1.cjs`) **NÃO É SUFICIENTE**:
```javascript
args: [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-dev-shm-usage',
],
userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
viewport: { width: 1920, height: 1080 },
locale: 'pt-BR',
addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
```

O JSF do PJe TRF1 está detectando além desses sinais. Possibilidades:
- Verifica `window.chrome.runtime` (presente em headed, ausente em headless)
- Verifica plugins instalados (headless tem array vazio)
- Verifica tamanho/animação do mouse cursor
- Verifica WebGL renderer (headless usa SwiftShader)
- Verifica `Notification.permission` ou outras APIs

### 4.2 Hipóteses descartadas

- **Hipótese 2 (seletor mudou):** ❌ — com `headless: false` o seletor `input[id*="processo"]` funciona perfeitamente. Não houve mudança no front-end do PJe.
- **Hipótese 3 (Cloudflare):** ❌ — Cloudflare está no `processual.trf1.jus.br` (sistema antigo), não no `pje1g-consultapublica.trf1.jus.br`. O PJe não usa Cloudflare. O bloqueio é JSF nativo.

### 4.3 Achado colateral — sistema antigo TRF1 NÃO é regressão

O sistema antigo (`processual.trf1.jus.br/consultaProcessual/numeroProcesso.php`) retornou "processo não encontrado" para o CNJ Santa Casa **em ambos os modos** (`headless:true` E `headless:false`).

Isso **NÃO é falha do retrofit nem regressão**. É comportamento real do sistema antigo: ele cobre só **precatórios já expedidos (PRC)** — o CNJ Santa Casa está em fase de "Cumprimento de Sentença contra a Fazenda Pública" (classe 12078 conforme V2 23-24/04), ou seja, processo originário ainda **não tem precatório expedido**. Por isso só aparece no PJe 1g, não no sistema antigo.

Esse achado **valida a estratégia de fallback** implementada em `consultarPorCNJ` (sistema antigo → PJe 1g): cobre os dois universos (precatórios expedidos + processos em cumprimento).

### 4.4 Achado secundário — extração de partes vazia

Mesmo com `headless: false`, o teste retornou `partes: 0`. O regex em `consultarPJe1g` (linha 305 do driver retrofitado):

```javascript
const partesRegex = /(AUTOR|AUTORA|REQUERENTE|EXEQUENTE|IMPETRANTE|RÉU|RÉ|REQUERIDO|EXECUTADO|IMPETRADO)[:\s]+([^\n]+)/gi;
```

não encontrou matches no `detalheText` extraído da página de detalhe. Possíveis causas:
- Campo "Partes" no PJe usa estrutura HTML em vez de texto plano com label inline
- Página de detalhe pode ter abas (Movimentações, Partes, Documentos) e por padrão não exibe a aba "Partes"

Isso é **gap separado (G18)**, não causado pelo retrofit. Existe desde antes da Fase 3. **Esforço estimado:** análise dos 4112 bytes do `pje1g_detalhe_body.txt` salvo no pack para entender estrutura real.

---

## 5. Opções de mitigação para G17

### Opção 1 — Aceitar `headless: false` como padrão operacional

**Prós:**
- Já validado em produção (12/04/2026 — 407 processos INCRA extraídos com headless:false)
- Zero código novo
- Funciona hoje

**Contras:**
- Janela do Chromium fica aberta durante coleta
- Para 192 ou 10.736 processos em loop, UX é incomoda (mas operacional)
- Bloqueia a máquina para uso visual durante coleta

**Custo de implementação:** mudar default de `headless: true` para `headless: false` no `index.cjs` ou nas chamadas. ~5 minutos.

### Opção 2 — Reforçar anti-detecção e manter `headless: true`

**Estratégia:** adicionar mais sinais de "browser real" ao Playwright. Bibliotecas existentes:
- `playwright-extra` + `puppeteer-extra-plugin-stealth` (port para Playwright disponível)
- `playwright-stealth` (pacote npm)

**Prós:**
- Coleta sem janela visível (UX limpa)
- Possível execução em CI/cron sem display

**Contras:**
- Dependência nova no projeto (`playwright-extra` ~5MB, transitivas)
- Plugin stealth é em "luta contínua" com sites — pode quebrar de novo no próximo update do JSF
- Tempo de implementação e teste: 1-2h

### Opção 3 — Híbrido: tentar headless, fallback para headed

**Estratégia:** consultar primeiro com `headless:true`; se PJe retornar timeout em seletor, retomar a mesma consulta com `headless:false`.

**Prós:**
- Maximiza casos onde headless funciona (sistema antigo TRF1 deve aceitar headless)
- Headed só usado quando necessário

**Contras:**
- Dobra tempo no caso pior (timeout 10s + execução completa headed)
- Complexidade adicional no driver

---

## 6. Recomendação para G17

**Opção 1 (aceitar `headless: false`).** Razões:

1. **Pragmatismo operacional**: o método foi validado em 12/04/2026 com 407 processos. Mudar agora introduz risco sem ganho proporcional.
2. **Custo nulo**: ajuste é parâmetro padrão, não código novo.
3. **Princípio "USAR O QUE JÁ EXISTE"**: a documentação interna (memória `feedback_USAR_O_QUE_JA_EXISTE.md`, `MASTER.md` regra anti-regressão) reforça evitar mudanças não-essenciais em fluxo validado.
4. **Cloudflare no sistema antigo TRF1 também já exigia `headless: false`** (descoberto 04/2026) — o driver já PRESSUPÕE headed em produção.

**Ação proposta:** documentar essa decisão como parte da Fase 4 e mudar default operacional. **Não exige fix permanente** porque "fix" implica investir em corrida armamentista contra anti-bot.

---

## 7. Decisão sobre replicação para TRF2-TRF6

Após Fase 4 + decisão sobre G17, a matriz fica:

| Critério | Status TRF1 |
|---|---|
| Cadeia de custódia EvidencePack integrada | ✅ Fase 3 |
| Driver Playwright validado | ✅ desde 12/04/2026 |
| Estratégia headless documentada | ✅ Fase 4 (aceitar `headless: false`) |
| Fallback antigo→PJe 1g validado | ✅ Fase 3 + Fase 4 |
| PJe 2g coberto | ❌ G11 |
| Validação de extração de partes | ⚠️ G18 |

**TRF1 está pronto como gabarito DENTRO DOS LIMITES DE G11/G18 conhecidos.** Replicar para TRF2-6 herda esses limites — é aceitável se o auditor decidir que vale prosseguir com cobertura parcial e fechar G11/G18 depois.

**Esforço de replicação por TRF:**
- Cada TRF tem URL e seletores próprios (não basta copy-paste)
- Estimativa: 1-1,5h por TRF para identificar URLs PJe 1g, validar seletores, ajustar driver
- Total para TRF2-6: 5-7h

---

## 8. Gaps movimentados nesta Fase 4

| ID | Status anterior | Status agora |
|---|---|---|
| **G17** | ALTA, aberto | ✅ **DIAGNOSTICADO** — aceitar `headless: false` como padrão (sem fix) |
| **G18** (novo) | — | ⚠️ MÉDIA, aberto — extração de partes do PJe 1g retorna vazia mesmo em headed (regex pode não bater estrutura HTML) |

Gaps que permanecem abertos sem alteração: G1, G5, G6, G7, G11, G13, G14, G15, G16.

---

## 9. Conformidade com regras Fase 4

| Regra herdada | Cumprida |
|---|---|
| Apenas leitura/teste, sem modificar código | ✅ — único arquivo tocado foi a re-execução do driver retrofitado |
| Apenas 1 teste piloto | ✅ — 1 CNJ Santa Casa |
| Reportar achados antes de prosseguir | ✅ — este aditivo |
| Aditivo + manifest SHA-256 | ✅ |
| Sem push, sem novos commits | ✅ — Fase 4 é diagnóstica, sem alteração de código |

---

## 10. Próximas fases recomendadas (atualização)

| Fase | Escopo | Esforço | Prioridade |
|---|---|---|---|
| **5** | Replicar padrão para TRF2 + TRF3 (ambos confirmados ATIVOS no DataJud, ainda sem driver) — usando padrão Fase 3 + decisão Fase 4 (`headless: false`) | 1-1,5h cada | MÉDIA |
| 6 | G11 — implementar `consultarPJe2g` para acórdãos incidentais | 2-3h | ALTA |
| 7 | G18 — corrigir extração de partes (analisar `pje1g_detalhe_body.txt` real) | 30-60 min | MÉDIA |
| 8 | G6 — wrapper de retry com backoff em fetch + Playwright | 1-2h | MÉDIA |
| 9 | G1 — decidir DB para audit log centralizado (com Marcos) | reunião | ALTA estratégica |

---

**Confidencialidade & Traceability**
- UUID: `c9734d7f-f583-4bc3-8d9f-2935d4c3053d`
- SHA-256 deste documento: arquivo manifest companion `aditivo_2026-04-24_fase4.md.sha256`
- Timestamp UTC: `2026-04-27T04:59:26Z`
- Retenção: conforme contrato técnico master
- Aditivo pai: `aditivo_2026-04-24_fase3.md` (UUID `4eec7d61-f0e1-4f39-b00c-8e45c05ec967`)
- Cadeia: F1 → G3 → F2 → G12 → F3 → **F4 (este)**
- Sem commits novos nesta Fase (diagnóstica)
