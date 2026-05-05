Pesquisa Precatório



funcionado para TRF1 e TRF3



**Update Todos**



* Criar Fase 0 — busca reversa CNJ (query DataJud por classe+tribunal+valor)



* Refatorar endpoint /api/duediligence/iniciar para pipeline completo (Fases 0-6)



* Integrar Fase 1 — DataJud com CNJ encontrado (fetchPrecatorioByNumero)



* Integrar Fase 2 — Raspagem web (FNDE/SIOPE, Receita, OAB, JusBrasil, Google CSE)



* Integrar Fase 2B — Score heurístico runBRAnalysis() (16 regras)



* Integrar Fase 3 — Consulta direta tribunal (PJe, sistema processual)



* Integrar Fase 4/5 — Autenticidade + Cruzamento fontes públicas



* Integrar Fase 6 — Gerar relatório HTML padrão Adimix (6 abas, Chart.js)



* Testar pipeline completo localmente (npm run dev + click no botão DD)



* Deploy no servidor Hetzner (build + pm2 restart)





salve o resultado o mais detalhado possivel com todos os codigos, depois eu vou conectar a dashboard, e la decidimos os filtros e ddos que serão apresentados, pense de forma ampla, e revisa na base da anthropic quais os dashboard mais modernos, na linha premium mais minimalistas estão sendo utizados para dados com essa complexidade!



MCP Server para Portal da Transparência

dutradotdev/mcp-portal-transparencia — um MCP Server que conecta direto ao Claude Desktop/Cursor com TODOS os endpoints do Portal da Transparência!



Isso significa: podemos instalar esse MCP e consultar despesas de precatórios diretamente do Claude Code, sem precisar de scripts manuais.



Além disso, encontrei:



Biblioteca Python portaldatransparencia — interface com a API

Scrapers do The Intercept e outros para dados de despesas

Robô PJe (movimentacoes\_processuais) — consulta automatizada de processos no PJe

Mas o mais importante — voltando à sua pergunta original sobre buscar precatório no portal web:



Da minha base de conhecimento, o caminho web seria:





portaldatransparencia.gov.br/despesas

&#x20; → filtrar: Função = 28 (Encargos Especiais)

&#x20; → filtrar: Órgão = 71103 (EFU - Sentenças Judiciais)

&#x20; → navegar até empenho individual

&#x20; → campo "Observação/Referência" contém nº processo

Quer que eu:



Instale o MCP mcp-portal-transparencia para consultas diretas?

Teste o caminho web (Despesas → empenho → observação) via Playwright?

Ou volte ao LOA/SIOP como você sugeriu?

Sources:



MCP Portal Transparência

Biblioteca Python portaldatransparencia

Robô movimentações processuais PJe

sim claro vamos instalar o MCP para consultas direta!



Tudo configurado:



✅ MCP instalado (mcp-portal-transparencia-brasil)

✅ Configurado em .mcp.json com chave API

✅ Ferramentas salvas na memória (MCP, Python lib, scrapers, robô PJe)

✅ MEMORY.md atualizado

Para ativar o MCP: reinicie o Claude Code (o MCP carrega no startup). Na próxima sessão, as tools portal\_despesas\_\* estarão disponíveis diretamente.





Relatório Final

✅ Memórias salvas (10 nesta sessão)

feedback\_mantra\_auratech.md — Lei Nº 0

feedback\_consultar\_base\_primeiro.md — regra base Anthropic

reference\_trf1\_consulta\_processual.md — 8 opções TRF1

reference\_caminho\_validado\_cnj.md — caminho LOA→CNPJ→CNJ

reference\_mapas\_cnj\_divida.md — Mapas CNJ 2024-2025

reference\_siop\_dados\_abertos.md — SIOP 164K registros

reference\_loa\_full\_conciliado.md — FULL 32 colunas

reference\_portal\_transparencia\_api.md — 106 endpoints

reference\_ferramentas\_dados\_gov.md — MCP + scrapers + PJe

project\_loa\_caminho\_cnj\_originario.md — regra mandatória CNJ

✅ CONTEXT.md atualizado

✅ CLAUDE.md — violação 12/04 registrada + regra "consultar base primeiro"

✅ Anti-regressão — todas as regras preservadas

⚠️ Anti-alucinação — violações STJ reportadas e documentadas

📊 Números da sessão

42.174 precatórios parseados da LOA

10.736 processos extraídos do TRF1

33 PRC com CNJ confirmado

32 colunas no FULL conciliado

164.012 registros SIOP baixados

106 endpoints API mapeados

7 skills criadas/atualizadas

Pendências (9 itens para próxima sessão)

Documentadas no CONTEXT.md e no Manual.









https://portaldatransparencia.gov.br/despesas



Orçamento Total atualizado da despesa

R$ 6,25 trilhões

Valor total pago

R$ 1,66 trilhão





Portal da Transparência — Despesas (onde ficam os precatórios)

https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos



TRF1 Consulta por CPF/CNPJ — caminho validado para obter CNJ

https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1



SIOP Dados Abertos — painel de precatórios do MPO

