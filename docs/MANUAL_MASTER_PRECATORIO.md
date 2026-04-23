# MANUAL MASTER — Sistema de Precatórios AuraLOA

> **Versão:** 1.0 — 13/04/2026
> **Autor:** Marcos Costa (AuraTECH)
> **Classificação:** Confidencial — uso interno AuraTECH

---

## 1. VISÃO GERAL

O AuraLOA é uma plataforma de inteligência para precatórios federais brasileiros. Cobre o **ciclo completo** do precatório em 3 camadas, desde a inscrição na LOA até o processo em execução pré-ofício.

### O que é um precatório

Precatório é uma ordem de pagamento expedida pelo Poder Judiciário contra a Fazenda Pública (União, estados, municípios, autarquias) após sentença judicial com trânsito em julgado. O governo é obrigado a pagar, mas o pagamento segue ordem cronológica e previsão orçamentária (LOA).

### Ciclo de vida do precatório

```
[1] Sentença judicial → trânsito em julgado
[2] Cálculo de liquidação → valor definido
[3] Ofício requisitório → tribunal expede ao devedor
[4] Inscrição na LOA → Congresso aprova orçamento
[5] Liberação de crédito → CJF/TRF libera ao tribunal
[6] Pagamento → depósito na conta do credor
```

### As 3 camadas do AuraLOA

| Camada | Fase do ciclo | Risco | Desconto típico | Volume estimado |
|--------|--------------|-------|-----------------|-----------------|
| **Camada 1 — Na LOA** | Etapas 4-6 | BAIXO | 20-40% | 42.174 (LOA 2026) |
| **Camada 2 — Expedido pré-LOA** | Etapa 3 | MÉDIO | 40-60% | A mapear |
| **Camada 3 — Em execução** | Etapas 1-2 | ALTO | 60-80% | Parcialmente mapeado |

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 Stack técnico

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Node.js 20 + Express + TypeScript |
| Frontend | HTML estático (dashboard-loa-v3.html) + React (client/) |
| Banco de dados | PostgreSQL 16 (Hetzner) |
| Automação web | Playwright + Chromium (headless) |
| APIs externas | BrasilAPI, Portal Transparência, DataJud |
| Deploy | Hetzner VPS (178.104.66.47) + PM2 + Nginx |
| Módulo | CJS (NÃO ESM) |

### 2.2 Sistema de agentes

```
┌──────────────────────────────────────────────────┐
│            ORQUESTRADOR LOA                       │
│     /agent-loa-orquestrador                       │
│     Cérebro + Guardião da arquitetura             │
│                                                    │
│  Responsabilidades:                               │
│  • Acionar agentes na sequência correta           │
│  • Validar entregas de cada agente                │
│  • Consolidar dados em CSV                        │
│  • Gerenciar upload e split                       │
│  • Proteger contra regressão e alucinação         │
│  • Manter documentação atualizada                 │
│  • Notificar Marcos a cada fase                   │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ CAMADA 1   │ │ CAMADA 2   │ │ CAMADA 3   │    │
│  │ LOA        │ │ Expedido   │ │ Execução   │    │
│  │            │ │ pré-LOA    │ │ pré-ofício │    │
│  │ PDF LOA    │ │ TJSP DEPRE │ │ DataJud    │    │
│  │ SIOP CSV   │ │ TRF PrecWeb│ │ Robô PJe   │    │
│  │ Portal API │ │ TRF1-6     │ │ PJe TRF    │    │
│  │ BrasilAPI  │ │ portais    │ │            │    │
│  └────────────┘ └────────────┘ └────────────┘    │
│                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ AUDITOR    │ │ ENRIQUEC.  │ │ GUARDIÃO   │    │
│  │ /agent-    │ │ /agent-    │ │ /agent-    │    │
│  │ revisor    │ │ enriquec.  │ │ guardian   │    │
│  │            │ │            │ │            │    │
│  │ Valida     │ │ CNPJ→TRF  │ │ MANTRA     │    │
│  │ dados      │ │ →CNJ       │ │ Anti-aluc. │    │
│  │ contra     │ │ →credor    │ │ Anti-regr. │    │
│  │ fonte      │ │ →advogado  │ │            │    │
│  └────────────┘ └────────────┘ └────────────┘    │
│                                                    │
└──────────────────────────────────────────────────┘
```

### 2.2.1 Skills de Pipeline (criadas 14/04/2026)

| Skill | Funcao |
|-------|--------|
| `/pipeline-relatorio-dd` | Pipeline completo 15 fases/4 camadas |
| `/apply-layout-padrao` | Aplica layout blindado Santa Casa |
| `/identificar-credor-precatorio` | Identifica credor via Portal Transparencia |
| `/pipeline001` | Conciliacao LOA x TRF1 |
| `/cruzar-processos-precatorios` | Cruzamento TRF vs LOA |
| `/consulta-transparencia` | Portal Transparencia via MCP |

Catalogo completo: `memory/reference_skills_agentes_completo.md`

### 2.3 Fluxo de 8 fases (com notificações)

```
FASE 1: Coleta (C1→C2→C3) ──────→ 📩 Marcos
FASE 2: Validação ───────────────→ 📩 Marcos
FASE 3: Consolidação CSV ───────→ 📩 Marcos
FASE 4: Auditoria (Revisor) ────→ 📩 Marcos
FASE 5: Upload servidor ────────→ 📩 Marcos
FASE 6: Enriquecimento CNJ ─────→ 📩 Marcos
FASE 7: Relatório final ────────→ 📩 Marcos
FASE 8: Carga banco + Dashboard → 📩 Marcos (FINAL)
```

