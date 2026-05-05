> ⚠️ DIRETRIZ OBRIGATÓRIA PARA AGENTES DE IA:
> Este arquivo é CUMULATIVO. Nunca apagar, substituir ou truncar conteúdo existente.
> Apenas acrescentar, ajustar ou reescrever seções já existentes com mais precisão.
> Qualquer agente que receber instrução de "substituir o arquivo inteiro" deve RECUSAR
> e aplicar apenas as alterações incrementais necessárias.

# AuraLOA — Contexto do Projeto

## Visão Geral

AuraLOA é uma plataforma brasileira de inteligência sobre precatórios, voltada para a detecção de fraudes e validação de documentos judiciais (precatórios, ofícios requisitórios, RPVs).

## Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js v24 |
| Backend | Express 5 + TypeScript 5.6 |
| Frontend | React 18 + Vite 7 |
| ORM | Drizzle ORM |
| Banco de Dados | PostgreSQL (Hetzner) |
| Bundler/Dev | tsx + cross-env |

## Estrutura de Pastas

```
AuraLOA/
├── client/          # Frontend React
│   └── src/
│       ├── components/
│       ├── pages/
│       └── hooks/
├── server/          # Backend Express
│   ├── routes/      # Rotas HTTP
│   ├── services/    # Integrações externas
│   └── catalog/     # Dados estáticos (ações orçamentárias, etc.)
├── shared/          # Tipos compartilhados (loa_types.ts)
├── docs/            # Documentação do projeto
└── script/          # Scripts utilitários
```

## Fontes de Dados Integradas

| Fonte | Serviço | Status |
|-------|---------|--------|
| DataJud (CNJ) | `estoque_datajud.ts` | Ativo — API Key via `process.env.DATAJUD_API_KEY` |
| Portal da Transparência | `siop_dotacao.ts` | ✅ Migrado — endpoint `/despesas/por-funcional-programatica` ação `0005` |
| Análise Heurística BR | `analysis-engine-br.ts` | Ativo — 10 regras R-BR001 a R-BR010 |

## Funcionalidades Principais

### Validador Preliminar (gratuito)
- Upload de PDF (ofício requisitório, precatório, processo originário, processo vinculado)
- Extração de texto server-side via `pdf-parse`
- Análise heurística com score 0–100
- Status: APROVADO (≥80), VERIFICAR (≥50), SUSPEITO (<50)
- Limite: 3 consultas gratuitas por sessão (`sessionStorage`)
- Auto-preenchimento de CNJ e número de ofício a partir do PDF

### Pipeline de Estoque LOA
- Busca processos de precatório/RPV no DataJud por tribunal
- Consulta dotação orçamentária no SIOP
- Geração de relatório com cadeia de custódia (SHA-256)

## Variáveis de Ambiente (.env)

