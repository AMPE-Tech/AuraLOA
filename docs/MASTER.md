# AuraLOA — Documento Técnico Master
> Versão: 1.0 — 25/03/2026
> Finalidade: Onboarding de agentes de IA, anti-regressão e anti-alucinação

---

## 1. IDENTIDADE DO PRODUTO

**AuraLOA** é uma plataforma brasileira de inteligência sobre precatórios judiciais.

Missão: validar autenticidade de documentos (ofícios requisitórios, precatórios, RPVs), verificar situação jurídica e orçamentária, e conectar investidores a ativos verificados.

Faz parte do ecossistema **AuraTECH** — infraestrutura digital de confiança baseada em evidências.

- **Produção:** https://loa.auradue.com
- **Servidor:** Hetzner VPS · ssh root@178.104.66.47 · /var/www/auraloa · PM2 + Nginx + SSL
- **Repositório:** github.com/AMPE-Tech/AuraLOA
- **Local:** c:\Users\MarcosCosta\OneDrive - CTS Brasil\Área de Trabalho\ClaudeCode\AuraLOA

---

## 2. STACK TÉCNICO

| Camada | Tecnologia | Observação |
|--------|-----------|------------|
| Runtime | Node.js v24 | PATH issues no Windows — usar powershell.exe |
| Backend | Express 5 + TypeScript 5.6 | ESM — usar createRequire para módulos CJS |
| Frontend | React 18 + Vite 7 | |
| ORM | Drizzle ORM + drizzle-zod | Schema em shared/schema.ts |
| Banco | PostgreSQL (Hetzner) | Conexão via PG_URL no .env |
| Dev | tsx --env-file=.env | cross-env NODE_ENV=development |
| Pagamentos | Stripe SDK v20+ | apiVersion: "2026-02-25.clover" |

### Comando para iniciar
```powershell
cd "c:\Users\MarcosCosta\OneDrive - CTS Brasil\Área de Trabalho\ClaudeCode\AuraLOA"
npm run dev
```

---

## 3. ARQUITETURA DE PASTAS
```
AuraLOA/
├── client/src/
│   ├── components/
│   │   └── validador-preliminar.tsx
│   └── pages/
│       ├── landing.tsx
│       ├── login.tsx
│       ├── loa-dashboard.tsx
│       ├── precatorios-pendentes.tsx
│       ├── contrato-tecnico.tsx
│       ├── sp-dashboard.tsx
│       └── admin.tsx
├── server/
│   ├── index.ts
│   ├── db.ts
│   ├── db_init.ts
│   ├── storage.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── stripe_routes.ts
│   │   ├── loa_estoque.ts
│   │   ├── loa_uniao_a2.ts
│   │   ├── loa_sp.ts
│   │   ├── loa_dpo.ts
│   │   ├── validador.ts             (/api/validador/verificar)
│   │   └── analise_documento.ts     (/api/analise/documento-pdf)
│   └── services/
│       ├── estoque_datajud.ts       (FONTE CENTRAL — 549 linhas)
│       ├── estoque_tribunais.ts     (ORQUESTRADOR — 200 linhas)
│       ├── valor_precatorio_pdf.ts
│       ├── siop_dotacao.ts
│       ├── transparencia_execucao.ts
│       ├── analysis-engine-br.ts
│       ├── stripe.ts
│       ├── laudo_pdf.ts
│       └── evidence_pack.ts
├── shared/
│   ├── schema.ts
│   ├── loa_types.ts
│   └── plans.ts
├── docs/
│   ├── CONTEXT.md
│   └── MASTER.md
└── Saida/evidence/                  ← NÃO commitar (git rm --cached)
```

---

## 4. BANCO DE DADOS

### Tabela principal: aura_users
- Chave primária: email (não id)
- NÃO usar drizzle-kit push — usa SQL puro via db_init.ts
- Novas colunas sempre via ALTER TABLE IF NOT EXISTS em db_init.ts

### Campos Stripe adicionados em 25/03/2026
- stripe_customer_id TEXT UNIQUE
- stripe_subscription_id TEXT
- subscription_status TEXT DEFAULT 'free'
- plan TEXT DEFAULT 'free'
- plan_expires_at TIMESTAMPTZ

### Outras tabelas
- document_validations — análise heurística de PDF
- document_suspects — documentos bloqueados (score < 50)
- pesquisas_validador — histórico de todas as pesquisas por CNJ (criada em 30/03/2026)
- loa_history — histórico de consultas
- source_snapshots — snapshots com SHA-256
- job_runs — controle de jobs

---

