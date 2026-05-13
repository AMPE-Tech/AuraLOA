# Handoff AuraLOA → AuraLEGAL · Caso "Fernando Guide"

> **Data:** 2026-05-12
> **Origem:** Sessão AuraLOA · `/session-start` + triagem
> **Motivo do handoff:** caso NÃO é precatório federal — escopo AuraLEGAL (litígio cível + possível fraude)
> **Decisão:** Marcos Costa, em 12/05/2026, após apresentação da Fase 0 enxuta
> **Status:** AGUARDANDO PRÓXIMA SESSÃO AURALEGAL

---

## 1. Por que o caso veio parar aqui

Fernando se apresenta como **negociador de precatórios**, representando o **advogado do credor** numa proposta de venda de direito creditório. Marcos recebeu 6 PDFs e pediu DD AuraLOA.

A **Fase 0 enxuta** (leitura do Espelho do processo) revelou que:
- **Não é precatório** (sem Fazenda Pública no polo passivo)
- **Polo ativo é instituição com nome de trust/offshore** (ITA TRUST AND FINANCIAL BANK S.A.)
- **Polo passivo são 3 pessoas físicas**
- **Classe original era homologação extrajudicial** (depois rejeitada → virou procedimento comum)
- **Inconsistência documental forte**: laudo de 114 fls + despacho RFB + parecer "Rede Ferrovia" **não batem** com classe declarada (Procedimento Comum sobre Transação)

**Conclusão técnica:** caso de **alta complexidade forense** com **suspeita de cessão de direito creditório de origem incerta**. Fora do modelo de negócio AuraLOA (precatório federal pendente).

---

## 2. Identificação do processo

| Campo | Valor (literal do Espelho) |
|---|---|
| **CNJ** | `5144966-22.2024.8.13.0024` |
| **Tribunal** | TJMG · 22ª Vara Cível da Comarca de Belo Horizonte |
| **Distribuição** | 13/06/2024 (sorteio) |
| **Classe ATUAL** | [CÍVEL] PROCEDIMENTO COMUM CÍVEL (7) |
| **Classe ANTERIOR (retificada 30/01/2026)** | [CÍVEL] HOMOLOGAÇÃO DA TRANSAÇÃO EXTRAJUDICIAL (12374) |
| **Assunto** | DIREITO CIVIL (899) → Obrigações (7681) → Espécies de Contratos (9580) → **Transação (9598)** |
| **Última movimentação no Espelho** | 04/02/2026 — publicação certidão de migração |
| **Data Espelho gerado** | 20/03/2026 12:28:42 (DESATUALIZADO — 3 meses) |

### Partes

**Polo Ativo (AUTOR):**
- **ITA TRUST AND FINANCIAL BANK S.A.** — instituição com nome de trust/offshore. **CNPJ pendente extração** (deve estar na petição inicial). **NÃO consta na minha base** como instituição financeira autorizada pelo Bacen.
- Advogado AUTOR: **ARMANDO NET LOURO MONTEIRO** (OAB pendente extração)

**Polo Passivo (RÉUS):**
- RICARDO TAVARES DUARTE (PF)
- ANA MENDES DIAS SOUZA (PF)
- ROBERTO DA CUNHA SOUZA (PF)

⚠️ **NÃO HÁ FAZENDA PÚBLICA NO POLO PASSIVO** — descarta precatório (CF Art. 100 exige ente público).

---

## 3. Documentos disponíveis (6 PDFs · selados SHA-256)