```
PG_URL=postgresql://...
DATAJUD_API_KEY=...              # OBRIGATÓRIA — sem fallback no código
SESSION_SECRET=...               # segredo JWT
PORTAL_TRANSPARENCIA_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

## Quirks de Desenvolvimento (Windows)

- Usar `cross-env NODE_ENV=development` no script dev
- Usar `tsx --env-file=.env` para carregar dotenv no ESM
- Servidor vinculado em `127.0.0.1` (sem `reusePort`)
- `pdf-parse` carregado via `createRequire` (módulo CJS em contexto ESM)
- Node.js em `C:\Program Files\nodejs\` — usar `powershell.exe` se `node` não estiver no PATH do bash

## Tribunais Suportados (DataJud)

`trf1`, `trf2`, `trf3`, `trf4`, `trf5`, `trf6`, `tjsp`, `tjrj`, `tjmg`, `tjrs`, `tjpr`, `tjsc`, `tjba`, `tjam`

## Tabelas do Banco Relevantes

| Tabela | Descrição |
|--------|-----------|
| `document_validations` | Resultado das análises heurísticas de PDF |
| `document_suspects` | Documentos bloqueados por score baixo |
| `source_snapshots` | Snapshots de fontes externas (LOA pipeline) |

## Backlog Pendente

- [x] Integração Stripe implementada — planos, rotas, webhook, banco migrado
- [x] 5 planos criados: Free, Essencial, Professional, Business, Enterprise, Enterprise Plus
- [x] Price IDs mapeados em shared/plans.ts
- [x] Colunas Stripe adicionadas em aura_users via db_init.ts
- [x] Testado `siop_dotacao.ts` — Portal da Transparência retorna zeros para acao=0005 (precatórios registrados por empenho individual, não consolidados). Marcado como INDISPONÍVEL até solução melhor.
- [x] Segurança: bcrypt + JWT 7d + rate limit + cache + path traversal + API key segura
- [x] Performance: consultas DataJud paralelas (Promise.all) — de ~112s para ~8s
- [x] Geração de Laudo PDF técnico (POST /api/loa/uniao/estoque/pdf)
- [x] Pipeline validador landing page verificado e corrigido
- [x] Skills globais instaladas — 25 skills em ~/.claude/skills/ (30/03/2026)
- [x] Skill customizada auratech-workflow criada com 7 agentes especializados
- [x] Dark theme padronizado — todos os tokens CSS, KPICards, GraficosDashboard, not-found (30/03/2026)
- [x] Logo AuraLOA padronizado — Scale + gradiente em todas as páginas internas (30/03/2026)
- [x] AppTopbar unificado — componente único para loa, sp, admin, pendentes, contrato (30/03/2026)
- [x] Fluxo "Esqueci senha" + "Cadastre-se" implementados no login (30/03/2026)
- [x] Relatório de due diligence dark HTML gerado (auraLOA_dark_report_FINAL.html) (30/03/2026)
- [x] Deploy path confirmado: /var/www/auraloa (não /opt/auraloa) — git pull funciona (30/03/2026)
- [x] dashboard.tsx: 5 bugs corrigidos — usuarioInfo dinâmico, logout funcional, STATUS_COLOR_MAP inline, KPICards removido (import morto), busca adicionada (30/03/2026)
- [x] dashboard.tsx: KPICards + GraficosDashboard restaurados — 7 KPIs visíveis (Verificar + Suspeitos recuperados), 4 gráficos com CustomTooltip e tokens canônicos (30/03/2026)
- [x] dashboard.tsx: dark mode toggle removido, tokens alinhados (#0d1117/#162032), coluna Tipo (RPV/PRECATORIO) adicionada na tabela (30/03/2026)
- [ ] Configurar ecosystem.config.js no PM2 para carregar .env automaticamente no reboot do servidor
- [ ] Corrigir integração Stripe (webhook secret vazio no .env)
- [ ] Testar pipeline end-to-end com TJSP/2024 (volume real de processos)
- [ ] Busca em lote pós-assinatura (até 10 processos)
- [ ] Adicionar SMTP para envio real do link de reset de senha (usar SendGrid ou Resend)
- [ ] Criar endpoint real /api/dashboard/precatorios para substituir gerarDadosExemplo() no dashboard

## Sessão 30/03/2026 (continuação) — Dashboard corrigido e restaurado

### Bugs corrigidos (dashboard.tsx)
1. `usuarioInfo` hardcoded (nome/email/plano fixos) → lê `localStorage` + fetch `/api/auth/me`
2. Logout sem funcionalidade → limpa todas as chaves `aura_*` + `navigate("/")`
3. `STATUS_CORES` (Tailwind classes) em contexto inline → `STATUS_COLOR_MAP` com hex reais
4. `KPICards` importado sem uso no JSX → removido import morto (era para ter sido reativado)
5. `dark` toggle quebrava componentes filhos (tokens hardcoded) → `dark` state removido; tokens canônicos fixos

### Restauração de componentes suprimidos
- `KPICards` reativado — 7 KPIs em 2 linhas: Verificar (amber) + Suspeitos (red) estavam sumidos desde a reescrita inline do dark theme
- `GraficosDashboard` reativado — CustomTooltip com formatação monetária, background nas barras, `formatarValorAbrev` no eixo X
- Tokens alinhados: `#0d1117 / #162032 / rgba(255,255,255,0.07)` — idênticos aos dos componentes

### Melhorias de dados e apresentação
- Coluna **Tipo** adicionada na tabela (badge RPV violet / PRECATORIO cyan)
- Campo de **busca** adicionado (CNJ, credor, tribunal) com filtro em tempo real
- Dark mode toggle removido do topbar (era cosmético, quebrava o layout)

## Sessão 24/03/2026 — O que foi feito

- `estoque_datajud.ts`: 5 correções (ano_exercicio na query, API key via env, URL trf6, timeout 15s, URL duplicada removida)
- `siop_dotacao.ts`: migrado de SPARQL para Portal da Transparência REST API (ação `0005`)
- `estoque_tribunais.ts`: TJSP incluído, todos tribunais com PDF enriquecimento, dotação integrada no resultado, log de erro melhorado
- `validador-preliminar.tsx`: botão ativo ao selecionar PDF, sem campos manuais de CNJ/ofício visíveis
- `docs/CONTEXT.md`: criado e atualizado com contexto do projeto

## Infraestrutura Hetzner (atualizado 25/03/2026)

### Servidor
- Nome: ubuntu-4gb-nbg1-3
- IP: 178.104.66.47
- OS: Ubuntu, usuario root
- Acesso: SSH via PowerShell — ssh root@178.104.66.47
- ATENCAO: Console web Hetzner em alemao — usar sempre SSH via PowerShell

### Instalado no servidor
- Node.js v20.20.1 instalado
- PM2 6.0.14 instalado
- Nginx 1.24.0 instalado
- PostgreSQL (banco auraloa, usuario auraloa_user) instalado