## 5. AUTENTICAÇÃO

- Sistema: JWT (jsonwebtoken) com expiração de 7 dias — alterar JWT_EXPIRATION em auth.ts
- Hash de senha: bcrypt (12 rounds) com migração automática de hashes SHA256 legados no login
- Middleware: requireAuth em server/routes/auth.ts
- Acesso: (req as any).authUser.email
- NÃO usa req.session

---

## 6. PLANOS E PREÇOS

| ID | Nome | Mensal | Consultas |
|----|------|--------|-----------|
| free | Free | R$ 0 | 3 (qualidade Business) |
| essencial | Essencial | R$ 147 | 3 |
| professional | Professional | R$ 399 | 6 |
| business | Business | R$ 899 | 10 |
| enterprise | Enterprise | R$ 1.599 | 20 |
| enterprise_plus | Enterprise Plus | Sob consulta | Personalizado |

### Price IDs Stripe (modo teste)
- Essencial Mensal: price_1TEl5CFaeVcV75CQFj99g9gZ
- Essencial Anual: price_1TEl66FaeVcV75CQ8EudxFY8
- Professional Mensal: price_1TEl8fFaeVcV75CQzFshPfJ5
- Professional Anual: price_1TElDIFaeVcV75CQP4UjoMHe
- Business Mensal: price_1TElI7FaeVcV75CQgj3rn9JX
- Business Anual: price_1TElK8FaeVcV75CQnl3Pjqdr
- Enterprise Mensal: price_1TElOoFaeVcV75CQiHNhc6U1
- Enterprise Anual: price_1TElQXFaeVcV75CQ4zht5MfD
- Enterprise Plus: price_1TElTrFaeVcV75CQEUpwIdxE

---

## 7. FONTES DE DADOS

| Fonte | Arquivo | Status |
|-------|---------|--------|
| DataJud CNJ | estoque_datajud.ts | Ativo |
| Portal Transparência | siop_dotacao.ts | INDISPONÍVEL — retorna zeros |
| Análise Heurística | analysis-engine-br.ts | Ativo — 10 regras |

---

## 7-A. PIPELINE DE PESQUISA — ESTADO ATUAL (29/03/2026)

### Fluxo completo
```
Entrada (PDF upload — ofício requisitório ou documento do processo)
  → pdf-parse backend (extração CNJ, 7 padrões regex)
  → extrairTribunalDoCNJ() — J=4→TRF1-6, J=8+TT→27 TJs estaduais
  → consultarTribunal() / fetchEstoqueFromDataJud()
  → CNJ DataJud API (api-publica.datajud.cnj.jus.br)
  → enriquecimento PDF (valor_precatorio_pdf.ts) — só trf1-trf6 + tjsp
  → fetchDotacaoFromSIOP()
  → evidence_pack.ts (UUID + SHA-256)
  → Saída: landing (público, 3 grátis) / dashboard (autenticado)
```

### Status por tribunal (DataJud) — CORRIGIDO 23/04/2026 tarde

⚠️ **A afirmação anterior "TRF1/TRF2/TRF5 indisponíveis" estava INCORRETA.** Validação empírica via API direta em 23/04/2026 (CNJ Santa Casa `1061297-10.2020.4.01.3400` TRF1 retornou 2 hits com 117 movimentos) provou que:

1. **DataJud TRF1 FUNCIONA** para busca por `numeroProcesso`
2. **No TRF1 NÃO existe classe 1265 (Precatório)** — precatório é FASE dentro da classe 156 / 12078 (Cumprimento de Sentença contra a Fazenda Pública)
3. **Bug real identificado:** `consultarTribunal()` passava CNJ com pontuação (`1061297-10.2020.4.01.3400`); DataJud indexa só dígitos (`10612971020204013400`). **Corrigido**.

| Tribunal | Status DataJud (por numeroProcesso) | Observação |
|---|---|---|
| TRF1 | ✅ OK (validado 23/04/2026) | Classes usadas: 156, 12078, 1208 (agravo), 1728 (apelação) — NÃO usa 1265 |
| TRF2 | ⚠️ A revalidar | Afirmação antiga era errada — refazer teste |
| TRF3 | ✅ OK | Verificar se usa classe 1265 ou outra |
| TRF4 | ✅ OK | Retorna dados reais |
| TRF5 | ⚠️ A revalidar | Afirmação antiga era errada — refazer teste |
| TRF6 | ✅ OK | Retorna dados reais |
| TJSP | ✅ OK | Conectado e funcionando |
| TJRJ | ⚠️ Numeração interna (ex: 2024.09516-4) — DataJud pode indexar o CNJ mapeado, precisa teste específico |
| TJMG, TJRS, TJPR, TJSC, TJBA, TJAM | ⚠️ A validar | Declarados no código, não testados |