---

## 3. CAMADA 1 — PRECATÓRIOS NA LOA

### 3.1 Fontes de dados

| # | Fonte | URL | Auth | Automatizável | Status |
|---|-------|-----|------|--------------|--------|
| 1 | **PDF LOA** (Congresso) | camara.leg.br / senado.leg.br | Não | Download + pdfplumber | ✅ 42.174 registros |
| 2 | **SIOP CSV** (MPO) | `www1.siop.planejamento.gov.br/.../expedidos_{ANO}.csv` | Não | curl direto | ✅ 164K registros |
| 3 | **Portal Transparência** | api.portaldatransparencia.gov.br | API key | REST API | ✅ MCP instalado |
| 4 | **BrasilAPI** | brasilapi.com.br/api/cnpj/v1/ | Não | GET | ✅ Funcional |

### 3.2 Campos da Camada 1

| Campo | Fonte LOA | Fonte SIOP | Obrigatório |
|-------|-----------|-----------|-------------|
| nr_precatorio | ✅ | ❌ | ✅ |
| tribunal | ✅ | ✅ | ✅ |
| uo_devedora_codigo | ✅ | ✅ | ✅ |
| uo_devedora_nome | ✅ | ✅ | ✅ |
| tipo_causa | ✅ | ✅ | ✅ |
| valor_loa | ✅ | ❌ | ✅ |
| ano_loa | ✅ | ✅ | ✅ |
| chave_siop | ❌ | ✅ | Desejável |
| data_ajuizamento | ❌ | ✅ | Desejável |
| valor_atualizado | ❌ | ✅ | Desejável |
| cnpj_entidade | ❌ | ❌ (BrasilAPI) | ✅ |
| razao_social | ❌ | ❌ (BrasilAPI) | Desejável |
| cnj_originario | ❌ | ❌ (TRF) | **MANDATÓRIO** |
| cnj_execucao | ❌ | ❌ (TRF) | **MANDATÓRIO** |

### 3.3 Match LOA ↔ SIOP

Critério validado (13/04/2026): **UO_Devedora_Codigo + Tipo_Causa + Valor** (tolerância ±5%)

Exemplo testado:
- LOA: UFBA, "Gratificações da Lei 8.112/90", R$ 20.471.732
- SIOP: UO 26232, "Gratificações da Lei 8.112/90", R$ 20.471.732,35 → Chave SIOP 0796727
- Match: ✅ EXATO

### 3.4 Scripts existentes

| Script | Função |
|--------|--------|
| `extrair_loa.cjs` | Parse PDF LOA → CSV |
| `enriquecer_precatorio_cnpj.cjs` | CNPJ → TRF1 → CNJ (validado 407 INCRA) |
| `server/routes/dd_pipeline.ts` | Pipeline DD backend |
| `server/scripts/robo_pje/drivers/trf1.cjs` | Driver TRF1 Playwright |

---

## 4. CAMADA 2 — PRECATÓRIOS EXPEDIDOS PRÉ-LOA

### 4.1 O que é

Precatórios com ofício requisitório **já emitido** pelo tribunal, mas que **ainda não entraram na LOA**. Estarão na LOA do próximo exercício.

### 4.2 Valor estratégico

**Este é o ouro para investidores.** Preço no mercado é 40-60% do valor face (vs 60-80% na LOA). Quem compra na Camada 2 paga menos e espera 12-18 meses.

O AuraLOA pode informar: *"Este precatório tem ofício expedido em 15/03/2026, deve entrar na LOA 2027. Valor face: R$20M."*

### 4.3 Fontes por tribunal

| Tribunal | Sistema | URL | Dados | Status |
|----------|---------|-----|-------|--------|
| TJSP | DEPRE Lista Pendentes | tjsp.jus.br/Precatorios | Credor, valor, data exp. | ❌ A implementar |
| TJSP | Mapas Orçamentários | tjsp.jus.br/Precatorios/Comunicados | Por entidade devedora | ❌ A implementar |
| TRF3 | PrecWeb | trf3.jus.br/secretaria-da-presidencia/precatorios | CSV mensal | ❌ A implementar |
| TRF1 | Portal Precatórios | precatorios.trf1.jus.br | Lista expedidos | ❌ A implementar |
| TRF2 | Dívida Consolidada | trf2.jus.br/trf2/artigo/dipre | CSV/ODS | ❌ A implementar |
| TRF5 | Mapas Download | rpvprecatorio.trf5.jus.br/downloadMapas | Download | ❌ A implementar |
| CJF | Cronograma | cjf.jus.br | Publicação periódica | ⚠️ Documentado |

### 4.4 Campos da Camada 2

| Campo | Obrigatório |
|-------|-------------|
| nr_oficio_requisitorio | ✅ |
| cnj_processo | ✅ |
| tribunal_expedidor | ✅ |
| entidade_devedora | ✅ |
| credor_nome | ✅ |
| valor_original | ✅ |
| data_expedicao | ✅ |
| natureza (alimentar/comum) | ✅ |
| previsao_loa | Estimado |

### 4.5 Prioridade de implementação

1. TJSP DEPRE (maior volume estadual)
2. TRF3 PrecWeb (CSV disponível)
3. TRF1 Portal (maior volume federal)
4. TRF5 Mapas (download direto)

---

## 5. CAMADA 3 — PROCESSOS EM EXECUÇÃO

### 5.1 O que é