### DNS
- loa.auradue.com -> A -> 178.104.66.47 configurado
- Registro antigo 34.111.179.208 deletado

### Deploy pendente
- Backend AuraLOA ainda nao deployado no servidor
- Proximo passo: clonar repositorio e configurar PM2 + Nginx

## Sessão 28-29/03/2026 — Segurança, Performance e Pipeline

### Segurança corrigida
- `auth.ts`: hash SHA256 → bcrypt 12 rounds + JWT 7 dias; migração automática de hashes legados no login
- `estoque_datajud.ts`: API key hardcoded removida; DATAJUD_API_KEY obrigatória no .env
- `evidence_pack.ts`: path traversal corrigido — filename sanitizado (`/[^a-zA-Z0-9._-]/g → _`)
- `estoque_datajud.ts`: JSON.parse com try-catch local e mensagem clara
- `analise_documento.ts`: createRequire corrigido — `fileURLToPath(import.meta.url)` em vez de `__filename`

### Performance
- `fetchPrecatorioByNumero()`: loop serial → `Promise.all` paralelo
  - Antes: até 14 tribunais × 8s = até 112s
  - Depois: todos em paralelo = ~8s máximo

### Rate limiting e cache (validador.ts)
- Rate limit: 10 req/60s por IP (Map em memória, limpeza a cada 5min)
- Cache: TTL 5min por número CNJ (evita reconsultas à API DataJud)
- Headers: `X-RateLimit-Remaining`, `X-RateLimit-Limit`, `Retry-After`
- Frontend: lê `X-RateLimit-Remaining` do servidor; trata HTTP 429 mostrando modal de limite

### Novo serviço: Laudo PDF
- `server/services/laudo_pdf.ts`: geração de laudo técnico formal com pdfkit
- `POST /api/loa/uniao/estoque/pdf`: mesmo input do endpoint JSON, retorna PDF para download
- Conteúdo: cabeçalho AuraLOA, identificação, resumo em cards, tabela por tribunal, dotação, SHA-256, fontes, rodapé paginado

### Dependências adicionadas
- `bcrypt` + `@types/bcrypt`
- `jsonwebtoken` + `@types/jsonwebtoken`
- `pdfkit` + `@types/pdfkit`

### Credenciais (usuário admin)
- Email: marcos@auradue.com
- Senha: AuraLOA@2026 (resetada em 30/03/2026 via bcrypt direto no banco Hetzner)

### Componentes novos (30/03/2026)
- `client/src/components/app-topbar.tsx` — topbar unificado para páginas internas
- `client/src/components/ReportTemplate.tsx` — template React de relatório de due diligence
- `docs/auraLOA_dark_report_FINAL.html` — relatório Montichiari D1 (dark, 7 seções, Chart.js)
- `docs/auratech-tokens.json` — design tokens do sistema AuraTECH
- `docs/auratech-report.css` — variáveis CSS para relatórios HTML (.at-* prefix)

## Sessão 23/04/2026 (madrugada) — Início da V2 Pipeline Freemium

### Decisão estratégica
Após diagnóstico honesto do pipeline atual (6 erros graves documentados), **Marcos decidiu reescrita completa**: "essa atual nunca funcionou!". Saímos da `fix/p0-p5-pipeline-correction` e criamos branch limpa `feat/v2-pipeline-freemium` de `main`.

### Diagnóstico documentado (pipeline antigo)
1. `pdf-parse` falha em PDFs image-only (extrai 4 chars de 272KB reais)
2. `analysis-engine-br` regex não extrai credor/valor/juiz mesmo em PDFs com texto
3. Threshold SUSPEITO bloqueia documentos legítimos (score 29 em CNJ válido do TRF1)
4. SIOP conciliado cobre só 4% (1.590 de 42.174 registros)
5. Fases 2, 3, 4, 5 do pipeline de 17 fases são stubs que **confessam** não implementação no JSON
6. Mapa UO→Órgão Superior incompleto (Ministério da Saúde sem mapeamento)

### Decisões de produto (aprovadas por Marcos)
- **Entrada:** APENAS upload de PDF (sem digitação manual)
- **Freemium:** pesquisa "é real + está ativo" = **GRÁTIS**. Dados adicionais (valor, credor, advogado, gravames, movimentações, PDF SHA-256) = **PAGO por tier de valor**.
- **Tiers:** R$ 99 (RPV ≤ 50k) · R$ 249 (≤ 500k) · R$ 599 (≤ 2M) · R$ 1.499 (≤ 10M) · R$ 3.999 (≤ 50M) · sob consulta
- **Assinatura desde MVP:** Starter R$ 299, Pro R$ 999, Enterprise R$ 2.999
- **Promoção Fundadores:** 30% off vitalício nos 100 primeiros assinantes (não aplica avulso). Inclui selo, acesso antecipado a AuraLEGAL/AuraDUE/AuraAUDIT, canal privado.
- **LGPD:** checkbox anônimo no upload + servidor Hetzner Alemanha (GDPR)
- **Rate-limit:** 5 análises grátis/dia/IP
- **Motor:** 5 fases HONESTAS (DataJud + LOA CSV + BrasilAPI + Portal Transparência + PJe scraping). Zero stubs. Cada fase retorna `{status, confianca, fontes[], evidencia_hash}`.
- **Extração:** Claude Haiku 4.5 via `@anthropic-ai/sdk` substitui regex puro (~R$ 0,01 por análise)
- **OCR:** `tesseract.js@7.0.0` como fallback quando `chars_extraidos < 500`
- **Auditoria embutida:** 3 camadas (auto-verificação por fase, agente revisor com checks cruzados, log imutável `v2_audit_log`)