**Regra técnica para qualquer tribunal no DataJud:**
```
Query correta: { match: { numeroProcesso: "<20 dígitos sem pontuação>" } }
Query errada:  { match: { numeroProcesso: "NNNNNNN-DD.AAAA.J.TT.OOOO" } }
```

### Gaps pendentes — fila de evolução

1. ❌ DOU / Diários Oficiais estaduais — não implementados (cessão, LOA, publicações)
2. ❌ TJRJ — DataJud retorna 0; fallback = URL do documento + portal manual; solução futura: scraping por número interno
3. ❌ TRF1/2/5 — LIMITAÇÃO DE FONTE: DataJud HTTP 200 com total=0 para classes 1265/1266. Problema no CNJ, não no código. Monitorar.
4. ✅ pdfParse — RESOLVIDO: createRequire + fileURLToPath implementado em analise_documento.ts
5. ⚠️ Providers alternativos — CSV/scraping declarados no código, não implementados
6. ⚠️ Stripe — webhook configurado, integração de assinatura e liberação PRO incompleta
7. ✅ Rate limit/cache — RESOLVIDO: implementado em validador.ts (10 req/min por IP, TTL 5min por CNJ)

---

## 8. MOTOR DE ANÁLISE (analysis-engine-br.ts)

- APROVADO >= 80 pontos
- VERIFICAR 50-79 pontos
- SUSPEITO < 50 pontos
- 10 regras: CNJ, tribunal, juiz, credor, CPF/CNPJ, devedor, valor, URL, assinatura, QR code
- CRÍTICO: normalização de espaços no CNJ — nunca remover

---

## 9. REGRAS ANTI-REGRESSÃO

NUNCA alterar sem revisar:
1. extrairCNJ() e runBRAnalysis() — normalização de espaços é crítica
2. db_init.ts — sempre IF NOT EXISTS
3. aura_users — chave primária é email, não id
4. pdf-parse — sempre usar createRequire + fileURLToPath(import.meta.url), nunca import direto
5. CLASSE_PRECATORIO=1265 e CLASSE_RPV=1266
6. DATAJUD_API_KEY — não usar fallback hardcoded; variável obrigatória no .env
7. SSL banco Hetzner: rejectUnauthorized: false (certificado autoassinado — CN=ubuntu-4gb-nbg1-3)
8. hashPassword() é async (bcrypt) — sempre usar await nas chamadas
9. **Drivers .cjs (`server/scripts/robo_pje/drivers/trf1.cjs` e `enriquecer_precatorio_cnpj.cjs`) dependem de `dist/lib/evidence_pack.cjs` — sempre rodar `npm run build` antes de executar drivers após mexer em `server/services/evidence_pack.ts`. Drivers abortam com mensagem clara se o bundle não existir. Ref: contrato_tecnico/aditivos/aditivo_2026-04-24_fase3.md.**

SEMPRE executar após qualquer alteração:
```
npx tsc --noEmit
```

### POLÍTICA DE SEGURANÇA DE DEPLOY — OBRIGATÓRIA

PROIBIDO sem aprovação explícita de Marcos:
- Alterar format do build (cjs/esm)
- Alterar outfile/outdir do esbuild
- Alterar script "start" do package.json
- Alterar qualquer linha de createRequire/import.meta.url
- Alterar configuração do PM2 no servidor

ANTES de qualquer alteração em script/build.ts ou package.json:
1. Perguntar: "isso pode afetar o deploy em produção?"
2. Mostrar exatamente o que será alterado
3. Aguardar OK explícito de Marcos
4. Nunca executar npm run build no servidor sem confirmar que o processo PM2 está configurado

DEPLOY CORRETO (única sequência válida):
```
ssh root@178.104.66.47
cd /var/www/auraloa          ← DIRETÓRIO CORRETO (não /opt/auraloa)
git pull origin main
npm run build
pm2 restart auraloa
```

Se pm2 restart falhar: usar pm2 delete auraloa + export $(grep -v '^#' .env | xargs) + pm2 start dist/index.cjs --name auraloa + pm2 save
PM2 não carrega .env automaticamente — usar export $(grep -v '^#' .env | xargs) antes do pm2 start.

ATENÇÃO: /opt/auraloa NÃO é o projeto — contém apenas node_modules de teste. Projeto real está em /var/www/auraloa.

---

