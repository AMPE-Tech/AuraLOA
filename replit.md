# AuraLOA - Modulo de Pesquisa de Precatorios na LOA

## Overview
AuraLOA is a specialized module for researching and presenting precatorios (court-ordered payments) inscribed in the LOA (Annual Budget Law). Implements the Federal (Union) level with 4 data layers: (1) Dotação/SIOP, (2) Execução/Portal da Transparência, (3) Estoque/CNJ DataJud, and (4) Gap Analysis crossing all three.

## Project Architecture

### Frontend (React + Vite)
- `client/src/pages/loa-dashboard.tsx` - Main dashboard with year selector, results display, KPIs, evidence trail, Estoque CNJ panel, and Gap Analysis panel
- `client/src/pages/precatorios-pendentes.tsx` - Dedicated page for pending precatórios with tribunal consultation links and ofício requisitório access
- `client/src/App.tsx` - Routes configuration (/, /pendentes)

### Backend (Express)
- `server/routes/loa_uniao_a2.ts` - Main endpoint `POST /api/loa/uniao/a2` and history/catalog endpoints
- `server/routes/loa_estoque.ts` - Estoque and Gap Analysis endpoints
- `server/catalog/acoes_precatorios_uniao.ts` - Catalog of 7 precatório actions (0005, 0EC7, 0EC8, 0625, 00WU, 00G5, 0022)
- `server/services/transparencia_execucao.ts` - Portal da Transparência REST API integration (`/api-de-dados/despesas/por-funcional-programatica`)
- `server/services/transparencia_download.ts` - ZIP download from Portal da Transparência (`dadosabertos-download.cgu.gov.br`)
- `server/services/a2_execucao_from_zip.ts` - **DPO block**: parses execution (PAGO+LIQUIDADO) from ZIP CSVs via join Pagamento_EmpenhosImpactados + Liquidacao_EmpenhosImpactados + Empenho
- `server/services/siop_dotacao.ts` - Dotação via SPARQL (orcamento.dados.gov.br + SIOP fallback)
- `server/services/estoque_datajud.ts` - CNJ DataJud Elasticsearch API provider for court process stock (Camada 3)
- `server/services/estoque_tribunais.ts` - Estoque orchestrator with provider fallback (datajud → csv → scraping stub)
- `server/services/gap_analysis.ts` - Cross-references Dotação x Execução x Estoque (Camada 4)
- `server/services/cron_download.ts` - Automatic monthly batch download scheduler (runs day 1 at 03:00)
- `server/services/evidence_pack.ts` - Evidence pack system (SHA-256 hashes, file saving)
- `server/services/validate_output.ts` - Output validation

### Shared Types
- `shared/loa_types.ts` - All TypeScript interfaces for A2, Estoque, and Gap Analysis modules

### Evidence System
- Evidence packs saved to `./Saida/evidence/{process_id_uuid}/`
- Each pack contains: request.json, response.json, raw/ folder, hashes.json, run.log
- ZIP files saved to `raw/YYYYMM01_Despesas.zip` with SHA-256 hash
- All data has SHA-256 hashes for auditability

## API Endpoints
- `POST /api/loa/uniao/a2` - Execute A2 analysis (input: `{ ano_exercicio: number, mes?: number }`)
- `GET /api/loa/uniao/a2/history` - Get recent consultation history
- `GET /api/loa/uniao/a2/catalog` - Get catalog of precatório actions
- `POST /api/loa/uniao/a2/batch-download` - Download all 12 months ZIPs for a year
- `GET /api/loa/uniao/a2/cron/status` - Check cron scheduler status
- `POST /api/loa/uniao/a2/cron/start` - Start monthly auto-download
- `POST /api/loa/uniao/a2/cron/stop` - Stop monthly auto-download
- `POST /api/loa/uniao/estoque` - Query CNJ DataJud estoque (input: `{ ano_exercicio: number, max_por_tribunal?: number }`)
- `POST /api/loa/uniao/gap-analysis` - Cross Dotação x Execução x Estoque (input: `{ ano_exercicio: number, mes?: number }`)
- `POST /api/loa/uniao/precatorios-pendentes` - Filter pending precatórios only (input: `{ ano_exercicio: number, max_por_tribunal?: number }`)

## Data Sources
- **Execução (Empenho/Liquidação/Pagamento)**: Portal da Transparência REST API - requires API key (env: PORTAL_TRANSPARENCIA_API_KEY). Uses endpoint `/api-de-dados/despesas/por-funcional-programatica` with `chave-api-dados` header.
- **Dotação (Orçamento LOA)**: SPARQL endpoints - orcamento.dados.gov.br (public, data up to ~2016) and SIOP SPARQL (blocked by Cloudflare from external environments). Dotação for years >2016 currently unavailable via automated query.
- **ZIP Downloads**: `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/YYYYMM01_Despesas.zip` - Monthly despesas ZIP files with evidence tracking
- **Estoque (CNJ DataJud)**: Public Elasticsearch API at `https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search`. Uses class codes 1265 (Precatório) and 1266 (RPV). Federal tribunals: TRF1-TRF6. TRF3/TRF4/TRF6 have data; TRF1/TRF2/TRF5 return empty.

## Precatório Actions Catalog (2025)
- 0005 - Sentenças Judiciais Transitadas em Julgado (Precatórios)
- 0EC7 - Precatórios Relativos à Complementação da União ao FUNDEF
- 0EC8 - Precatórios Parcelados ou Objetos de Acordos
- 0625 - Sentenças Judiciais de Pequeno Valor (RPV) - **has significant execution data**
- 00WU - Precatórios Excedentes ao Sublimite
- 00G5 - Contribuição Previdenciária sobre Pagamento de Precatórios/RPV
- 0022 - Sentenças Judiciais Devidas por Empresas Estatais - **has execution data**

## Key Decisions
- Portal da Transparência REST API is the primary source for execution data (replaces CSV download which is blocked by CDN)
- SIOP SPARQL endpoint is blocked by Cloudflare WAF from external environments; orcamento.dados.gov.br only has data up to ~2016
- System gracefully degrades to PARCIAL/NAO_LOCALIZADO status when sources are unavailable
- No mock data - all values come from real government sources or are explicitly marked as unavailable
- ZIP downloads are server-side with full evidence pack integration (SHA-256, file paths, HTTP status)
- Automatic monthly cron runs on day 1 at 03:00 to download all 12 ZIPs
- CNJ DataJud is primary estoque provider; CSV secondary, scraping tertiary (feature flag)
- Estoque retrieves full court backlog (all years), not filtered by single year
- Federal tribunals TRF1-TRF6 as primary targets
- Provider pattern for estoque with graceful degradation and evidence tracking per provider
- Gap Analysis crosses all 3 layers per precatório action with coverage metrics