### Entregas técnicas
- `.gitignore` ampliado (scripts debug, dados pessoais LGPD, data pesada — 205MB → ~7MB commitado)
- Commit preservação WIP `585f37d` na `fix/p0-p5-pipeline-correction`
- Branch nova `feat/v2-pipeline-freemium` de main limpa
- `tesseract.js@7.0.0` instalado
- **B1 Fundação** (commit `3c97153`):
  - `server/v2/db_migrations_v2.ts` — 4 tabelas: `v2_analises`, `v2_audit_log`, `v2_membros_fundadores`, `v2_rate_limit`
  - `server/v2/upload_config.ts` — multer diskStorage com dedup por SHA-256
  - `server/v2/routes_v2.ts` — `POST /api/v2/analise` + `GET /api/v2/analise/:id`
  - Plugado em `server/index.ts` (boot) e `server/routes.ts` (router)
  - Uploads salvos em `C:/Temp/auraloa-saida/uploads_v2/{SHA-256}.pdf` (dev) ou `/var/www/auraloa/uploads_v2/` (prod)

### Testes localhost:5001 (todos passando)
- POST sem LGPD → 400
- POST com LGPD → 200 (validation_id, sha256, paginas, chars_extraidos, rate_limit)
- GET por validation_id → dados persistidos
- Rate-limit 5/dia incrementa corretamente
- Dedup SHA-256 funciona (mesmo PDF = 1 arquivo em disco)

### Pendências para próxima sessão (lembrar Marcos ao entrar)
- **B2 — Extração:** integrar tesseract.js + Claude Haiku 4.5 (endpoint `POST /api/v2/analise/:validation_id/extrair`)
- **B3 — Verificação:** 5 fases honestas
- **B3.5 — Auditoria:** checks cruzados + badges "requer revisão"
- **B4 — Freemium UX:** landing desbloqueada + teaser (deixar CLARÍSSIMO "pesquisa grátis") + Stripe por tier + contador de Fundadores
- **B5 — Relatório:** HTML/PDF v2 + dashboard "minhas análises" + webhook Stripe

### Erros observados na sessão
Nenhum erro grave. Bug pequeno do tmp file órfão em uploads rejeitados foi consertado no mesmo commit. Dev server morreu com `pm2 --update-env`-like ao reiniciar (port 5000 já ocupada por processo antigo PID 25572 desde 22/04 15:34) — workaround: rodar em `PORT=5001`. Marcos NÃO autorizou matar o PID 25572 (cautela).

### Estado de produção
`loa.auradue.com` **não foi tocada** nesta sessão. Permanece com pipeline antigo em `fix/p0-p5-pipeline-correction` rodando (commit de preservação feito). V2 ficará em dev até aprovação de Marcos para cutover.

## Sessão 23-24/04/2026 (maratona) — V2 Pipeline Freemium validado ponta-a-ponta

### Entregas commitadas
- `3c97153` B1 Fundação (schema + multer + endpoint POST /api/v2/analise)
- `b62ff59` Cherry-pick assets reusáveis (templates, ocr_agent, robo_pje, LOA CSV)
- `00294fd` B2 Extração Claude Haiku 4.5 (OCR nativo + texto)
- `3da79d3` B2+ expansão + C1 lote (até 5 docs) + C2 consolidador/revisor 3 níveis
- `fb1cfa3` C3 Orquestrador F1/F2/F3 + C4 Relatório HTML/PDF + **fix crítico DataJud TRF1**

### Entregas NÃO commitadas (pendentes para próxima sessão)
- 5 ajustes no prompt Haiku: promotor de campos, CNJ antigo pré-2008, advogados[], classificacao_credito[], beneficiarios_detalhados[], metadados_requisicao
- Detector de complexidade (não bloqueia, só sinaliza)
- **Alerta anti-golpe automático** quando cessionários detectados ("Due Diligence Global")
- Revisor pós-extração (`server/v2/revisor_extracao.ts`) com 7 checksums
- Fix endpoint `/api/v2/analise/:id/extrair` usar `persistExtractionResult` unificado
- Botão "Exportar PDF ABNT" no teste-v2.html + endpoint `/api/v2/lote/:id/relatorio.pdf`
- 7 scripts dev_*.ts de diagnóstico

