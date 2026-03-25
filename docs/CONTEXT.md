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
DATABASE_URL=postgresql://...
DATAJUD_API_KEY=...   # opcional, tem fallback hardcoded
```

## Quirks de Desenvolvimento (Windows)

- Usar `cross-env NODE_ENV=development` no script dev
- Usar `tsx --env-file=.env` para carregar dotenv no ESM
- Servidor vinculado em `127.0.0.1` (sem `reusePort`)
- `pdf-parse` carregado via `createRequire` (módulo CJS em contexto ESM)
- Node.js em `C:\Program Files\nodejs\` — usar `powershell.exe` se `node` não estiver no PATH do bash

## Tribunais Suportados (DataJud)

`trf1`, `trf2`, `trf3`, `trf4`, `trf5`, `trf6`, `tjsp`

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
- [ ] Testar pipeline completo end-to-end (DataJud + Dotação + PDF)
- [ ] Corrigir integração Stripe
- [ ] Reorganizar UX do dashboard
- [ ] Cobertura TJ estaduais além do TJSP
- [ ] Busca em lote pós-assinatura (até 10 processos)

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