Processos com **trânsito em julgado** confirmado, em fase de **cálculo/liquidação**, mas com ofício **ainda não expedido**. São os precatórios do futuro.

### 5.2 Fontes

| Fonte | Método | Cobertura | Status |
|-------|--------|-----------|--------|
| DataJud API | Elasticsearch | TRF3, TRF4, TRF6, STJ, STF, TJs | ⚠️ Parcial |
| Robô PJe | Playwright | TRF1 funcional | ✅ 66 movimentações |
| PJe Consulta | Playwright | TRF1 acessível | ✅ Campos mapeados |

### 5.3 Movimentações-chave

| Código | Significado | Indica |
|--------|------------|--------|
| 246 | Trânsito em julgado | Processo definitivo |
| 60 | Expedição de documento | Ofício sendo emitido |
| 12217 | Depósito judicial | Pagamento realizado |
| 848 | Pagamento reconhecido | Confirmação |
| 22 | Baixa/Arquivamento | Processo encerrado |

### 5.4 Classificação de fase

```
Trânsito em julgado (mov 246) → "Em cálculo"
Cálculos apresentados → "Aguardando homologação"
Cálculos homologados → "Pré-ofício"
Ofício expedido (mov 60) → Migra para Camada 2
Pagamento (mov 12217) → "Pago"
```

---

## 6. ENRIQUECIMENTO CNJ

### 6.1 Regra de negócio (MANDATÓRIA)

**Todo precatório DEVE ter CNJ originário + CNJ execução.** Sem estes campos, o pipeline de Due Diligence NÃO prossegue.

### 6.2 Caminho validado (12/04/2026)

```
LOA (UO Devedora "UFBA")
  → Mapa CNJ / BrasilAPI → CNPJ 15180714000104
    → TRF1 processual (input#cpf_cnpj + input#enviar)
      → Lista de processos → Click entidade → Tabela
        → Coluna 1: "Número do Processo" (CNJ execução)
        → Coluna 2: "Processo Originário" (CNJ originário)
```

Testado com INCRA: 407 processos retornados.

### 6.3 O que NÃO funciona

| Tentativa | Resultado | Motivo |
|-----------|-----------|--------|
| Nº Precatório como CNJ no TRF1 | 0 hits | Não é CNJ (19 dígitos vs 20) |
| DataJud para TRF1/TRF2/TRF5 | 0 hits | Não publicam classe 1265/1266 |
| PJe TRF1 busca por CNPJ | 0 hits | Campo CNPJ retorna vazio para entidades grandes |
| processual.trf1 headless | Cloudflare | Anti-bot desde 04/2026 |

### 6.4 O que FUNCIONA

| Método | Resultado | Script |
|--------|-----------|--------|
| processual.trf1 headless:false | 407 processos INCRA | `enriquecer_precatorio_cnpj.cjs` |
| processual.trf1 com anti-detecção | A validar | `trf1.cjs` (com user-agent + Xvfb) |
| SIOP CSV match por UO+Tipo+Valor | Chave SIOP encontrada | curl direto |
| BrasilAPI CNPJ | Razão social + situação | GET sem auth |

---

## 7. PIPELINE DE DUE DILIGENCE

### 7.1 Fases do DD (após enriquecimento)

| Fase | Função | Fonte |
|------|--------|-------|
| 0-ENRIQ | Enriquecimento CNJ | SIOP + BrasilAPI + TRF1 |
| 0 | Busca reversa DataJud | DataJud Elasticsearch |
| 1 | Consulta DataJud por CNJ | DataJud API |
| 1B | Busca LOA CSV local | precatorios_extraidos.csv |
| 1C | Cruzamento SIOP | LOA_FULL_CONCILIADO.csv |
| 2 | Raspagem web (8 fontes) | Mapeadas, maioria pendente |
| 2B | Score heurístico (14 regras) | analysis-engine-br.ts |
| 3 | Consulta direta tribunal | URL gerada |
| 4/5 | Autenticidade + Cruzamento | LOA + DataJud |
| 4B | Robô PJe movimentações | Playwright TRF1 |
| 5B | Verificador CNPJ | BrasilAPI |
| 5C | Portal Transparência | API REST |
| 6 | Relatório HTML (6 abas) | Geração automática |

### 7.2 Score de verificação

14 regras (10 base + 4 LOA):
- R-BR001 a R-BR010: formato CNJ, tribunal, valor, juiz, URL, assinatura, QR, etc.
- R-LOA-001: Inscrito na LOA (+15 pontos)
- R-LOA-002: Valor ≥ R$10M (+5)
- R-LOA-003: CNJ encontrado no DataJud (+10)
- R-LOA-004: Tribunal com movimentações (+5)

| Score | Status | Ação |
|-------|--------|------|
| ≥ 80 | APROVADO | Prosseguir com DD |
| 50-79 | VERIFICAR | Requer análise adicional |
| < 50 | SUSPEITO | Investigar manualmente |

### 7.3 Confirmação de pagamento (3 caminhos)

1. **PJe movimentação** — código 12217 (depósito) + código 60 (expedição)
2. **CJF Cronograma** — confirma se crédito foi liberado ao TRF
3. **Portal Transparência OB** — confirma pagamento pelo Tesouro

---

## 8. FONTES OFICIAIS — URLS VALIDADAS

### Orçamentárias