### Alertas vermelhos reportados e resolvidos nesta sessão
1. **Commit sujo inicial** — `git add -A` pegou 947k linhas. Revertido com `git reset --soft` + commit curado.
2. **Memória antiga FALSA em MASTER.md** — seção 7-A dizia "TRF1/TRF2/TRF5 indisponíveis no DataJud". Validação empírica direta provou FALSO. Bug real era query com CNJ pontuado. Corrigida + memória nova criada.
3. **Endpoint `/api/v2/analise/:id/extrair` com UPDATE inline** — não gravava campos novos (advogados, classificacao, beneficiarios, metadados, validacao_extracao). Descoberto quando Marcos perguntou "revisor rodou na primeira fase?". Comprovado via SQL. Corrigido para usar `persistExtractionResult` unificado.

### Descobertas técnicas
- **tsx NÃO faz hot-reload** — sempre kill + restart após editar TypeScript.
- **DataJud TRF1 FUNCIONA** — buscar por `numeroProcesso` com 20 dígitos PUROS (sem pontuação). Afirmação antiga era errada.
- **Classes processuais em TRF1**: NÃO usa 1265 (Precatório). Usa 156, 12078, 1208, 1728. Precatório no TRF1 é FASE em Cumprimento de Sentença.
- **Haiku 4.5 lê PDF nativo** via `type: "document"`. Custo ~R$ 0,03 por PDF 2 páginas, ~R$ 0,24 por 12 páginas.
- **CNJ antigo pré-2008** (`1931-10.1990.4.01.3400`) é VÁLIDO.

### Testes reais concluídos
- **Santa Casa TRF1 R$ 235M**: lote `oBq73QnWy9`, score revisor 100/100, F3 achou Presidente + email + tel.
- **Agrovale TRF1 R$ 671M**: lote `M8Q812qqvE`, 12 páginas com 3 ofícios, 13 cessionários (5 FIDCs). Revisor pós-extração score 64/100 detectou 2 alertas (valor inflado 2x + duplicação de FIDCs).

### Pendências técnicas próxima sessão
1. Commitar os 6 arquivos novos + edits (discutir com Marcos).
2. Bugs do Haiku a corrigir: duplicata FIDC no Agrovale, total=null nos cessionários, valor_rs inflado.
3. Revisor pós-enriquecimento (revalidar após F1/F2/F3 rodarem).
4. Deploy produção — aguardando Marcos aprovar cutover.

### Estado do localhost no fim da sessão
- Dev server rodando em `localhost:5001` (processo vai ser parado)
- Teste página: `http://localhost:5001/teste-v2.html`
- Último validation_id testado: `8bl9b0miS6ot` (Agrovale)

## Sessão 27/04/2026 — Governança DPO LOA 2026 Federal (2 aditivos)

### Contexto
Marcos enviou nova base reconciliada da LOA 2026 Federal (entrega CONCILIADO/upload 27apr2026/) com 4 arquivos derivados + manifesto + log. Demanda original: aplicar regra UO 10101 → 71103 nos consolidados. Sessão regida pelo `CONTRATO_TECNICO_MASTER.md` (Cláusulas N1, N2, N6, 1, 7, 10).

### Diagnósticos
1. **Manifesto v1 incompleto:** cobria apenas 58 PDFs de input; não tinha hash dos derivados (gap estrutural, não adulteração).
2. **Regra UO 10101 → 71103 = INVARIANTE:** auditoria mostrou 32/32 linhas STF já aplicadas (uo_devedora_codigo=71103, nome=EFU, normalizado=UNIÃO FEDERAL). Zero transformação necessária.
3. **Bug crítico no `_BR.csv`:** locale híbrido — separador campo `;` (BR) + decimal `.` (INTL). Causa leitura 10× errada em Excel BR. 79.156 linhas afetadas.

### Aditivos aplicados
- **Aditivo 1** — `aditivo_2026-04-27_extensao_manifesto_arquivos_saida.md`: criou `manifesto_integridade_v2.json` estendendo o v1 com bloco `arquivos_saida[]` (cadeia de custódia dos 7 derivados). v1 preservado byte-a-byte.
- **Aditivo 2** — `aditivo_2026-04-27_fix_decimal_br_csv.md`: criou `precatorios_loa_2026_consolidado_BR_v2_decimal_corrigido.csv` (decimal vírgula 2 casas) e `manifesto_integridade_v3.json` no diretório novo `CONCILIADO # 3-sim/`. Validações 2.F (soma) e 2.G (idempotência) OK.

