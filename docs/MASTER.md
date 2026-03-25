# AuraLOA — Documento Técnico Master
> Versão: 1.0 — 25/03/2026
> Finalidade: Onboarding de agentes de IA, anti-regressão e anti-alucinação

---

## 1. IDENTIDADE DO PRODUTO

**AuraLOA** é uma plataforma brasileira de inteligência sobre precatórios judiciais.

Missão: validar autenticidade de documentos (ofícios requisitórios, precatórios, RPVs), verificar situação jurídica e orçamentária, e conectar investidores a ativos verificados.

Faz parte do ecossistema **AuraTECH** — infraestrutura digital de confiança baseada em evidências.

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
│       └── landing.tsx
├── server/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── stripe_routes.ts
│   │   ├── loa_estoque.ts
│   │   └── analise_documento.ts
│   ├── services/
│   │   ├── estoque_datajud.ts
│   │   ├── estoque_tribunais.ts
│   │   ├── siop_dotacao.ts
│   │   ├── analysis-engine-br.ts
│   │   ├── stripe.ts
│   │   └── evidence_pack.ts
│   ├── db.ts
│   └── db_init.ts
├── shared/
│   ├── schema.ts
│   ├── loa_types.ts
│   └── plans.ts
└── docs/
    ├── CONTEXT.md
    └── MASTER.md
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
- loa_history — histórico de consultas
- source_snapshots — snapshots com SHA-256
- job_runs — controle de jobs

---

## 5. AUTENTICAÇÃO

- Sistema: Bearer token Base64
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
4. pdf-parse — sempre usar createRequire, nunca import direto
5. CLASSE_PRECATORIO=1265 e CLASSE_RPV=1266

SEMPRE executar após qualquer alteração:
```
npx tsc --noEmit
```

---

## 10. VARIÁVEIS DE AMBIENTE

- PG_URL — conexão PostgreSQL Hetzner
- DATAJUD_API_KEY — chave API DataJud CNJ
- PORTAL_TRANSPARENCIA_API_KEY — chave Portal Transparência
- STRIPE_SECRET_KEY — sk_test_... ou sk_live_...
- STRIPE_PUBLISHABLE_KEY — pk_test_... ou pk_live_...
- STRIPE_WEBHOOK_SECRET — preencher após configurar webhook
- BASE_URL — URL base (localhost em dev, domínio em produção)

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