## 10. VARIÁVEIS DE AMBIENTE

- PG_URL — conexão PostgreSQL Hetzner
- DATAJUD_API_KEY — chave API DataJud CNJ
- PORTAL_TRANSPARENCIA_API_KEY — chave Portal Transparência
- STRIPE_SECRET_KEY — sk_test_... ou sk_live_...
- STRIPE_PUBLISHABLE_KEY — pk_test_... ou pk_live_...
- STRIPE_WEBHOOK_SECRET — preencher após configurar webhook
- BASE_URL — URL base (localhost em dev, domínio em produção)
- JWT_SECRET — chave de assinatura JWT

---

## 11. FLUXO ONBOARDING NOVO AGENTE

1. Ler docs/MASTER.md (este arquivo)
2. Ler docs/CONTEXT.md para backlog atual
3. Executar: npx tsc --noEmit
4. Subir servidor: npm run dev
5. Confirmar http://localhost:5000 responde
6. Iniciar pelo primeiro item pendente do CONTEXT.md

---

## 12. HISTÓRICO

### 24/03/2026
- Migração banco para Hetzner
- Motor análise heurística (10 regras)
- 5 bugs corrigidos em estoque_datajud.ts
- TJSP adicionado ao pipeline
- Integração Stripe completa

### 25/03/2026
- 6 planos estruturados com Price IDs
- shared/plans.ts criado
- Colunas Stripe em aura_users
- MASTER.md criado

### 28-29/03/2026 — Sessão de segurança e pipeline
**Segurança:**
- auth.ts: SHA256 → bcrypt (12 rounds) + JWT 7 dias (jsonwebtoken) com migração automática de hashes legados
- estoque_datajud.ts: removida API key hardcoded — obrigatória via DATAJUD_API_KEY no .env
- evidence_pack.ts: path traversal corrigido — filename sanitizado antes de writeFile
- estoque_datajud.ts: JSON.parse protegido com try-catch local
- analise_documento.ts: createRequire corrigido para fileURLToPath(import.meta.url)

**Performance:**
- fetchPrecatorioByNumero(): consultas aos tribunais paralelas (Promise.all) — de até 112s para ~8s

**Rate limiting & cache (validador.ts):**
- Rate limit por IP: 10 req/min, resposta 429 com Retry-After
- Cache de resultados por CNJ: TTL 5 minutos
- Frontend lê X-RateLimit-Remaining do servidor (não mais só sessionStorage)

**Geração de PDF:**
- Novo serviço: server/services/laudo_pdf.ts (pdfkit)
- Novo endpoint: POST /api/loa/uniao/estoque/pdf
- Laudo técnico formal: cabeçalho, resumo, tabelas, SHA-256, fontes, rodapé paginado

**Infraestrutura:**
- DATAJUD_API_KEY adicionada ao .env
- Dependências adicionadas: bcrypt, jsonwebtoken, pdfkit (+ @types)

### 30/03/2026 — Padronização visual completa + AppTopbar unificado

**Dark theme — tokens fixos aplicados em todas as páginas:**
- CSS variables .dark{}: background #0d1117 (215 28% 7%), card #161b22, primary cyan #06b6d4, secondary violet #7c3aed
- KPICards.tsx: reescrito com 7 variantes de cor, borda superior 2px por variante, ícone badge
- GraficosDashboard.tsx: reescrito — LineChart → AreaChart com gradiente, grid sutil, tooltip dark customizado
- not-found.tsx: 404 dark com texto gradiente cyan→violet