### Hashes finais oficiais (selo da entrega LOA 2026 Federal)
- `manifesto_integridade.json` v1 (intocado): `f2983eccd0023094f01919e3e145c5f40de49a585ab43fbd9410f30a79cfcacf`
- `manifesto_integridade_v2.json`: `4f52f740caa9b4e3ea0411f9aa39bc09c04b95742c23e2a9baa99c6d7e419c9a`
- `manifesto_integridade_v3.json`: `0863c0fbc3b5a182030ff22f48eeff1e98672bc8dd711751512793f62c0be90e`
- `_BR.csv` (intocado): `232d87951fe5136ad1fb7c1bf2d87cd54fca836865259966c95c903fef69bf4e`
- `_BR_v2_decimal_corrigido.csv` (NOVO): `991da5862690c87b375f5130473e2f743dc78ece2b60fa4803d452b3b79e34ce`
- `_INTL.csv` (intocado): `cb90baeadd17638350eb898530f299e3295466a3485bf6a48230942ccb8a62c3`

### Validações cumpridas
- **Cláusula 2.F:** soma R$ 22.306.037.833,00 origem = destino, zero centavos de diferença.
- **Cláusula 2.G:** SHA-256 idêntico em 2 execuções da transformação.
- **58 PDFs de origem:** todos íntegros vs manifesto v1 (sha256sum confirmou os 58).
- **Cross-check BR↔INTL:** 0 divergências em 79.156 linhas.

### Pendências críticas (próxima sessão)
1. Linha 79.156 TRF4 com `valor_brl=0,00` (precatório `5018956-53.2024.4.00.0000`, FUNASA, "Custas") — investigar se é totalizador, quitado, ou bug de extração.
2. **Aditivo 3:** regenerar `ranking_devedores.csv` e `resumo_por_tribunal.csv` a partir do `_v2_decimal_corrigido.csv` (atualmente dessincronizados).
3. Confirmar fix upstream do producer (decimal `,` em `_BR.csv` nativamente) — encerra validade do Aditivo 2.
4. Resolver campos `a_definir` no manifesto v2 (`origem_pipeline`, `fonte_derivada_de`, `mtime_timezone`).

### Bug do agente reportado (transparência radical)
Na auditoria inicial (Passo 2.A do escopo original), parser BR computou soma 10× maior por interpretar `.` como milhar. **Reportado em tempo real** como "DESCOBERTA CRÍTICA #2 — DIVERGÊNCIA DE VALORES ENTRE BR E INTL", confirmado via grep visual da mesma linha em ambos arquivos, e parser corrigido na 2ª iteração. Soma final R$ 22.306.037.833,00 validada e bate com manifesto v1.

### Estado de produção
`loa.auradue.com` **não foi tocada** nesta sessão. Nenhum deploy. Nenhuma alteração de código backend/frontend. Operação 100% sobre arquivos da entrega LOA 2026 Federal e governança documental do contrato técnico.

### Adendo encerramento (meta-engenharia de skills)
Skills `/session-start` e `/session-close` atualizadas com **11 patches** consolidados desta sessão (5 em start, 6 em close). SHA finais: start `2647653b…`, close `61d401ae…`. Skill nova `/dpo-session-close` (Tier 4 — Cláusulas 2.F/2.G, validação de manifesto, hash crossover) + aditivo formal de skills no AuraLOA ficam como **P0a/P0b da próxima sessão**. Detalhe completo em `docs/sessions/session_close_2026-04-27.md` seção ADENDO.

## Sessão 27/04/2026 (tarde) — Pipeline LOA→Credor via DJEN (top 200)

### Contexto
Sessão operacional de enriquecimento do top 200 LOA 2026 com credor + advogado + OAB. Iniciou tentando rota PJe TRT1 (bate captcha Res 139/2014 CSJT), depois Portal `/despesas` (rate-limit horário 00h-06h Brasília), até o agente-revisor crítico apontar 2 rotas viáveis ignoradas: `/despesas/documentos?fase=1` (empenho — permitido pela diretriz) e Diários Oficiais. A rota DJEN destravou tudo.

### Destrave: API DJEN
**Endpoint:** `https://comunicaapi.pje.jus.br/api/v1/comunicacao` (oficial CNJ).
- Sem auth · sem captcha · `numeroProcesso` 20 dígitos sem máscara
- Retorna `destinatarios[]` (partes com polo A/P/T) + `destinatarioadvogados[]` (nome + OAB + UF + id CNJ)
- Texto HTML completo da última publicação + link permanente e-proc
- Cobertura: TRFs, TJs, TRTs, STJ. STF é fluxo próprio.

### Resultado top 200
| Status | Qtd | % |
|---|---:|---:|
| OK + OK_REFINADO | 135 | 67,5% |
| SEM_CNJ_VALIDO | 41 | 20,5% |
| DJEN_VAZIO | 23 | 11,5% |
| Erro | 1 | 0,5% |

**1.380 partes + 1.114 advogados (todos com OAB nominal)** identificados. Soma agregada R$ 3,44 bi.

