# CLAUDE.md — AuraLOA · Diretrizes Institucionais

> **Versão:** 1.0 · **Criado em:** 2026-04-28 · **Autoridade:** Marcos Costa (DPO/titular AuraTECH)
>
> Anti-regressão: este arquivo é **leitura obrigatória** ao iniciar qualquer sessão (skill `/session-start`). Conflitos com MASTER.md/CONTEXT.md são resolvidos a favor deste documento.

---

## 🛑 LEI Nº 0 — MANTRA AURATECH

```
NUNCA DECIDA SEM 100% DE CERTEZA.
NUNCA SUPONHA DADOS.
NUNCA CRIE INFORMAÇÃO SEM EMBASAMENTO TÉCNICO OU CIENTÍFICO.
NUNCA TRATE FORMATAÇÃO DE UI COMO EVIDÊNCIA DE CONTEÚDO.
SEMPRE LEIA O MANUAL OFICIAL.
SEMPRE CITE FONTE VERIFICÁVEL.
SEMPRE EMITA ALERTA VERMELHO ANTE TRAÇOS DE ALUCINAÇÃO OU REGRESSÃO.
```

**Compromisso de caráter:** ético · honesto · verdadeiro · transparente · parceiro · pró-ativo · correto · respeitoso · protetor · honrado.

**Violação = remoção do projeto.**

---

## ⛔ REGRA ABSOLUTA Nº 1 — NÃO INVENTE

Não inventar · não supor · não extrapolar:
- ❌ CPF, CNPJ, OAB, telefone, email, endereço sem fonte verificável
- ❌ Código SIAFI, código de ação orçamentária, código tribunal — sempre tabela oficial
- ❌ CNJ, número de precatório, valor sem fonte (LOA / SIOP / DataJud / DJEN / TRF)
- ❌ Razão social, nome de empresa — sempre validar via Receita/BrasilAPI
- ❌ Status de processo — sempre evidência (publicação DJEN / sistema TRF / OB no Portal)

Se faltar fonte: marcar `[N/D]` ou `[a localizar]`. Nunca preencher chutando.

---

## ⛔ PIPELINE ÚNICO AUTORIZADO

**O único pipeline autorizado para Due Diligence de precatório é `/pipeline-relatorio-dd` — 15 fases em 4 camadas.**

Qualquer outro pipeline incompleto é **PROIBIDO sem autorização explícita de Marcos**.

**Pipelines operacionais (não-DD)** — agregação, enriquecimento em massa, conciliação — usam scripts dedicados validados, fora do `/pipeline-relatorio-dd`. Documentados em `docs/CONTEXT.md`.

---

## ⛔ DIRETRIZ DE ENRIQUECIMENTO (27/04/2026) — endpoints PROIBIDOS para pendentes/empenhados

Universo-alvo do AuraLOA é precatório **inscrito na LOA mas ainda NÃO PAGO** (modelo de negócio — comprar direito creditório do credor antes do pagamento).

**PROIBIDO** usar para enriquecer credor/contato:
- `/api-de-dados/despesas/recursos-recebidos` (todos pagos)
- `/api-de-dados/despesas/documentos?fase=3` (pagamento)
- `/api-de-dados/despesas/documentos-por-favorecido?fase=3`
- Qualquer endpoint que filtre por **pagamento realizado** (OB emitida)

**PERMITIDO**:
- `/pessoa-juridica`, `/contratos/cpf-cnpj`, `/orgaos-siafi`
- `/despesas/documentos?fase=1` (empenho) ou `fase=2` (liquidação) — pré-pagamento
- DataJud público, DJEN comunica, BrasilAPI, sistemas TRF (PJe/processual.trfX/eproc)

**Uso aceito de pagos:** apenas para DESCARTAR candidato já identificado (se aparece como pago, sai do funil).

Memória completa: `memory/feedback_proibido_pagos_para_enriquecimento`.

---

## 🚨 INCIDENTES — LIÇÕES PERMANENTES

### Incidente 31/03/2026 — fabricação de HTML
- HTML DD foi gerado com dados fabricados (sem evidência). Detectado antes do envio.
- **Lição permanente:** todo dado em relatório DD precisa de fonte (sistema judicial / arquivo SHA-256 / regra legal hardcoded). Sem fonte → não vai.

### Incidente 11/04/2026 — gatilho do MANTRA
- Agente afirmou pesquisa concluída sem ter feito todas as fases.
- **Lição:** declarar honestamente o que NÃO foi feito.

### Incidente 17/04/2026 — pm2 quebrou produção
- Tentativa de `pm2 restart --update-env` em produção sem validar quebrou loa.auradue.com por ~1h30.
- **Lição:** zero experimentos em produção. Sempre validar local primeiro.

### Incidente 22/04/2026 — `/recursos-recebidos` para enriquecer (1ª vez)
- Agente propôs usar endpoint de pagos como caminho de enriquecimento. Marcos corrigiu.
- **Lição:** universo-alvo (LOA pendente) é COMPLEMENTAR ao de pagos.

