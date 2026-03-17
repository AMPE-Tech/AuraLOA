# AuraLOA - Módulo de Pesquisa de Precatórios na LOA

### Overview
AuraLOA is a specialized module for researching and presenting precatorios (court-ordered payments) inscribed in the LOA (Annual Budget Law). It operates at the Federal (Union) level and integrates four data layers: Dotação/SIOP, Execução/Portal da Transparência, Estoque/CNJ DataJud, and a Gap Analysis that cross-references all three. The project aims to provide intelligent analysis of precatórios, offering tools for legal professionals, investors, and public managers to validate precatórios, track their lifecycle, and ensure transparency and auditability.

### User Preferences
I prefer iterative development and clear communication. Ask before making major architectural changes or significant modifications to existing features. I expect detailed explanations for complex technical decisions. Ensure all data is auditable with SHA-256 hashes and evidence packs. I prefer the system to degrade gracefully when data sources are unavailable, explicitly marking data as PARCIAL or NAO_LOCALIZADO rather than failing.

### System Architecture

**Frontend (React + Vite)**
-   **Layout**: Global sticky topbar and footer adhering to AuraTECH global standards. Public pages use a base template.
-   **Core Pages**:
    -   `LOA Dashboard`: Main dashboard with year selection, KPIs, evidence trails, CNJ Estoque, and Gap Analysis.
    -   `Pending Precatórios`: Dedicated page with tribunal consultation links.
    -   `Technical Contract`: Master page with DPO controls, anti-regression, and audit logs.
    -   `SP Dashboard`: For São Paulo state, featuring CSV import, TJSP scraping, and A2 conciliation.
    -   `Landing Page`: Public marketing page with market KPIs, LOA projections, and CTA.
    -   `Login`: Standard email/password authentication.
-   **UI/UX**: Layout containers expanded to `max-w-[1400px]`. Hero sections feature a gradient title and a visual pipeline for precatório lifecycle. KPI cards are full-width with descriptive subtexts. A "Free Verification" section for preliminary LOA validation. "Intelligence Modules" are presented as distinct cards with colored borders and enhanced descriptions. Terminology like "NPU" is replaced with "CNJ" for user-facing elements. Anti-Alucinação is an internal backend guard.

**Database (PostgreSQL)**
-   **Connection**: `server/db.ts` — pool + typed `query<T>()` helper.
-   **Initialization**: `server/db_init.ts` — runs on startup via `initDb()`, creates all tables and seeds the admin user if absent.
-   **Tables**: `aura_users` (auth), `loa_history` (A2 audit trail), `sp_loa_rows` (SP LOA CSV data), `sp_despesas_rows` (SP despesas CSV data).
-   **Storage**: `server/storage.ts` — `PgStorage` class backed by PostgreSQL (replaced in-memory `MemStorage`).
-   All four former in-memory stores (`USERS[]`, `history[]`, `SP_LOA[]`, `SP_DESPESAS[]`) are fully migrated to PostgreSQL.

**Backend (Express)**
-   **Authentication**: HMAC-SHA256 token validation. All user data persisted in `aura_users` table.
-   **Core Modules**:
    -   `LOA Uniao A2`: Main Federal LOA analysis, history, and catalog.
    -   `LOA Estoque`: Estoque and Gap Analysis.
    -   `LOA SP`: São Paulo state module for LOA and despesas import, TJSP scraping, and A2 conciliation.
    -   `DPO Controls`: Authorization guard, audit logging, integrity checks, and resource locking.
    -   `Anti-Regression`: Validation against baselines, metric comparison, and violation detection.
    -   `Anti-Hallucination`: Guards against mock data, ensures source validation and value evidence checks.
-   **Data Processing**:
    -   Parses execution data (PAGO+LIQUIDADO) from Portal da Transparência ZIPs.
    -   Integrates with SPARQL for Dotação and CNJ DataJud for Estoque.
    -   Orchestrates Estoque providers with fallback mechanisms.
    -   Downloads and parses official tribunal PDFs for precatório values, using `pdfjs-dist` for extraction and SHA-256 for evidence.
    -   Performs Gap Analysis across Dotação, Execução, and Estoque.
-   **Scheduled Tasks**: Automatic monthly batch download scheduler.
-   **Evidence System**: All data processed includes SHA-256 hashes, stored in `./Saida/evidence/` with detailed logs and raw files for full auditability. No mock data is used; all values are from real sources or explicitly marked as unavailable.

**Shared Types**
-   `shared/loa_types.ts`: TypeScript interfaces for A2, Estoque, and Gap Analysis modules.

**Key Decisions**
-   Primary source for execution data is Portal da Transparência REST API.
-   SIOP SPARQL is blocked externally, leading to graceful degradation.
-   CNJ DataJud is the primary Estoque provider with fallback to CSV and scraping.
-   Estoque data is not filtered by year, retrieving the full court backlog.
-   Federal tribunals TRF1-TRF6 are primary targets.
-   SP module uses manual CSV import and best-effort TJSP HTML scraping.
-   Multi-entity architecture supports Federal (`UNIAO`) and São Paulo (`SP`).

### External Dependencies

-   **Portal da Transparência**:
    -   REST API: `api-de-dados/despesas/por-funcional-programatica` for execution data (requires API key).
    -   ZIP Downloads: `dadosabertos-download.cgu.gov.br` for monthly despesas ZIP files.
-   **SPARQL Endpoints**:
    -   `orcamento.dados.gov.br`: For Dotação data (up to ~2016).
    -   SIOP SPARQL: Fallback for Dotação, but externally blocked.
-   **CNJ DataJud**:
    -   Elasticsearch API: `api-publica.datajud.cnj.jus.br` for court process stock (Precatório and RPV class codes). Supports Federal tribunals (TRF1-TRF6) and TJSP.
-   **TJSP (eSAJ)**:
    -   Public case consultation: `esaj.tjsp.jus.br/cpopg/open.do?processo.numero={CNJ}` for HTML scraping.
-   **Official Tribunal PDFs**:
    -   Example: `portal.trf6.jus.br/.../precatorios-federias-trf6-orcamento-2025.pdf` for extracting precatório values (parsed using `pdfjs-dist`).
-   **Sefaz/SP**:
    -   Direct CSV downloads: `dworcamento.fazenda.sp.gov.br` for SP state execution and dotação data (2011 onwards).
-   **TRF6 Processual Systems**:
    -   `processual.trf1.jus.br` (for PJe cases)
    -   `eproc2g.trf6.jus.br` (for eProc cases)