| Fonte | URL | Validada |
|-------|-----|----------|
| LOA Câmara | https://www2.camara.leg.br/orcamento-da-uniao/leis-orcamentarias/loa | ✅ |
| LOA Congresso | https://www.congressonacional.leg.br/web/orcamento/acompanhe/orcamento-anual/-/loa/2026 | ✅ |
| SIOP Dados Abertos | https://www.gov.br/planejamento/pt-br/assuntos/orcamento/precatorios-content/painel-precatorios/dados-abertos | ✅ |
| SIOP CSV 2026 | https://www1.siop.planejamento.gov.br/siopdoc/lib/exe/fetch.php/dados_abertos:sentencas:expedidos_2026.csv | ✅ 13/04 |
| Portal Transparência API | https://api.portaldatransparencia.gov.br/api-de-dados | ✅ MCP |
| SIGA Brasil | https://www12.senado.leg.br/orcamento/sigabrasil | ⚠️ Sem API |

### Judiciais

| Fonte | URL | Validada |
|-------|-----|----------|
| TRF1 Processual | https://processual.trf1.jus.br/consultaProcessual/ | ✅ (Cloudflare headless) |
| PJe TRF1 | https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam | ✅ 13/04 |
| DataJud API | https://api-publica.datajud.cnj.jus.br | ✅ |
| BrasilAPI CNPJ | https://brasilapi.com.br/api/cnpj/v1/{cnpj} | ✅ |

### Precatórios (Camada 2)

| Fonte | URL | Status |
|-------|-----|--------|
| TJSP DEPRE | https://www.tjsp.jus.br/Precatorios/Precatorios/ListaPendentes | ❌ A mapear |
| TJSP Comunicados | https://www.tjsp.jus.br/Precatorios/Comunicados?tipoDestino=159 | ❌ A mapear |
| TRF3 PrecWeb | https://www.trf3.jus.br/secretaria-da-presidencia/precatorios | ❌ A mapear |
| TRF5 Mapas | https://rpvprecatorio.trf5.jus.br/downloadMapas/ | ❌ A mapear |

---

## 9. DADOS DO SISTEMA

### 9.1 Volumes atuais

| Dado | Volume | Fonte |
|------|--------|-------|
| Precatórios LOA 2026 | 42.174 | PDF LOA (extraído) |
| SIOP expedidos 2026 | 164.012 | CSV MPO |
| LOA FULL conciliado | 1.590 | LOA + SIOP + TRF1 |
| Com CNJ identificado | 34 (2,1%) | Conciliação |
| Com CNPJ entidade | 207 (13%) | Mapa CNJ |
| Sem CNPJ (UO genérica) | ~1.349 (85%) | EFU |
| Total R$ LOA 2026 | ~R$ 28,9 bilhões | CSV extraído |
| Precatórios ≥ R$10M | 192 | R$ 17,57 bi |

### 9.2 Contexto macro

- EC 114: teto de precatórios expira em 2027
- Projeção: déficit 0,23% do PIB em 2027
- R$47 bilhões pendentes vs R$15,4 bilhões orçados
- Dívida pública: 77,7% do PIB projetada para 2027

---

## 10. INFRAESTRUTURA

### 10.1 Servidores

| Servidor | IP | Função |
|----------|-----|--------|
| ubuntu-4gb-nbg1-3 | 178.104.66.47 | **PRINCIPAL** — AuraLOA + 18+Check |
| ubuntu-4gb-hel1-1 | 89.167.8.143 | VM uso geral |

### 10.2 Deploy

```
Código: /var/www/auraloa/
PM2: auraloa (porta 3000)
Nginx: loa.auradue.com → localhost:3000
SSL: Let's Encrypt (certbot)
Dados: /var/www/auraloa/data/
Dashboard: /var/www/auraloa/dist/public/dashboard-loa-v3.html
```

### 10.3 Banco de dados

```
PostgreSQL 16
Host: 178.104.66.47:5432
Banco: auraloa
User: auraloa_user
```

---

## 11. REGRAS ABSOLUTAS

### 11.1 MANTRA AURATECH (Lei Nº 0)

```
NUNCA DECIDA SEM 100% DE CERTEZA.
NUNCA SUPONHA DADOS.
NUNCA CRIE INFORMAÇÃO SEM EMBASAMENTO.
SEMPRE LEIA O MANUAL OFICIAL.
SEMPRE CITE FONTE VERIFICÁVEL.
SEMPRE EMITA ALERTA VERMELHO ANTE ALUCINAÇÃO OU REGRESSÃO.
```

### 11.2 Regras operacionais

| Regra | Detalhe |
|-------|---------|
| Nº Precatório ≠ CNJ | NUNCA tratar como equivalente |
| LOA PDF não tem CNJ | NUNCA extrair CNJ do PDF |
| Teste no Chrome | SEMPRE abrir localhost antes de produção |
| Código validado | NUNCA reescrever sem ler primeiro |
| Deploy | localhost → Marcos aprova → produção |
| SSH | NUNCA usar ! em aspas, NUNCA SSH com senha |
| OneDrive | NUNCA usar como --saida (pipeline OCR) |
| Dados de contato | Email correto: suporte@auradue.com |

### 11.3 Arquivos protegidos (NUNCA alterar sem 3x confirmação)

- `enriquecer_precatorio_cnpj.cjs`
- `server/scripts/robo_pje/drivers/trf1.cjs`
- `server/scripts/robo_pje/index.cjs`
- `data/precatorios_extraidos.csv`
- `data/LOA_FULL_CONCILIADO.csv`
- `client/public/dashboard-loa-v3.html`
- `CLAUDE.md`

---

## 12. INCIDENTES E LIÇÕES