### Incidente 27/04/2026 manhã — bug producer `_BR.csv` decimal
- CSV emitido com locale híbrido (separador `;` + decimal `.`) → leitura 10× errada em Excel BR.
- **Lição:** sempre testar consumo em ferramentas BR antes de declarar entrega.

### Incidente 27/04/2026 tarde — reincidência da diretriz pagos
- Agente voltou a propor `/recursos-recebidos` (UG 71103). Marcos ampliou regra → memória `feedback_proibido_pagos_para_enriquecimento`.
- **Lição:** ler diretriz literal, não inferir restrições maiores nem menores.

---

## 🛡️ PIPELINE OCR — REGRAS ABSOLUTAS (blindado 01/04/2026)

- Pasta de saída **NUNCA no OneDrive** (`OneDrive intercepta I/O → Playwright fecha BrowserContext silenciosamente`)
- Sempre `--saida=C:/Temp/auraloa-saida/<id>` ou similar local
- OCR via Claude Haiku via viewer eSAJ autenticado (`server/scripts/due_diligence/`)
- Validado com 9/20 → 20/20 páginas após mover saída para `C:/Temp`
- Confirmado em 01/04/2026 + reforçado em 27/04 manhã

---

## 🌐 INFRAESTRUTURA E AMBIENTE

### Servidor de produção
- **VPS Hetzner ubuntu-4gb-nbg1-3** · IP `178.104.66.47`
- Path: `/var/www/auraloa` · gerência: PM2 + Nginx + SSL
- SSH: `ssh hetzner` (chave configurada — Claude Code **NÃO suporta SSH com senha**)
- Domínio: `https://loa.auradue.com`

### Servidor adicional (NÃO confundir)
- **VM Hetzner ubuntu-4gb-hel1-1** · IP `89.167.8.143`
- Uso restrito — não fazer deploys aqui sem ordem explícita

### Stack
- Node.js v24 · Express 5 + TypeScript 5.6 · React 18 + Vite 7
- ORM: Drizzle · Banco: PostgreSQL (Hetzner) · Stripe SDK v20+
- **CJS obrigatório nos scripts validados** (`robo_pje_v2`, `due_diligence/*`) — NÃO migrar para ESM sem autorização
- Em ESM: usar `createRequire` para carregar módulos CJS (ex: `pdf-parse`)
- Bundle: `dist/index.cjs` — usa `node --env-file=.env` (não tem `dotenv.config()`)

### Email institucional
- **Correto:** `suporte@auradue.com`
- Não inventar: nada de `contato@`, `auradue@gmail.com`, etc

---

## 📚 FONTES DE DADOS CANÔNICAS

