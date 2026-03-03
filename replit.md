# AuraLOA - Modulo de Pesquisa de Precatorios na LOA

## Overview
AuraLOA is a specialized module for researching and presenting precatorios (court-ordered payments) inscribed in the LOA (Annual Budget Law). Implements the Federal (Union) level with 4 data layers: (1) Dotação/SIOP, (2) Execução/Portal da Transparência, (3) Estoque/CNJ DataJud, and (4) Gap Analysis crossing all three.

## Project Architecture

### Frontend (React + Vite)
- `client/src/pages/loa-dashboard.tsx` - Main dashboard with year selector, results display, KPIs, evidence trail, Estoque CNJ panel, and Gap Analysis panel
- `client/src/pages/precatorios-pendentes.tsx` - Dedicated page for pending precatórios with tribunal consultation links and ofício requisitório access
- `client/src/pages/contrato-tecnico.tsx` - Contrato Técnico Master page with DPO controls, anti-regression checks, audit log, and pipeline documentation
- `client/src/pages/sp-dashboard.tsx` - SP (Estado de São Paulo) dashboard with CSV import, TJSP scraping, and A2 conciliation
- `client/src/App.tsx` - Routes configuration (/, /pendentes, /contrato, /sp)

### Backend (Express)
- `server/routes/loa_uniao_a2.ts` - Main endpoint `POST /api/loa/uniao/a2` and history/catalog endpoints
- `server/routes/loa_estoque.ts` - Estoque and Gap Analysis endpoints
- `server/catalog/acoes_precatorios_uniao.ts` - Catalog of 7 precatório actions (0005, 0EC7, 0EC8, 0625, 00WU, 00G5, 0022)
- `server/services/transparencia_execucao.ts` - Portal da Transparência REST API integration (`/api-de-dados/despesas/por-funcional-programatica`)
- `server/services/transparencia_download.ts` - ZIP download from Portal da Transparência (`dadosabertos-download.cgu.gov.br`)
- `server/services/a2_execucao_from_zip.ts` - **DPO block**: parses execution (PAGO+LIQUIDADO) from ZIP CSVs via join Pagamento_EmpenhosImpactados + Liquidacao_EmpenhosImpactados + Empenho
- `server/services/siop_dotacao.ts` - Dotação via SPARQL (orcamento.dados.gov.br + SIOP fallback)
- `server/services/estoque_datajud.ts` - CNJ DataJud Elasticsearch API provider for court process stock (Camada 3)
- `server/services/estoque_tribunais.ts` - Estoque orchestrator with provider fallback (datajud → csv → scraping stub) and PDF valor enrichment
- `server/services/valor_precatorio_pdf.ts` - **DPO strategy**: Downloads and parses official tribunal PDFs (relação de precatórios para orçamento) to extract valores. Uses pdfjs-dist for parsing, regex extraction, caching, and SHA-256 evidence tracking
- `server/services/gap_analysis.ts` - Cross-references Dotação x Execução x Estoque (Camada 4)
- `server/services/dpo_guard.ts` - DPO authorization guard system (lock/unlock resources, audit log, integrity checks)
- `server/services/anti_regression.ts` - Anti-regression validation (baselines, metric comparison, violation detection)
- `server/services/anti_hallucination.ts` - Anti-hallucination guards (zero mock data, source validation, value evidence checks)
- `server/services/cron_download.ts` - Automatic monthly batch download scheduler (runs day 1 at 03:00)
- `server/services/evidence_pack.ts` - Evidence pack system (SHA-256 hashes, file saving)
- `server/services/validate_output.ts` - Output validation
- `server/routes/loa_dpo.ts` - DPO control, regression, cruzamento-completo, and contrato técnico endpoints
- `server/routes/loa_sp.ts` - SP (Estado de São Paulo) module: LOA import, despesas import, TJSP scraping, A2 conciliation
- `server/services/sp_tjsp.ts` - TJSP HTML scraping with evidence pack (pendentes + pagamentos)

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
- `POST /api/loa/uniao/estoque` - Query CNJ DataJud estoque (input: `{ ano_exercicio: number, tribunais?: string[], max_por_tribunal?: number }`)
- `POST /api/loa/uniao/estoque/csv` - Export estoque to CSV (input: `{ ano_exercicio: number, tribunais?: string[], max_por_tribunal?: number }`)
- `POST /api/loa/uniao/gap-analysis` - Cross Dotação x Execução x Estoque (input: `{ ano_exercicio: number, mes?: number }`)
- `POST /api/loa/uniao/precatorios-pendentes` - Filter pending precatórios only (input: `{ ano_exercicio: number, max_por_tribunal?: number }`)
- `POST /api/loa/uniao/cruzamento-completo` - Full 4-layer crossed evidence spreadsheet (Dotação x Execução x Estoque x Valores)
- `GET /api/loa/uniao/contrato-tecnico` - Contrato Técnico Master with all clauses
- `GET /api/loa/uniao/dpo/locks` - List DPO locks
- `POST /api/loa/uniao/dpo/lock` - Lock resource (requires DPO)
- `POST /api/loa/uniao/dpo/unlock` - Unlock resource (requires token)
- `POST /api/loa/uniao/dpo/check-integrity` - Verify SHA-256 integrity
- `GET /api/loa/uniao/dpo/audit-log` - DPO audit log
- `POST /api/loa/uniao/dpo/lock-all` - Lock all protected resources
- `POST /api/loa/uniao/regression/check` - Anti-regression check
- `POST /api/loa/uniao/regression/baseline` - Save regression baseline
- `POST /api/sp/loa/import` - Import LOA SP CSV (input: `{ ano, csvText, delimiter? }`)
- `POST /api/sp/despesas/import` - Import Despesas SP CSV (input: `{ ano, csvText, delimiter? }`)
- `GET /api/sp/tjsp/pendentes?entidade=X` - TJSP precatórios pendentes (HTML scraping)
- `GET /api/sp/tjsp/pagamentos?entidade=X` - TJSP pagamentos disponibilizados (HTML scraping)
- `POST /api/sp/a2` - A2 conciliation SP (input: `{ ano, orgao?, uo? }`)
- `GET /api/sp/status` - SP module status (imported data counts)
- `POST /api/sp/auto/execucao` - Auto-download execution CSV from Sefaz/SP (input: `{ ano: number }`)
- `POST /api/sp/auto/dotacao` - Auto-download dotação CSV from Sefaz/SP (input: `{ ano: number }`)
- `GET /api/sp/auto/anos` - List available years for auto-import (2011-current+1)
- `POST /api/sp/pendentes-datajud` - Query TJSP pendentes via CNJ DataJud (input: `{ ano_exercicio: number, max_por_tribunal?: number }`)