| Data | Incidente | Lição |
|------|-----------|-------|
| 31/03 | Relatório DD fabricado sem documentos | Motor só afirma o que processou |
| 09/04 | CNJ inventado do PDF LOA | PDF LOA NÃO tem CNJ |
| 09/04 | "DD realizada" com dado genérico | Sempre verificar se é específico |
| 11/04 | Nº Precatório tratado como CNJ | 19 dígitos ≠ 20 dígitos |
| 12/04 | Pesquisa no STJ sem justificativa | Consultar base própria ANTES |
| 13/04 | trf1.cjs reescrito sem ler código | NUNCA reescrever validado |
| 13/04 | Marcos gasta 80% verificando agentes | Transparência radical obrigatória |

---

## 13. GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| **CNJ** | Conselho Nacional de Justiça — também refere ao formato único de número de processo (Res. 65/2008) |
| **LOA** | Lei Orçamentária Anual — orçamento aprovado pelo Congresso |
| **SIOP** | Sistema Integrado de Planejamento e Orçamento (MPO) |
| **PRC** | Precatório (classe processual 1265) |
| **RPV** | Requisição de Pequeno Valor (classe 1266, até 60 salários mínimos federal) |
| **UO** | Unidade Orçamentária (código 5 dígitos + nome da entidade) |
| **EFU** | Encargos Financeiros da União (UO genérica sem CNPJ específico) |
| **DEPRE** | Departamento de Precatórios (ex: TJSP) |
| **CJF** | Conselho da Justiça Federal |
| **TRF** | Tribunal Regional Federal (1 a 6) |
| **DataJud** | Base de dados unificada do CNJ com processos de todos os tribunais |
| **PJe** | Processo Judicial Eletrônico (sistema usado pelos tribunais) |
| **Ofício Requisitório** | Documento pelo qual o tribunal ordena o pagamento |
| **Trânsito em Julgado** | Decisão judicial da qual não cabe mais recurso |
| **Alimentar** | Precatório de natureza alimentar (salários, benefícios) — tem prioridade |
| **Comum** | Precatório não alimentar (desapropriações, contratos) |

---

## DESCOBERTA — Caminho para identificar CREDOR via Portal da Transparência (14/04/2026)

### Contexto

O PDF da LOA e o SIOP NÃO contêm nome/CNPJ do credor do precatório. O TRF1 mostra partes apenas ao abrir o processo individual. O Portal da Transparência NÃO tem endpoint específico de precatórios.

**Solução descoberta:** cruzar dados que JÁ TEMOS com o endpoint `recursos-recebidos` do MCP Portal da Transparência.

### Método (validado com precatório DNIT R$28M)

```
INPUTS (dados que já temos no FULL 32 colunas):
  ① Entidade devedora (LOA) → código orgaoSuperior no SIAFI
  ② CNJ originário (TRF1) → UF da seção judiciária
  ③ Tipo de causa (LOA) → palavra-chave para filtrar nome

CONSULTA API:
  Endpoint: recursos-recebidos (via MCP portal-transparencia)
  Parâmetros:
    mesAnoInicio: "01/{ANO}"
    mesAnoFim: "12/{ANO}"
    orgaoSuperior: "{CODIGO}"    ← do input ①
    uf: "{UF}"                   ← do input ②
    nomeFavorecido: "{KEYWORD}"  ← do input ③
    pagina: 1

RESULTADO:
  → Lista de empresas/pessoas que receberam do órgão naquela UF
  → Filtrar por valor compatível com o precatório
  → Candidato credor identificado com CNPJ real
```

### Exemplo concreto (DNIT)

| Input | Valor | Fonte |
|---|---|---|
| Entidade devedora | DNIT | LOA campo UO_Devedora |
| orgaoSuperior | 39000 (Min. Transportes) | SIAFI |
| CNJ originário | 0001648-37.2015.4.01.**3100**/AP | TRF1 |
| UF | AP (Amapá) | Extraída do CNJ (seção 3100) |
| Tipo causa | Prestação de serviços | LOA campo Tipo_Causa |
| Keyword | CONSTRUTORA | Deduzida do tipo de causa |

**Resultado:** CONSTRUTORA E REFLORESTADORA RIO PEDREIRA LTDA — CNPJ 05.696.802/0001-00 — Santana/AP

### Mapeamento orgaoSuperior por entidade devedora

| Entidade LOA | orgaoSuperior SIAFI | Nome |
|---|---|---|
| DNIT | 39000 | Ministério dos Transportes |
| INCRA | 57000 | Ministério do Desenvolvimento Agrário |
| SUFRAMA | 28000 | Ministério da Indústria (verificar) |
| UFBA | 26000 | Ministério da Educação |
| ANS | 36000 | Ministério da Saúde |
| INSS | 33000 | Ministério da Previdência Social |
| FIOCRUZ | 36000 | Ministério da Saúde |
| UFPA | 26000 | Ministério da Educação |
| Inst. Chico Mendes | 44000 | Ministério do Meio Ambiente |

### Validação obrigatória após identificar candidato

1. **Receita Federal** — consultar CNPJ na base dados abertos para quadro societário
   - `https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9`
2. **Processo originário** — confirmar no TRF1 que a empresa é parte no processo
3. **Marcar como [NÃO VERIFICADO]** até confirmação nas duas fontes acima

### MANTRA

```
NUNCA afirmar que o candidato É o credor sem verificação no processo.
SEMPRE marcar como [CANDIDATO — NÃO VERIFICADO] até confirmar.
SEMPRE citar a fonte (Portal Transparência endpoint + parâmetros).
```

---

---