### Diretriz Marcos 27/04 (memória `feedback_proibido_pagos_para_enriquecimento`)
NUNCA usar `/recursos-recebidos`, `/despesas/documentos?fase=3`, `/despesas/documentos-por-favorecido?fase=3` para enriquecer pendentes/empenhados. Universo-alvo é complementar ao de pagos. Memória atualizada também no AuraLOA (`project_modelo_negocio_precatorio_nao_pago` ampliada).

### Skills criadas
- **`djen_auraloa-enriquecer`** (`~/.claude/skills/`) — schema completo + retry/backoff [3s/8s/20s] + delay 1.5s + checkpoint a cada 50 + casos validados
- **`agente-revisor`** (`~/.claude/skills/`) — referencia `AuraLEGAL/src/agents/agente-revisor.ts`
- **`agente-auditor`** (`~/.claude/skills/`) — referencia `AuraLEGAL/src/agents/agente-auditor.ts`

Catálogo `SKILLS_AURATECH.md` atualizado com as 3 novas skills.

### Mapeamento de fases (memória `reference_pipeline_loa_credor_9_fases`)
9 fases executadas mapeadas para virar skills. Decisão arquitetural: criar 8 skills atômicas + 1 orquestradora. Primeira formalizada: `djen_auraloa-enriquecer`. Próximas a fazer: `descobrir-cnj-via-siop` (preencher), `loa-reconciliar-siop`, `loa-ordenar-top-n`, `refinar-sem-cnj-loa`, `relatorio-html-tabela-expandivel`, `cnj-validar-checksum`, `enriquecer-loa-credor-pipeline` (orquestrador).

### Saídas em `C:\Temp\precatorios_loa_2026_pipeline\`
- `top200_djen_TABELA.html` (1,5 MB) — relatório AuraLOA dark theme com tabela expansível, busca, PDF global e PDF individual por linha
- 4 CSVs (master / destinatarios / advogados / comunicacoes) — todos refinados
- `djen_evidencias_top200/` — 127 JSONs DJEN crus

### Pendências (priorizadas)
- **P1** — publicar HTML no Hetzner (pendente autorização Marcos)
- **P2** — formalizar 7 skills restantes do pipeline
- **P3** — email/telefone advogado via OAB CNA (token pendente; Apollo bloqueado plano free)
- **P4** — 41 SEM_CNJ (24 TRF2 pré-2008, 14 STF/STJ, 3 outros)
- **P5** — 23 DJEN_VAZIO (CNJs antigos)

### Estado de produção
`loa.auradue.com` **não foi tocada** nesta sessão. Operação 100% local sobre arquivos da entrega LOA 2026 + memórias + skills globais.

---

## 2026-05-01 — Refatoração Editorial da Landing AuraLOA + Marketplace placeholder

### Escopo
Sessão de design/frontend sobre a landing pública (`/`) e criação da rota `/marketplace`. Zero impacto em pipelines jurídicos / due diligence / dados.

### Entregas técnicas

**Tipografia padronizada (2 fontes, padrão Vogue editorial):**
- `client/src/index.css` — `--font-sans` = Lora, `--font-serif`/`--font-display` = Playfair Display, `--font-body` = Lora. Removido `--font-mono` órfão.
- Body global herda Lora via `@apply font-sans` (já existente).
- Hierarquia clara: Playfair pros displays (números, H1/H2, eyebrows uppercase, badges); Lora pros corpos (parágrafos, captions, italic narrativo).

**Hero refatorado (`client/src/pages/landing.tsx`):**
- 3 KPI cards substituídos por componente custom `EditorialGauge` (SVG puro com 60 tick marks, arc animado via framer-motion, counter animation 0→valor, end-cap dot gold).
- Subtitle reescrita (frase quebrada "...desde" virou frase completa).
- CTA primário convertido pra indigo solid com glow + focus-ring.
- Atmosfera com 3 gradient meshes (indigo + blue + amber) + noise SVG via `feTurbulence` + hairline horizontal de topo.

