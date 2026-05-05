---
name: Skill futura — Analise de Precatorio com raspagem
description: Marcos quer transformar o fluxo de analise de precatorios (extracao + score + raspagem + relatorio com graficos) em uma skill reutilizavel
type: project
---

Marcos solicitou em 08/04/2026 que o fluxo de pesquisa de precatorios seja transformado em uma skill completa.

**Fluxo validado (6 fases):**
1. Extracao e catalogacao de todos os campos do documento
2. Verificacao de identidade (CPF, CNPJ, OAB) via raspagem web (18+ fontes)
3. Consulta direta ao sistema do tribunal (TRF1, TJSP, etc.)
4. Analise de autenticidade (layout, formatacao, consistencia)
5. Cruzamento com fontes publicas (DOU, orcamento, cessoes)
6. Parecer final consolidado com relatorio visual (graficos)

**Score engine:**
- v1.0: 10 regras heuristicas (analysis-engine-br.ts) — analisa conteudo do documento
- v2.0 proposta: +6 regras complementares (R-BR011 a R-BR016) — verificacao de identidade e rastro digital
- Classificacao: APROVADO >= 80 | VERIFICAR 50-79 | SUSPEITO < 50

**Relatorio final:**
- Marcos quer graficos visuais como no relatorio de due diligence da Dra. Marcia (HTML com Chart.js, abas, dashboard)
- Modelo de referencia: `due_diligence_1503896_20260402.html`

**Why:** O AuraLOA precisa de uma skill que automatize todo o ciclo de analise de precatorios recebidos, incluindo raspagem web para detectar fraudes. Isso diferencia o produto no mercado.

**How to apply:** Quando Marcos pedir para criar a skill, usar as 6 fases validadas + score engine v2.0 + template de relatorio visual com graficos.