## 14. PIPELINE ÚNICO AUTORIZADO — ORDEM DE MARCOS (15/04/2026)

```
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   PROIBIDO USAR PIPELINE INCOMPLETO.                                     ║
║   PROIBIDO USAR SEM AUTORIZAÇÃO EXPLÍCITA DE MARCOS.                     ║
║                                                                          ║
║   O ÚNICO PIPELINE AUTORIZADO É:                                         ║
║                                                                          ║
║       /pipeline-relatorio-dd — 15 FASES EM 4 CAMADAS                    ║
║                                                                          ║
║   CAMADA 1 (ORÇAMENTÁRIA): LOA CSV + SIOP + CNPJ DEVEDOR                ║
║   CAMADA 2 (JUDICIAL):     ROBÔ PJe + GRAVAMES + CREDOR                 ║
║   CAMADA 3 (VERIFICAÇÃO):  CNPJ CREDOR + PAGAMENTO + OAB + VINCULADOS   ║
║   CAMADA 4 (PUBLICAÇÃO):   SCORE + TEMPLATE BLINDADO + REVISOR + DEPLOY ║
║                                                                          ║
║   QUALQUER OUTRO PIPELINE É PROIBIDO:                                    ║
║     ❌ POST /api/duediligence/pipeline SOZINHO                           ║
║     ❌ gerarRelatorioHTML() SOZINHO                                      ║
║     ❌ TEMPLATE SEM AS 15 FASES                                          ║
║     ❌ SCRIPT PRÓPRIO QUE PULA FASES                                     ║
║                                                                          ║
║   DECLARAR AO INICIAR E ENCERRAR CADA SESSÃO.                           ║
║   VIOLAÇÃO = REMOÇÃO DO PROJETO.                                         ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### As 15 fases detalhadas

| # | Fase | Camada | Fonte/Script |
|---|------|--------|-------------|
| 1 | Busca LOA CSV | Orçamentária | `data/precatorios_extraidos.csv` |
| 2 | Cruzamento SIOP | Orçamentária | `data/LOA_FULL_CONCILIADO.csv` |
| 3 | Verificação CNPJ Devedor | Orçamentária | BrasilAPI |
| 4 | Robô PJe — Processo Originário | Judicial | `robo_pje/index.cjs` |
| 5 | Robô PJe — Precatório (Execução) | Judicial | `robo_pje/index.cjs` |
| 6 | Verificação Gravames | Judicial | Robô PJe |
| 7 | Identificação Credor | Judicial | `/identificar-credor-precatorio` |
| 8 | Verificação CNPJ Credor | Verificação | BrasilAPI + QSA |
| 9 | Portal Transparência — Pagamento | Verificação | MCP `recursos-recebidos` |
| 10 | Verificação OAB Advogados | Verificação | CNA/OAB |
| 11 | Outros Precatórios Vinculados | Verificação | LOA FULL mesmo CNJ |
| 12 | Score de Viabilidade | Publicação | 14 regras heurísticas |
| 13 | Geração HTML | Publicação | TEMPLATE BLINDADO |
| 14 | Auditoria Pré-Publicação | Publicação | `/agent-revisor` |
| 15 | Deploy | Publicação | Chrome → Marcos → Hetzner |

---

## 15. REGIMES DE CONCILIAÇÃO DIRETA DE PRECATÓRIOS (18/04/2026)

**Validado empiricamente** em 18/04/2026 — URLs testadas via curl, leis baixadas do Planalto/ALESP.

### 15.1 Visão geral

Existem **3 regimes distintos** de conciliação/acordo direto por deságio, conforme o ente devedor. Cada regime tem fundamento normativo, portal, deságio e órgão proponente próprios:

| Regime | Base legal principal | Portal | Deságio | Órgão |
|---|---|---|---:|---|
| **SP Estadual** | Decreto SP 69.325/2025 + art. 102 ADCT | [attus.pge.sp.gov.br/portal/login](https://attus.pge.sp.gov.br/portal/login) | 20–40% (escalonado) | PGE-SP + Câmara TJSP + DEPRE |
| **Federal (União)** | Lei 14.057/2020 + § 20 art. 100 CF | Juízo auxiliar de conciliação no TRF / PJe | até 40% (único) | União + TRF + CJF |
| **Município SP (PMSP)** | Decretos Municipais 51.378/2010, 52.011/2010, 52.312/2011 + ADI 4357 STF | [prefeitura.sp.gov.br/acordosprecatorios](https://prefeitura.sp.gov.br/acordosprecatorios) | faixas por ano cronológico | PGM-SP + Câmara TJSP + DEPRE |

### 15.2 SP Estadual — Decreto 69.325/2025

**Data promulgação:** 22/01/2025 • **Complemento:** Resolução PGE nº 2 de 27/01/2025 • **Portaria TJSP:** 10.304/2023 (NÃO 10.300 — valor oficial corrigido)

**Deságios escalonados (Art. 5º):**

| Ano de ordem | Deságio |
|---|---:|
| Até 2015 | 20% |
| 2016–2017 | 25% |
| 2018–2019 | 30% |
| 2020–2021 | 35% |
| 2022+ | **40% (teto)** |

**Fluxo:** Edital PGE-SP → habilitação no portal → PGE analisa (90 dias) → Câmara Conciliação TJSP homologa → DEPRE aplica deságio + retém IR + paga.

**Abrangência:** Fazenda Estadual SP, autarquias, fundações e empresas públicas dependentes.
**Exclusões:** USP, Unicamp, Unesp (regime próprio — não agrupadas ao Estado).
**Acordo parcial:** ❌ não permitido (totalidade do precatório).
**Limite orçamentário:** 50% dos recursos transferidos ao TJ destinados a acordos.

**URLs VERIFICADAS (HTTP 200 em 18/04/2026):**
- Decreto: [al.sp.gov.br/norma/210553](https://www.al.sp.gov.br/norma/210553)
- Portal PGE-SP: [attus.pge.sp.gov.br/portal/login](https://attus.pge.sp.gov.br/portal/login)
- TJSP Precatórios: [tjsp.jus.br/Precatorios](https://www.tjsp.jus.br/Precatorios)
- Portaria TJSP 10.304/2023: [tjsp.jus.br/Download/Portal/GPJ/Portaria-10.304-23.pdf](https://www.tjsp.jus.br/Download/Portal/GPJ/Portaria-10.304-23.pdf)

### 15.3 Federal (União) — Lei 14.057/2020

**Data promulgação:** 11/09/2020 • **Complemento:** Resolução CJF 822/2023

**Regra:** acordo direto aplicável quando o precatório supera **15% da dotação de precatórios na LOA** (§20 art. 100 CF — precatório de grande valor).

**Deságio:** até **40%** do valor atualizado (único, negociado caso a caso — não escalonado).

**Fluxo:** Proposta do credor OU da União ao Juízo Auxiliar de Conciliação de Precatórios vinculado ao presidente do tribunal que proferiu a decisão exequenda → homologação → pagamento pelo CJF.

**Abrangência:** União, autarquias federais (INSS, IBAMA, IFES, etc.), fundações federais.
**Exclusões:** precatórios já parcelados pelo §20 art. 100.
**Acordo parcial:** ✅ **permitido** (diferente do SP Estadual) — admite acordo sobre saldo remanescente.
**Acordos terminativos de litígio:** até 8 parcelas anuais (com título executivo) ou 12 parcelas (sem título).

**URLs VERIFICADAS:**
- Lei 14.057/2020: [planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/L14057.htm](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/L14057.htm)
- Resolução CJF 822/2023: [cjf.jus.br/publico/biblioteca/Res 822-2023.pdf](https://www.cjf.jus.br/publico/biblioteca/Res%20822-2023.pdf)

### 15.4 Município SP (PMSP) — Decretos Municipais

**Base:** Decretos **51.378/2010** (31/03/2010), **52.011/2010** (17/12/2010), **52.312/2011** (13/05/2011) + **ADI 4357 STF** + art. 102 § 1º ADCT.

**Câmara de Conciliação de Precatórios** instituída pela PGM-SP (Decreto 52.011/2010).

**Deságio:** faixas por ano cronológico — credor recebe entre **60% a 80%** do valor atualizado (varia conforme edital anual).

**Fluxo:** Edital anual PGM-SP → credor apresenta proposta → Câmara de Conciliação homologa → DEPRE/TJSP paga.

**Abrangência:** PMSP (administração direta), IPREM, SPTrans, SP Urbanismo, COHAB-SP, FTMSP + entes extintos (SFMSP, AHM).
**Exclusões:** universidades municipais e entes em regime próprio.
**Acordo parcial:** ❌ não permitido (totalidade).

**URL VERIFICADA:** [prefeitura.sp.gov.br/acordosprecatorios](https://prefeitura.sp.gov.br/acordosprecatorios) (⚠️ URL `pgmsp.net/acordosprecatorios` de fontes de terceiros está INCORRETA)

### 15.5 MATRIZ DE VERIFICAÇÃO AuraLOA — 6 DIMENSÕES

Pipeline de elegibilidade de conciliação com gates objetivos:

**D1 — Identificação & Ofício Requisitório**
- `numero_cnj` (DataJud) — formato válido CNJ
- `numero_precatorio` (DEPRE) — número existe
- `ano_ordem` (Ofício/DEPRE) — ano calendário apresentação até 02/abr
- `natureza_credito` (Ofício) — alimentar/comum
- `valor_requisitado_original` + `valor_atualizado_depre`

**D2 — Trânsito em Julgado & Status Processual**
- `transito_julgado` = true ✅
- `existe_recurso_pendente` / `impugnacao` / `medida_defesa` / `penhora_credito` / `bloqueio_judicial` / `compensacao_tributaria` = **todos false**
- **Regra:** qualquer true → NÃO ELEGÍVEL

**D3 — Titularidade & Cadeia de Cessão**
- `titular_originario_cpf_cnpj` válido
- `houve_cessao_credito` → flag + nº cessões
- `cadeia_cessao_completa` (todos instrumentos)
- `substituicao_parte_homologada` (decisão judicial)
- `quinhao_individualizado` (se precatório global)
- `sucessao_causa_mortis` (se espólio)
- `procuracao_poderes_especificos` (acordo + deságio)

**D4 — Ente Devedor & Regime Aplicável**
- `ente_devedor_tipo` — define qual PRESET (SP_ESTADUAL / UNIAO / PMSP)
- `regime_pagamento` — Geral vs Especial
- `ente_elegivel_programa` — USP/Unicamp/Unesp → false para SP
- `autarquia_agrupada_ao_ente`

**D5 — Inclusão Orçamentária (LOA)**
- `incluido_loa_exercicio` = true
- `ano_loa` + `data_apresentacao_tribunal` (até 02/abr)
- `status_pagamento` + `saldo_remanescente` > 0

**D6 — Enquadramento em Edital Vigente**
- `edital_vigente_id` + `prazo_inscricao_aberto`
- `desagio_aplicavel_pct` (tabela do edital/preset)
- `peticao_tipo_correto` ("Acordo – Habilitação")

**Engine de decisão:**
```
ELEGIBILIDADE = D1.valido AND D2.todos_false AND D3.titularidade AND
                D4.elegivel AND D5.saldo>0 AND D6.prazo_aberto
