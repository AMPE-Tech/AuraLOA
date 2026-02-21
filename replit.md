# AuraLOA - Modulo de Pesquisa de Precatorios na LOA

## Overview
AuraLOA is a specialized module for researching and presenting precatorios (court-ordered payments) inscribed in the LOA (Annual Budget Law). Currently implements the Federal (Union) level - MVP A2: crossing DOTAÇÃO (SIOP) + EXECUÇÃO (Portal da Transparência) for precatório actions.

## Project Architecture

### Frontend (React + Vite)
- `client/src/pages/loa-dashboard.tsx` - Main dashboard with year selector, results display, KPIs, and evidence trail
- `client/src/App.tsx` - Routes configuration

### Backend (Express)
- `server/routes/loa_uniao_a2.ts` - Main endpoint `POST /api/loa/uniao/a2` and history/catalog endpoints
- `server/catalog/acoes_precatorios_uniao.ts` - Fixed catalog of precatório actions (0005, 0EC7, 0EC8)
- `server/services/transparencia_execucao.ts` - Portal da Transparência CSV/API integration
- `server/services/siop_dotacao.ts` - SIOP SPARQL endpoint integration
- `server/services/evidence_pack.ts` - Evidence pack system (SHA-256 hashes, file saving)
- `server/services/validate_output.ts` - Output validation

### Shared Types
- `shared/loa_types.ts` - All TypeScript interfaces for A2 module

### Evidence System
- Evidence packs saved to `./Saida/evidence/{process_id_uuid}/`
- Each pack contains: request.json, response.json, raw/ folder, hashes.json, run.log
- All data has SHA-256 hashes for auditability

## API Endpoints
- `POST /api/loa/uniao/a2` - Execute A2 analysis (input: `{ ano_exercicio: number }`)
- `GET /api/loa/uniao/a2/history` - Get recent consultation history
- `GET /api/loa/uniao/a2/catalog` - Get catalog of precatório actions

## Key Decisions
- Portal da Transparência requires API key for programmatic access (env: PORTAL_TRANSPARENCIA_API_KEY)
- SIOP SPARQL endpoint may require authentication from external environments
- System gracefully degrades to PARCIAL/NAO_LOCALIZADO status when sources are unavailable
- No mock data - all values come from real government sources or are explicitly marked as unavailable