## Data Sources
- **Execução (Empenho/Liquidação/Pagamento)**: Portal da Transparência REST API - requires API key (env: PORTAL_TRANSPARENCIA_API_KEY). Uses endpoint `/api-de-dados/despesas/por-funcional-programatica` with `chave-api-dados` header.
- **Dotação (Orçamento LOA)**: SPARQL endpoints - orcamento.dados.gov.br (public, data up to ~2016) and SIOP SPARQL (blocked by Cloudflare from external environments). Dotação for years >2016 currently unavailable via automated query.
- **ZIP Downloads**: `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/YYYYMM01_Despesas.zip` - Monthly despesas ZIP files with evidence tracking
- **Estoque (CNJ DataJud)**: Public Elasticsearch API at `https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search`. Uses class codes 1265 (Precatório) and 1266 (RPV). Federal tribunals: TRF1-TRF6. TRF3/TRF4/TRF6 have data; TRF1/TRF2/TRF5 return empty. Also supports TJSP for SP state pendentes.
- **Consulta TJSP (eSAJ)**: `https://esaj.tjsp.jus.br/cpopg/open.do?processo.numero={CNJ}` for public case consultation.
- **Valores (PDF Oficial Tribunal)**: TRF6 publishes official PDF with precatório values for budget inclusion. URL: `https://portal.trf6.jus.br/wp-content/uploads/2024/05/precatorios-federias-trf6-orcamento-2025.pdf`. Parsed with pdfjs-dist, cached in `./Saida/cache/pdf_valores/`. Contains ~9500 entries with VALOR(R$) and preferência (IDOSO/NÃO/PcD).
- **SP Execução/Dotação (Sefaz/SP)**: Direct CSV download from `https://dworcamento.fazenda.sp.gov.br/DadosXML/{ANO}_INVESTIMENTOS_EXECUCAO_ORCAMENTO.csv` and `{ANO}_INVESTIMENTO_DOTACAO_INICIAL.csv`. No API key required. Data from 2011 onwards. Auto-identifies precatórios by keyword matching (precatório, sentença judicial, RPV, depósitos judiciais).
- **Consulta TRF6**: Per official TRF6 guidance, PJe cases should be consulted via TRF1 processual (`processual.trf1.jus.br`) with `secao=TRF6`; eProc cases via `eproc2g.trf6.jus.br`.

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
- SP module uses manual CSV import for LOA and Despesas (MVP strategy); TJSP scraping is best-effort HTML extraction
- SP module reuses existing evidence pack system (SHA-256, UUID) for full auditability
- Multi-ente architecture: `ente=UNIAO` for Federal, `ente=SP` for Estado de São Paulo