**Brand coherence — fim do rainbow:**
- Cyan (#22d3ee) trocado por indigo (#818cf8) — alinhamento com cor canônica AuraLOA do design-system AuraTECH.
- pipelineSteps + features array neutralizados (eram blue/amber/purple/emerald/cyan/rose/primary).
- Gold (#fbbf24) restrito a accents AuraTECH-parent (gauge end-cap, ratio pill).
- Emerald restrito a status "live/verified".
- Red só pra "Manual" (semântica destrutivo).

**Reposicionamento da seção "Cadeia de Custódia Digital":**
- Movida pra logo após o upload (antes vinha depois de Due Diligence + MarketOverview).
- Ordem nova: Hero → Validador+Marketplace → Custódia → Módulos → Due Diligence → MarketOverview → Fontes Oficiais → CTA → Footer.

**Novo: card Marketplace dual-side (`client/src/components/marketplace-card.tsx`):**
- Dual-side "Sou credor / Sou investidor" no hero, ao lado do Validador.
- Eyebrow + headline Playfair + subhead Lora italic + 2 sub-seções + 1 CTA primário (após pedido explícito de Marcos pra remover o secundário).
- Prova social honesta: `SHA-256 + Lei 13.964/2019 compliant` (sem fabricar números).

**Novo: rota `/marketplace` (`client/src/pages/marketplace.tsx`):**
- Hero editorial (Playfair + Lora) + dual-side cards (credor amber / investidor indigo) + how-it-works 4 passos + garantias técnicas + CTA final.
- Disclosure honesto: "Onboarding institucional aberto · Acesso por convite".
- CTAs primários apontam pra WhatsApp `5511995300144` com mensagens pré-preenchidas.
- Registrada em `client/src/App.tsx` em `<Route path="/marketplace" component={MarketplacePage} />`.

**ValidadorPreliminarLOA — modo `embedded`:**
- Componente compartilhado ganhou prop `embedded?: boolean`.
- `embedded=true` (usado na landing): remove max-w/mt externos + esconde a faixa de prova social (que foi promovida pro nível do grid pai, acima dos dois cards).
- Card refatorado: blue/cyan → indigo + amber accent.
- `embedded=false` (default): comportamento standalone preservado.

**Code cleanup (simplify pass):**
- Deletadas 7 imports recharts + 4 imports `@/components/ui/chart` + 78 linhas de dead constants (`timelineCompareData`/`timelineChartConfig`/`manualSteps`/`digitalSteps`).
- Removidos 7 lucide icons órfãos: `Building2`, `Activity`, `Clock`, `BarChart3`, `FileCheck`, `Scale`, `Users`.
- Substituído Tailwind `font-mono` por `font-serif tabular-nums` (resolve corretamente pra Playfair via CSS var).
- Total: ~95 linhas removidas + redução de bundle (recharts saiu da rota landing).

### Reviews aplicados
Antes da entrega, foram rodados 2 sub-agentes em paralelo:
- **Plan agent (frontend-sales-review)** — punch list de 25+ achados sobre tipografia, conversão, brand coherence, polish premium.
- **General-purpose agent (simplify)** — punch list de 11 achados sobre dead code, font-mono semanticamente errado, duplicação de estilos, CSS vars não consumidas.

Aplicados todos os blockers e maioria dos importants. Nits documentados.

### Auditoria — HomeOficial_AuraTech.tsx (em AuraAUDIT)

Marcos pediu pra verificar se já existia "motor de marketplace pronto". Verificação:
- Pasta `AuraDUE/` local: vazia (só docs).
- URL `https://auradue.replit.app` (declarada como AuraMARKET ativo): **HTTP 404**.
- URLs Replit dos módulos `active` em `HomeOficial_AuraTech.tsx`: **TODAS retornam 404** (auradue, auraloa, auracarbo, aurarisk).
- Apenas `https://loa.auradue.com` está vivo (200).

**Conclusão**: AuraMARKET é marca declarada nos contratos AuraTECH mas não há código de marketplace funcional implementado. 7 de 8 módulos catalogados como `active` apontam pra URLs Replit mortas.

**Decisão DPO**: não corrigir nesta sessão. Salvo em `memory/project_home_oficial_auratech.md` com auditoria completa pra próxima sessão dedicada.

### Validação técnica
- `npx tsc --noEmit`: zero erros no `client/`. (Erros pré-existentes em `server/` — billing_auraloa, due_diligence_viewer, kyc_nda — não regressão).
- `npm run build`: passou em 19.93s (client) + 6511ms (server) + 8ms (evidence_pack). Bundle: `dist/index.cjs` 1.3MB; CSS 123KB / 19KB gzip; index.js 1.57MB / 443KB gzip.
- Bundle prod local (`node --env-file=.env dist/index.cjs`): subiu, conectou ao DB Hetzner, respondeu HTTP 200 em `/` e `/marketplace`.
- HMR Vite durante toda a sessão: limpo, sem warnings.

### Estado de produção
`loa.auradue.com` **não foi tocada** nesta sessão. Marcos não autorizou deploy. Build local validado e parado ao final da sessão.

### Pendências priorizadas (próxima sessão)
- **P1** Deploy Hetzner do landing refatorado (carece autorização Marcos)
- **P2** Auditoria + correção de `HomeOficial_AuraTech.tsx` (URLs Replit mortas + status falso `active` em 7 módulos)
- **P2** Decisão sobre AuraMARKET — manter `/marketplace` como porta de captação ou construir motor real (schema + rotas + KYC + matching)
- **P3** Wrapper de framing pro `<ValidadorPreliminarLOA />` (eyebrow/H2/microcopy de privacidade) pra subir conversão
- **P3** Tokenizar magic numbers (letter-spacing) e hex backgrounds (`bg-[hsl(...)]` × 5) em CSS vars
- **P3** Topbar/Footer públicos — review próprio (compartilhados entre páginas)
- **P4** Limpar git status — sessão anterior (27/04) deixou 10 modificados + 11 untracked sem commit; ciclo de governança Git pendente