| Fonte | Endpoint/Path | Uso |
|---|---|---|
| **DJEN comunica (CNJ)** | `https://comunicaapi.pje.jus.br/api/v1/comunicacao` | Partes + advogados + OAB de qualquer CNJ federal/trabalhista/STJ. Sem auth, sem captcha. Ver skill `djen_auraloa-enriquecer` |
| **DataJud público (CNJ)** | `https://api-publica.datajud.cnj.jus.br/api_publica_<sigla>/_search` | Metadados de processo (classe, órgão, data ajuiz, movimentos). NÃO retorna partes |
| **Portal Transparência** | `https://api.portaldatransparencia.gov.br/api-de-dados/` | CNPJ devedor (`/pessoa-juridica`), contratos (`/contratos/cpf-cnpj`), órgãos SIAFI (`/orgaos-siafi`). Endpoints `/despesas/*` têm restrição horária 00h-06h Brasília |
| **BrasilAPI CNPJ** | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` | Razão social + QSA + endereço. Gratuita, sem chave |
| **TRF1 processual** | `processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1` | Lista processos por CNPJ — VALIDADO 407 INCRA. Cobertura: TRF1 só |
| **PJe TRF1 1g** | `pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam` | Robô `robo_pje_v2` — partes via Playwright |
| **SIOP histórico** | CSVs em `C:/Temp/auraloa-saida/siop_historico/expedidos_*.csv` | 2008-2027 — match LOA × SIOP por (tribunal_codigo, valor) |
| **LOA Federal 2024-2026** | `Arquivos Precatorio/LOA_2026/LOA_2026_Federal/` | 79.156 precatórios consolidados em `*_INTL.csv` |

---

## 🤖 MCPs AUTORIZADOS (`.mcp.json`)

`stitch-mcp` · `21st-dev-magic` · `portal-transparencia` (chave em `.env`) · `dados-brasil` · `brasil-api` · `apollo` (plano free — limitado).

**MCPs NÃO carregam mid-session.** Para ativar, reiniciar Claude Code.

---

## 📋 SKILLS CRÍTICAS (sempre disponíveis em `~/.claude/skills/`)

| Skill | Quando usar |
|---|---|
| `/session-start` | **OBRIGATÓRIO** ao iniciar qualquer sessão |
| `/session-close` | **OBRIGATÓRIO** ao encerrar |
| `/pipeline-relatorio-dd` | Único pipeline autorizado para DD individual (15 fases, 4 camadas) |
| `/djen_auraloa-enriquecer` | Enriquecer CNJ → partes + advogados + OAB via DJEN |
| `/identificar-credor-precatorio` | Identificar credor partindo do CNJ originário |
| `/cruzar-processos-precatorios` | Cruzar LOA × processos TRF (TRF1 validado) |
| `/agente-revisor` | Validação cruzada antes de qualquer entrega |
| `/agente-auditor` | Completude da acusação (AuraLEGAL — fase 3) |
| `/consulta-transparencia` | Portal da Transparência via MCP |
| `/deploy-hetzner` | Upload SFTP para VPS produção |

Catálogo completo: `~/.claude/SKILLS_AURATECH.md`.

---

## 🗂️ MEMÓRIAS CRÍTICAS (leitura obrigatória)

`memory/`:
- `feedback_mantra_auratech.md` — Lei Nº 0 detalhada
- `feedback_USAR_O_QUE_JA_EXISTE.md` — não reinventar (5 violações em 3 dias documentadas)
- `feedback_pipeline_unico_autorizado.md` — só `/pipeline-relatorio-dd`
- `feedback_proibido_pagos_para_enriquecimento.md` — endpoints de pagos PROIBIDOS para enriquecer pendentes
- `project_modelo_negocio_precatorio_nao_pago.md` — modelo de negócio, universo-alvo
- `project_robo_pje.md` — status de cobertura por tribunal
- `feedback_onedrive_pipeline.md` — OneDrive bloqueia OCR
- `feedback_infra_servidores.md` — não confundir servidores
- `project_hetzner_servidores.md` — mapa completo da infra
- `feedback_codigo_autorizacao.md` — não alterar código sem autorização
- `feedback_nunca_inventar_contato.md` — contato sempre verificável
- `feedback_regressao_pos_compactacao.md` — preservar contexto após compaction

---

## 🔒 ARQUIVOS PROTEGIDOS — não modificar sem autorização explícita

- `server/scripts/robo_pje_v2/index.cjs` — TRF1 validado (407 processos)
- `server/scripts/robo_pje/drivers/trf1.cjs` — TRF1 validado
- `server/scripts/due_diligence/*` — pipeline OCR blindado 01/04/2026
- `dist/index.cjs` — bundle de produção
- `docs/templates/TEMPLATE_DD_PRECATORIO.html` — template DD blindado 14/04
- `docs/MASTER.md` · `docs/CONTEXT.md` · `docs/MANUAL_MASTER_PRECATORIO.md` — APPEND only
- `contrato_tecnico/aditivos/*.md` — aditivos formais com selo `.sha256`

---

## 🧱 PASTAS GOVERNADAS (selo `.sha256` obrigatório)

- `contrato_tecnico/aditivos/` — todo `.md` novo gera `.md.sha256`
- `docs/sessions/` — relatórios de session_close

Skill `/session-close` aplica selos automaticamente.

---

## ⚖️ COMMITS GIT — REGRAS

- **NUNCA** commitar sem autorização explícita
- **NUNCA** push sob nenhuma hipótese sem ordem
- **NUNCA** force-push em main/master
- **NUNCA** `--no-verify`, `--no-gpg-sign`
- Sempre commit message com Co-Authored-By Claude

Cláusula N6 do CONTRATO_TECNICO_MASTER: aditivos formais só têm validade institucional quando versionados — mas ato de versionar é decisão humana.

---

## 📐 LIMITAÇÕES DO AGENTE (declarar antes de agir)

- Claude Code **NÃO suporta input interativo** (senhas SSH, prompts em terminal)
- **NÃO pode SSH com senha** — apenas chave (`ssh hetzner`)
- **MCPs não recarregam mid-session** — restart necessário
- Se tarefa exigir interação manual → avisar Marcos IMEDIATAMENTE

---

## 📊 RELATÓRIOS PUBLICADOS (referência)

- `loa.auradue.com/due-diligence/santacasa-pp` — Santa Casa R$235M
- `loa.auradue.com/due-diligence/suframa` — SUFRAMA R$21M
- `loa.auradue.com/due-diligence/adimix` — Adimix
- `loa.auradue.com/due-diligence/demo` — Demo investidor

Todos seguem o template DD blindado e foram revisados antes de publicar.

---

## 🔗 REFERÊNCIAS CRUZADAS

- Detalhes técnicos completos: `docs/MASTER.md`
- Manual master de precatórios: `docs/MANUAL_MASTER_PRECATORIO.md`
- Contexto cumulativo: `docs/CONTEXT.md` (APPEND only)
- Catálogo de skills: `~/.claude/SKILLS_AURATECH.md`

---

**Mudanças neste arquivo requerem decisão DPO de Marcos Costa.**
**Em caso de conflito entre este arquivo e qualquer outro: este prevalece.**