→ Trust Seal de Elegibilidade (UUID + SHA-256 + timestamp)
```

### 15.6 Correções aplicadas a materiais de terceiros

Ao integrar material externo sobre conciliação, validar empiricamente as seguintes fontes frequentemente erradas:

| Erro comum | Correto |
|---|---|
| URL `portaldeprecatorios.pge.sp.gov.br` | `attus.pge.sp.gov.br/portal/login` |
| URL `pgmsp.net/acordosprecatorios` | `prefeitura.sp.gov.br/acordosprecatorios` |
| URL `portal.tjsp.jus.br/Depre` | `www.tjsp.jus.br/Precatorios` |
| Portaria TJSP "10.300/2023" | **Portaria 10.304/2023** |
| Teto 40% "fixado pela Portaria TJSP" | Fixado pelo **Art. 5º do Decreto 69.325/2025** |

---

## 16. POLÍTICA DE DADOS COMPLETOS — DD AUTENTICADA (22/04/2026)

### Princípio

Due Diligence real, por definição, entrega **todos os dados disponíveis** sobre o ativo. Ocultar dado relevante descaracteriza a DD e a transforma em marketing. Por ordem direta de Marcos (22/04/2026):

```
DD REAL = DADOS COMPLETOS APÓS LOGIN + ACEITE LGPD
OCULTAR DADO = NÃO É DUE DILIGENCE
```

### Modelo de autenticação (reuso AuraAUDIT)

1. **Login**: email + senha (JWT emitido)
2. **2 checkboxes LGPD obrigatórios ao autenticar**:
   - ☑ "Li e concordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018)"
   - ☑ "Estou ciente que dados sensíveis serão armazenados no servidor AuraTECH (Hetzner Alemanha, compliance GDPR/LGPD)"
3. **JWT claims**: `scope: dd_completo`, `lgpd_accepted: true`, `lgpd_accepted_at`, `user_role`
4. **Expiração**: 8h
5. **Auditoria**: cada acesso a dado sensível gera log (user, ip, precatório, timestamp)

### Contextos e visibilidade de dados

| Contexto | Dados mostrados |
|---|---|
| **Landing pública** | Ofuscado (marketing) |
| **Demo investidor** | Mascarado (volumes, padrões) |
| **Cliente autenticado + LGPD aceito** | **COMPLETO** — CPF, CNPJ, valores, endereços, OAB, contatos, SHA-256 |
| **Admin** | Completo + logs + métricas |

### O que NÃO pode aparecer no DD autenticado

- ❌ `[N/D]` ou `[NÃO VERIFICADO]` em campos que a fonte tem
- ❌ Placeholder vazio em valor R$ quando eSAJ/DEPRE expõe
- ❌ "Ocultado por política interna" em contexto autenticado
- ❌ Mascaramento parcial (`123.456.***-**`) autenticado

### O que PODE aparecer (honestidade preservada)

- ✅ `[NÃO DISPONÍVEL NA FONTE]` quando fonte realmente não expõe (ex: eSAJ não tem valor em "Execução de Sentença")
- ✅ `[EM PROCESSAMENTO]` quando consulta está em andamento
- ✅ `[SEGREDO DE JUSTIÇA]` quando protegido por lei
- ✅ `[NÃO LOCALIZADO EM N FONTES]` com lista das fontes consultadas

### Mudanças obrigatórias no backend (para cumprir a política)

1. Middleware JWT em `/api/tjsp/*` exigindo `lgpd_accepted: true`
2. Enriquecimento expandido antes de marcar campo ausente:
   - **CNPJ credor** via Receita Federal / BrasilAPI
   - **OAB advogado** via CNA OAB
   - **Trânsito em julgado** via extração das movimentações (código 51 ou descrição)
   - **Honorários fixados** via busca em "Honorários" nas movimentações
   - **Data base** via sentença/acórdão
3. Tabela de auditoria `dd_access_log`: user_id, ip, precatorio, timestamp, dados_acessados

### Compliance Hetzner Alemanha

| Requisito | Como cumprimos |
|---|---|
| GDPR (UE) | Servidor físico em Nuremberg/Falkenstein |
| LGPD (BR) | Compatibilidade via GDPR + aceite explícito |
| Direito ao esquecimento | DELETE em `cliente_crm` + DD reports |
| Criptografia em trânsito | HTTPS (SSL Certbot) |
| Criptografia em repouso | PostgreSQL (Hetzner, CN=ubuntu-4gb-nbg1-3) |
| Log de acesso | JWT + middleware auditoria |

### Referência

- Memória dedicada: `memory/project_politica_dados_autenticados_dd.md`
- CLAUDE.md: seção "POLÍTICA DE DADOS COMPLETOS — DD AUTENTICADA"
- Tela login modelo: `dashboard-cliente.html` (17/04/2026) ou AuraAUDIT em audit.auradue.com

---

*Documento atualizado em 22/04/2026 — AuraTECH Sistemas (seção 16 incluída — política de dados completos DD)*
*Documento atualizado em 18/04/2026 — AuraTECH Sistemas (seção 15 incluída)*
*Documento atualizado em 15/04/2026 — AuraTECH Sistemas*
*Classificação: Confidencial — Uso interno*