**Logo padrão AuraLOA:** Scale icon + linear-gradient(135deg, #06b6d4, #7c3aed) + "AuraLOA" — aplicado em login, dashboard, admin, not-found

**Footer AuraTECH (imutável):** Shield + bg-primary (azul) + "AuraTECH" — nunca alterar, pertence ao ecossistema, não ao módulo

**AppTopbar** (`client/src/components/app-topbar.tsx`):
- Componente unificado para TODAS as páginas internas (loa, sp, admin, pendentes, contrato)
- Sticky glassmorphism: rgba(13,20,32,0.97) + backdrop-filter blur(10px) + border rgba(255,255,255,0.06)
- Tabs navegáveis com active state cyan (underline 2px + text #22d3ee)
- Admin tab visível apenas para role=admin
- Substituiu 5 headers inline díspares

**Autenticação expandida:**
- POST /api/auth/register — auto-cadastro público (role='user', plan='free')
- POST /api/auth/forgot-password — token 32-byte hex, 1h expiry, link no console (SMTP TODO)
- POST /api/auth/reset-password — valida token, atualiza bcrypt hash
- login.tsx: 4 views (login | register | forgot | reset), inicializado via ?token= na URL
- Senha admin resetada para AuraLOA@2026 (marcos@auradue.com)

**Relatório de due diligence:**
- docs/auratech-tokens.json — design tokens completos
- docs/auratech-report.css — variáveis CSS para relatórios HTML
- client/src/components/ReportTemplate.tsx — componente React tipado
- docs/auraLOA_dark_report_FINAL.html — relatório Montichiari D1 (dark, 7 seções, Chart.js)

### 30/03/2026 — Instalação massiva de skills globais
- 25 skills instaladas em C:\Users\MarcosCosta\.claude\skills\
- Fontes: Anthropic oficial, obra/superpowers, remotion-dev, nextlevelbuilder, zubair-trabzada, coreyhaines31, JoelLewis, alirezarezvani
- Skill customizada auratech-workflow criada com 7 agentes especializados
- Cobertura: desenvolvimento, design UI/UX, marketing digital, vídeo, finanças, compliance, due diligence
- Próximo passo: desenvolver modelo de relatório de due diligence no AuraLOA usando skills financial-analysis + private-equity

### 30/03/2026 — Dashboard: correção de bugs + restauração de componentes

**5 bugs corrigidos em dashboard.tsx:**
- `usuarioInfo` hardcoded (marcos@cstbrasil.com, plano fixo) → dinâmico via `localStorage` + fetch `/api/auth/me` na montagem
- Botão "Sair" sem onClick → limpa chaves `aura_*` do localStorage + navigate("/")
- `STATUS_CORES` (Tailwind classes) usadas como `className` em componente inline-style → substituídas por `STATUS_COLOR_MAP` com valores hex reais
- `KPICards` importado mas nunca usado no JSX → causa raiz identificada: reescrita inline do dark theme suprimiu o componente; removido import morto e depois restaurado corretamente
- `dark` state + toggle: componentes filhos têm tokens hardcoded — toggle era cosmético e quebrava visual → removido; tokens fixos canônicos aplicados

**Restauração de componentes suprimidos:**
- `KPICards` reativado → 7 KPIs (4 volume + 3 valor); Verificar + Suspeitos estavam invisíveis desde a reescrita inline
- `GraficosDashboard` reativado → CustomTooltip formatado, background nas barras do tribunal, `formatarValorAbrev`
- Tokens alinhados ao design system: `bg=#0d1117`, `surface=#162032`, `border=rgba(255,255,255,0.07)`

**Melhorias de dados:**
- Coluna Tipo (RPV/PRECATORIO) adicionada na tabela com badges coloridos
- Campo de busca em tempo real (CNJ, credor, tribunal)
- Dark mode toggle removido do topbar

**Pendente crítico:** endpoint real `/api/dashboard/precatorios` — dashboard ainda usa `gerarDadosExemplo()` (mock)

### 30/03/2026 — Incident de produção e correção de deploy
- Site estava fora do ar (causa: import.meta.url vazio no bundle CJS)
- Tentativa de migrar para ESM quebrou produção (Dynamic require incompatível)
- Revertido para CJS com fallback `__filename` no createRequire (analise_documento.ts)
- PM2 não carrega .env automaticamente — resolvido com `export $(grep -v '^#' .env | xargs)`
- Sequência de deploy correta documentada e bloqueada contra regressão (seção 9)
- Lição: nunca alterar build/deploy sem testar localmente e confirmar com Marcos

### 29/03/2026 — Mapeamento de pipeline e documentação
- Leitura completa de estoque_datajud.ts (549 linhas) e estoque_tribunais.ts (200 linhas)
- Mapeado pipeline completo: DataJud → enriquecimento PDF → SIOP → EvidencePack
- Confirmado: extrairTribunalDoCNJ() cobre J=4 (TRF) e J=8 (27 TJs estaduais via tabela TT)
- Confirmado: TJRJ usa numeração interna — DataJud retorna 0 para classes 1265/1266
- Status detalhado por tribunal registrado na seção 7-A
- Relatório de due diligence HTML gerado (aura-loa-relatorio-due-diligence.html)
- MASTER.md atualizado com merge das duas versões

---

## 14. SKILLS GLOBAIS INSTALADAS (30/03/2026)

Skills instaladas em C:\Users\MarcosCosta\.claude\skills\ — disponíveis em TODOS os projetos AuraTECH.
**Total: 25 skills globais.**

### Desenvolvimento
| Skill | Fonte | Uso |
|---|---|---|
| docx | Anthropic oficial | Criar/editar Word profissional |
| pdf | Anthropic oficial | Análise de PDFs, precatórios, laudos |
| pptx | Anthropic oficial | Apresentações institucionais |
| xlsx | Anthropic oficial | Planilhas e análise de dados |
| frontend-design | Anthropic oficial | UI premium, evita design genérico |
| webapp-testing | Anthropic oficial | Testes automatizados com Playwright |
| skill-creator | Anthropic oficial | Criar skills customizadas |
| systematic-debugging | obra/superpowers | Debug estruturado — nunca pular para solução sem diagnóstico |
| test-driven-development | obra/superpowers | Testes antes do código |
| verification-before-completion | obra/superpowers | Verificar evidências antes de declarar tarefa concluída |
| requesting-code-review | obra/superpowers | Code review estruturado |

### Design UI/UX
| Skill | Fonte | Uso |
|---|---|---|
| ui-ux-pro-max | nextlevelbuilder | 50 estilos, 97 paletas, 57 font pairings, 9 stacks (React, Next.js, Tailwind, shadcn) |

### Marketing
| Skill | Fonte | Uso |
|---|---|---|
| market | zubair-trabzada | Orquestrador agência — /market audit, /market social, /market ads, /market report |
| market-skills | zubair-trabzada | 14 sub-skills: copy, emails, funil, SEO, proposta cliente, relatório PDF |
| marketingskills | coreyhaines31 | 34 skills — social-content (Instagram/TikTok/LinkedIn), paid-ads, copywriting, email-sequence, launch-strategy |

### Vídeo
| Skill | Fonte | Uso |
|---|---|---|
| remotion | remotion-dev | Criação de vídeos programáticos com React — /remotion |

### Finanças e Compliance
| Skill | Fonte | Uso |
|---|---|---|
| financial-analysis | Anthropic oficial | DCF models, análise de ativos, due diligence checklists |
| private-equity | Anthropic oficial | Due diligence PE, IC memos, análise de retorno |
| investment-banking | Anthropic oficial | CIMs, valuation, M&A workflows |
| wealth-management | Anthropic oficial | Gestão de portfólio, análise de risco, relatórios |
| finance-skills | JoelLewis | 84 skills: compliance SEC/FINRA, trading, operações, análise quantitativa |
| ra-qm-compliance | alirezarezvani | 13 skills de compliance regulatório e quality management |
| finance-analyst | alirezarezvani | Análise financeira com Python scripts |

### Customizada AuraTECH
| Skill | Fonte | Uso |
|---|---|---|
| auratech-workflow | AuraTECH customizada | Workflow 7 agentes: Brainstorm→GitWorktree→Plano→Execução→TDD→Review→Finalização |

### Repositórios fonte
- https://github.com/anthropics/skills
- https://github.com/obra/superpowers
- https://github.com/remotion-dev/remotion
- https://github.com/nextlevelbuilder/ui-ux-pro-max
- https://github.com/zubair-trabzada/market
- https://github.com/coreyhaines31/marketingskills
- https://github.com/JoelLewis/finance-skills
- https://github.com/alirezarezvani/ra-qm-compliance

Para adicionar novas skills: copiar pasta com SKILL.md para C:\Users\MarcosCosta\.claude\skills\
Para atualizar: git pull nos repositórios em C:\temp\ e copiar novamente.
Reiniciar VSCode após qualquer alteração nas skills.

---

## 13. PRINCÍPIOS DE DESENVOLVIMENTO

- Trabalhar sempre via VSCode + Claude Code extension (nunca PowerShell separado)
- Servidor local: `npm run dev` (porta 5000) no terminal integrado VSCode
- TypeScript: `npx tsc --noEmit` sem erros antes de qualquer commit
- Nunca commitar `Saida/` (evidências runtime) — já no .gitignore via `git rm --cached`
- Atualizar MASTER.md ao final de cada sessão
- Diagnose antes de iterar: solicitar dados brutos primeiro
- Sem alterações de layout não autorizadas
- Uma etapa por vez


## 23/04/2026 (madrugada) — Início da V2 Pipeline Freemium

**Decisão de produto:** após diagnóstico que achou 6 erros graves no pipeline de 17 fases (4 fases são stubs confessados no próprio JSON), Marcos decidiu reescrita completa. Saída da `fix/p0-p5-pipeline-correction` para branch limpa `feat/v2-pipeline-freemium` partindo de `main`.

**Princípios da V2:**
- Entrada APENAS por upload de PDF (zero digitação)
- 5 fases HONESTAS (vs 17 stubs antigas): DataJud + LOA CSV + BrasilAPI + Portal Transparência + PJe
- Extração via Claude Haiku 4.5 (substitui regex que falhava em 50% dos campos)
- OCR tesseract.js@7.0.0 como fallback quando pdf-parse retorna < 500 chars
- Auditoria embutida em 3 camadas (auto-verificação, checks cruzados, log imutável)
- Freemium: "pesquisa de realidade + atividade" = grátis; dados adicionais = pago por tier de valor
- Promoção Fundadores: 30% off vitalício nos 100 primeiros assinantes

**Entregas desta sessão:**
- Commit preservação WIP `585f37d` (fix/p0-p5)
- Branch `feat/v2-pipeline-freemium` criada de main
- `tesseract.js@7.0.0` instalado
- B1 Fundação commitado (`3c97153`): schema v2 + multer diskStorage + endpoint `POST /api/v2/analise` + LGPD + rate-limit + dedup SHA-256

**Estado técnico:**
- Branch ativa: `feat/v2-pipeline-freemium`
- Último commit: `3c97153`
- Produção Hetzner: **NÃO TOCADA**
- `.gitignore` ampliado (LGPD, dados pessoais, scripts debug, data pesada)
- Tabelas v2 criadas em dev (postgres local): `v2_analises`, `v2_audit_log`, `v2_membros_fundadores`, `v2_rate_limit`

**Pendências pra amanhã:** B2 (extração com Claude Haiku) → B3 (5 fases honestas) → B3.5 (auditoria) → B4 (freemium UX) → B5 (relatório completo). Detalhe em `memory/project_v2_pipeline_freemium.md`.

## 23-24/04/2026 (sessão maratona) — Pipeline V2 validado end-to-end

**Status:** 5 commits em `feat/v2-pipeline-freemium` + 6 arquivos pendentes commit.

**Principais marcos técnicos:**
- Pipeline V2 completo (upload → extração Haiku → consolidação → revisor 3 níveis → confirmação → enriquecimento F1/F2/F3 + URL oficial → relatório HTML + PDF ABNT).
- Revisor pós-extração com 7 checksums implementado e funcionando (detectou 2 bugs no Agrovale: duplicata FIDC + valor 2x inflado).
- Fix crítico DataJud TRF1: afirmação antiga do MASTER.md (seção 7-A) era FALSA. DataJud INDEXA TRF1 quando CNJ é passado como 20 dígitos sem pontuação. Correção aplicada em `fetchPrecatorioByNumero`. Agora traz 117 movimentos reais do processo Santa Casa.

**Custo real validado:**
- PDF 2 páginas texto nativo: ~R$ 0,02
- PDF 2 páginas escaneado (OCR Haiku): ~R$ 0,03
- PDF 12 páginas complexo (Agrovale 3 ofícios + 13 cessionários): ~R$ 0,24

**Testes reais:**
- Santa Casa R$ 235M (lote `oBq73QnWy9`) — auto-aprovado score 100/100
- Agrovale R$ 671M (lote `M8Q812qqvE`) — revisor score 64/100 com 2 alertas detectados

**Estado de produção:** `loa.auradue.com` NÃO TOCADA. V2 permanece em dev até cutover aprovado.

**Pendências:** detalhe em `memory/project_v2_sessao_23-24_abril_completo.md`.

## 27/04/2026 — Sessão DPO LOA 2026 Federal — 3 aditivos aplicados

**Tipo:** governança DPO (não é entrega de produto, não tocou em código de produção).

**Demanda original:** aplicar regra UO 10101 → 71103 nos consolidados LOA 2026. **Resultado:** regra **verificada como invariante** (32/32 linhas STF já aplicadas em ambos `_BR.csv` e `_INTL.csv`); nenhuma transformação UO necessária.

**Achado crítico colateral durante a auditoria:** `precatorios_loa_2026_consolidado_BR.csv` emitido pelo pipeline com **locale-INTL** (decimal `.`) apesar do nome `_BR`. Excel BR / Power BI BR / pandas-decimal-vírgula leem valores **10× errados**. Bug do producer upstream.

**Aditivos aplicados (Cláusula N1 do CONTRATO_TECNICO_MASTER):**
1. `aditivo_2026-04-27_extensao_manifesto_arquivos_saida.md` — saneamento estrutural; criou `manifesto_integridade_v2.json` estendendo o v1 com bloco `arquivos_saida[]`.
2. `aditivo_2026-04-27_fix_decimal_br_csv.md` — fix decimal local; criou `precatorios_loa_2026_consolidado_BR_v2_decimal_corrigido.csv` (decimal `,` 2 casas, `decimal_normalizado=true` em 79.156/79.156 linhas) e `manifesto_integridade_v3.json` (no diretório novo `CONCILIADO # 3-sim/`); validações Cláusulas 2.F (soma) e 2.G (idempotência) ambas OK.
3. `aditivo_2026-04-27_cobertura_xlsx_e_convencao.md` — patch de cobertura; criou `manifesto_integridade_v3.1.json` adicionando entrada do xlsx em `arquivos_saida[]` (era gap detectado pelo teste AuraTRUST) + bloco `convencao_diretorios`.

**Hashes oficiais finais (selo da entrega LOA 2026 Federal):**
- `manifesto_integridade.json` v1 (intocado): `f2983eccd0023094f01919e3e145c5f40de49a585ab43fbd9410f30a79cfcacf`
- `manifesto_integridade_v2.json`: `4f52f740caa9b4e3ea0411f9aa39bc09c04b95742c23e2a9baa99c6d7e419c9a`
- `manifesto_integridade_v3.json`: `0863c0fbc3b5a182030ff22f48eeff1e98672bc8dd711751512793f62c0be90e`
- `manifesto_integridade_v3.1.json`: `86ce097c6756072de81972cae468c761050c1d188fb536f8cd891dd5191ffbdb` ← **canônico final**
- `_BR_v2_decimal_corrigido.csv`: `991da5862690c87b375f5130473e2f743dc78ece2b60fa4803d452b3b79e34ce`
- Soma global preservada: R$ 22.306.037.833,00 (centavo a centavo).

**Validação AuraTRUST executada:** 66/66 arquivos declarados pelo manifesto v3.1 íntegros vs disco; 0 divergências.

**Achado anti-regressão crítico:** `CLAUDE.md` **ausente do projeto root** AuraLOA — verificação anti-regressão fica comprometida sem ele. **Decisão DPO:** criar na próxima sessão (envolve definição de conteúdo institucional).

**Pendências para próxima sessão (6):** ver `docs/sessions/session_close_2026-04-27.md` §8.

**Estado de produção:** `loa.auradue.com` NÃO TOCADA. Operação 100% sobre arquivos da entrega LOA 2026 Federal e governança documental.

**ADENDO 27/04 (encerramento):** meta-engenharia das skills `/session-start` e `/session-close` concluída. 11 patches aplicados (5 em start + 6 em close). Tier 4 (governança DPO + cadeia de custódia AuraTRUST) encaminhado para skill nova `/dpo-session-close` — **P0a da próxima sessão**. Aditivo formal das skills no AuraLOA é **P0b**. SHA finais: session-start `2647653b…`; session-close `61d401ae…`. Detalhes em `docs/sessions/session_close_2026-04-27.md` seção ADENDO.

---

## Histórico — 27/04/2026 (tarde) — DJEN como rota canônica de credor + advogado

### Mudança técnica relevante

Rota canônica de extração **credor + advogado + OAB** a partir de CNJ federal:
**API DJEN — `https://comunicaapi.pje.jus.br/api/v1/comunicacao`** (oficial CNJ, sem auth, sem captcha).

Substitui (para a maioria dos casos) os robôs Playwright PJe TRF1 que estavam restritos a 1 tribunal e exigiam scraping com captcha. DJEN cobre TRFs, TJs, TRTs, STJ. STF tem fluxo próprio (sequencial).

### Skill canônica criada
- **`djen_auraloa-enriquecer`** — método validado em 27/04 com 127/200 sucessos no top 200 LOA 2026. Schema completo + retry/backoff documentados. Localização: `~/.claude/skills/djen_auraloa-enriquecer/SKILL.md`.

### Diretriz vigente (memória `feedback_proibido_pagos_para_enriquecimento`)
NUNCA usar endpoints de pagamento realizado para enriquecer precatórios pendentes/empenhados. Lista explícita: `/recursos-recebidos`, `/despesas/documentos?fase=3`, `/despesas/documentos-por-favorecido?fase=3`. Permitidos: `fase=1` (empenho), `fase=2` (liquidação), `/pessoa-juridica`, `/contratos/cpf-cnpj`, `/orgaos-siafi`.

### Estado atual do projeto (não alterado nesta sessão)
- `loa.auradue.com` ONLINE (sessão 17/04 — última intervenção)
- Pipeline OCR blindado mantido
- CLAUDE.md AUSENTE no projeto root — achado da sessão DPO 27/04 manhã, ainda pendente