Localização: `c:\Users\MarcosCosta\OneDrive - CTS Brasil\Área de Trabalho\ClaudeCode\AuraLOA\Documento Entrada\Fernando Guide\`

| # | Arquivo | Tamanho | SHA-256 |
|---|---|---|---|
| 1 | `5144966-22.2024.8.13.0024-1731089618964-683005922-peticao inicial.pdf` | 854 KB | `9f6f26f61f98abd3...` |
| 2 | `Espelho.pdf` | 22 KB | `0ee3237f46de710b...` |
| 3 | `CamScanner 04-11-2025 20.39.pdf` | 353 KB | `b11a14b932b8fb30...` |
| 4 | `Despacho RFB.pdf` | 2,5 MB | `3fb052336d8cb97f...` |
| 5 | `Laudo homologado as fls.380 a 493-1.pdf` | 60,7 MB | `e46eb1d5ebba42fb...` (114 fls — não OCRizado) |
| 6 | `PARECER REDE FERROVIA 14.05 (GILBERTO).pdf` | 1,3 MB | `cbfd81e7e434cfce...` |

**Status OCR:** apenas Espelho.pdf foi lido (texto nativo). Os outros 5 PDFs estão **dormentes** aguardando decisão de OCR.

---

## 4. Análise forense preliminar (7 sinais críticos)

> **Esta análise é HIPÓTESE, não conclusão.** Precisa validação em fontes oficiais antes de qualquer afirmação ao cliente/Fernando.

1. **CLASSE/ASSUNTO ≠ precatório** — Procedimento Comum sobre Transação. Não pode gerar precatório.

2. **Sem Fazenda Pública no passivo** — 3 pessoas físicas como réus. Inviável CF Art. 100.

3. **ITA TRUST AND FINANCIAL BANK S.A.** — nome típico de:
   - Cessão de crédito podre travestida de operação financeira
   - "Trust" jurídico-financeiro fictício sem registro Bacen
   - Veículo offshore-style usado para movimentar título sem lastro

   **A verificar:** CNPJ na petição → BrasilAPI / Receita / Bacen para autenticar existência e atividade.

4. **Retificação de classe** (30/01/2026): autor **tentou primeiro** o rito mais leve (homologação extrajudicial) e foi forçado a migrar para procedimento comum. Sinal de **pressão sobre o sistema** para acelerar reconhecimento sem cognição.

5. **Múltiplos "Decorrido prazo de ITA TRUST"** (06/08/2024, 30/11/2024, 20/12/2024, 06/05/2025, 04/09/2025) — autor deixa prazos passarem **sistematicamente**. Inconsistente com quem quer ganhar a ação.

6. **3 certidões de erro de migração** entre 28-30/01/2026 — caos sistêmico no processo (migração PJe → PJe novo). Não é erro técnico necessariamente, mas sinaliza fragilidade.

7. **Inconsistência documental**: laudo de 114 fls + despacho RFB + parecer "Rede Ferrovia" **não batem** com classe atual (Procedimento Comum sobre Transação entre privados):
   - Laudo de 114 fls é típico de **execução fiscal complexa** ou **expropriação ferroviária**
   - Despacho RFB sugere **execução fiscal federal**
   - "Rede Ferrovia" sugere **RFFSA, Valec ou similar**

   **HIPÓTESE FORTE:** esses 4 PDFs (laudo + RFB + parecer + CamScanner) **NÃO PERTENCEM ao CNJ 5144966-22.2024.8.13.0024** — pertencem a **outro processo** que está sendo "emprestado" para sustentar a aparência de lastro. Vendedor pode estar **construindo cenário** de processo lastreado.

---

## 5. Por que NÃO é caso AuraLOA

| Critério AuraLOA | Status no caso Fernando |
|---|---|
| Precatório federal pendente na LOA 2026/27/28 | ❌ Não há precatório |
| Polo passivo = ente público | ❌ 3 pessoas físicas |
| CNJ em TRF1-6 | ❌ TJMG (estadual) |
| Cessão de direito creditório verificável | ⚠️ Origem incerta dos documentos |
| Modelo de aquisição AuraDUE | ❌ Fora do modelo |

**Decisão Marcos · 12/05/2026:** encaminhar para AuraLEGAL (caminho C).

---

## 6. Por que é caso AuraLEGAL

| Critério AuraLEGAL | Match |
|---|---|
| Litígio cível ativo | ✅ Procedimento Comum 22ª Vara BH |
| Necessita análise técnica multidisciplinar | ✅ 7 sinais críticos · risco de fraude |
| Pode evoluir para sustentação oral / defesa | ⚠️ Depende de qual lado o cliente está |
| Aproveita estrutura de 11 abas (template Dra. Márcia) | ✅ Adaptável |
| Útil para skills `/jur-radar-nulidades`, `/jur-jurisprudencia-real`, `/grupo-juridico` | ✅ Casa bem |

---

## 7. Plano sugerido para próxima sessão AuraLEGAL

### 7.1. Onboarding obrigatório
1. `/session-start` no projeto AuraLEGAL
2. Ler `feedback_estrutura_relatorio_dra_marcia_travada.md` — decidir se a estrutura 11 abas se aplica a este caso
3. Ler este handoff inteiro

### 7.2. Validações DOC1 (autoria)

Antes de qualquer outra coisa, validar a IDENTIDADE das partes:

- **ITA TRUST AND FINANCIAL BANK S.A.**
  - Extrair CNPJ da petição inicial (PDF #1)
  - Consultar BrasilAPI → razão social, situação cadastral, atividade econômica, sócios
  - Consultar Bacen → autorizado a operar?
  - Consultar Receita → consta?
  - Skill: `/audit-contatos` se cabível

- **Advogado ARMANDO NET LOURO MONTEIRO**
  - Extrair OAB+UF da petição inicial
  - Skill: `/cna-validar-oab` (CNA OAB — situação ativa? seccional? prova material)

- **3 RÉUS**
  - Extrair CPF da petição
  - Localizar geograficamente (residência declarada bate com Belo Horizonte?)
  - Verificar se já são executados em outros processos (potencial fraude coordenada)

### 7.3. Validações DOC2 (lastro dos documentos)

Verificar se os 4 PDFs anexos pertencem realmente ao CNJ declarado:

- **Despacho RFB** → ler cabeçalho → qual CNJ ou processo administrativo está referenciado?
- **Laudo homologado fls.380-493** → cabeçalho do laudo → qual processo originário?
- **Parecer Rede Ferrovia (Gilberto)** → autor (Gilberto quem?) + processo referenciado
- **CamScanner 04-11-2025** → o que é?

⚠️ **Se algum desses 4 PDFs cita CNJ diferente de `5144966-22.2024.8.13.0024`:** confirmação da hipótese de fraude — documentos estão sendo "emprestados" de outro processo.

### 7.4. Validações DOC3 (movimentação processual)

- DataJud TJMG → confirma todos os movimentos do Espelho
- PJe TJMG (autenticado) → captura cópia digital atualizada
- Validar quem é "ITA TRUST" no processo (representado por quem hoje?)

### 7.5. Análise jurídica multidisciplinar (skill `/grupo-juridico`)

Personas relevantes para este caso:
- **Advogado-Cível** (procedimento comum, transação)
- **Advogado-Contratos** (transação extrajudicial)
- **Perito-Forense-Digital** (lastro documental, fraude)
- **Estrategista** (cliente Fernando — está sendo enganado? está enganando?)

Skill: `/grupo-juridico` (modo "due diligence precatório" provavelmente NÃO se aplica — adaptar para "cessão de crédito").

### 7.6. Possíveis cenários técnicos para parecer

| Cenário | Como confirmar |
|---|---|
| **A. Crédito real + cessão legítima** | Lastro confirmado, partes autenticadas, sem inconsistência |
| **B. Crédito real + cessão indevida** | Lastro real mas titularidade questionável (ex: documentos pertencem a outra parte) |
| **C. Fraude — crédito inexistente** | Documentos não batem com CNJ + ITA TRUST não tem realidade jurídica |
| **D. Prescrição** | Ação distribuída em 06/2024, fato gerador anterior — verificar prazo |

### 7.7. Recomendação a Fernando / Marcos

Saída deve ser:
- **Tabela de risco** (cenários A–D probabilizados com evidência)
- **Decisão recomendada**: comprar / não comprar / pedir esclarecimento / declinar
- **Aviso técnico de DD insuficiente** (se Fernando não fornecer CNPJ/OAB/CPFs, parecer é só preliminar)

---

## 8. O que NÃO foi feito (deliberado)

- ❌ OCR do laudo de 60 MB (não justificado antes de saber se documento é do processo certo)
- ❌ Consulta DataJud TJMG (tentei via curl mas o one-liner Python falhou — refazer na sessão AuraLEGAL)
- ❌ Contato com Fernando (decisão de Marcos)
- ❌ Movimento dos PDFs (ficam onde estão — `Documento Entrada/Fernando Guide/` já gitignored)
- ❌ Análise jurídica completa (escopo da próxima sessão AuraLEGAL)

---

## 9. Fontes / cadeia de custódia

- **Espelho.pdf** lido em 2026-05-12 (texto nativo, sem OCR) — fonte primária dos achados
- **Petição inicial** lida (pages 1-3) — pendente ler o resto
- **DataJud TJMG** — health check 200 OK, mas consulta específica falhou por syntax do curl/Python (refazer)

Hash SHA-256 dos 6 PDFs registrado em §3.

---

## 10. Como Marcos abre a próxima sessão

```
# Em pasta AuraLEGAL/
/session-start

# Após onboarding, mostrar para o agente este handoff:
# docs/handoffs/auralegal/2026-05-12_fernando_guide.md (PATH FORA — copiar pra dentro)
```

⚠️ **Importante:** este arquivo está no AuraLOA. Para ser útil em AuraLEGAL, **uma cópia ou link deve ser feito** quando você iniciar a sessão lá. Sugestão: criar `AuraLEGAL/casos/fernando_guide/handoff_recebido.md` apontando para este path.

---

## 11. Atribuição

- **Análise Fase 0 enxuta:** Agente Claude Code Opus 4.7 (1M ctx)
- **Decisão de encaminhamento:** Marcos Costa, DPO AuraTECH
- **Selos SHA-256:** validados em 2026-05-12 com `sha256sum` POSIX
- **Próxima sessão:** AuraLEGAL · indeterminada (Marcos define)
