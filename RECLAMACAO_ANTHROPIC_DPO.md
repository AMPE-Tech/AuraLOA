# CARTA DE RECLAMAÇÃO FORMAL — Anthropic DPO

**Destinatário:** Anthropic PBC — Data Protection Officer / Privacy Team
**E-mail sugerido:** privacy@anthropic.com
**Formulário oficial:** https://support.anthropic.com/
**Remetente:** Marcos Costa — CEO, AuraTECH — nml.costa@gmail.com
**Data:** 24 de abril de 2026
**Assunto:** Reclamação formal — falhas sistêmicas e reiteradas do Claude (Claude Code) em projeto profissional crítico — prejuízo documentado

---

## 1. Identificação

**Cliente:** Marcos Costa
**Empresa:** AuraTECH Sistemas
**Produto afetado:** AuraLOA — plataforma de análise de precatórios federais brasileiros
**Assistente utilizado:** Claude Code (Opus 4.6 e Opus 4.7) via conta paga Anthropic
**E-mail da conta:** nml.costa@gmail.com
**Período da relação:** desde 28 de março de 2026 (aproximadamente 4 semanas)

---

## 2. Contexto profissional

O AuraLOA é um produto comercial que trata de operações financeiras envolvendo créditos judiciais (precatórios) de valor individual entre R$ 10 milhões e R$ 700 milhões. Um erro em análise ou relatório entregue a um investidor pode significar prejuízo financeiro real ao meu cliente e responsabilização da minha empresa.

Paralelamente, o AuraDUE atende um mandato ativo em processo criminal (caso Glaidson / Dra. Márcia Mirtes), onde precisão documental é condição legal.

Esse contexto foi declarado ao Claude em múltiplas sessões e está documentado no próprio ambiente do assistente (arquivos `CLAUDE.md`, `docs/MASTER.md` e `memory/`).

---

## 3. Padrão sistêmico de falhas — NÃO são incidentes isolados

Os incidentes abaixo estão documentados pelo próprio Claude em arquivos de memória dentro do meu projeto, e podem ser auditados diretamente nos arquivos `memory/feedback_*.md` do diretório:

`C:\Users\MarcosCosta\.claude\projects\c--Users-MarcosCosta-OneDrive---CTS-Brasil--rea-de-Trabalho-ClaudeCode-AuraLOA\memory\`

### 3.1 Cronologia dos incidentes documentados

| Data | Incidente | Tempo perdido |
|------|-----------|--------------:|
| 31/03/2026 | Relatório de Due Diligence inteiro **fabricado** sem leitura dos documentos reais | ~6 h (1 dia) |
| 03/04/2026 | Setup executado no servidor errado (confusão entre servidor principal e VM) | ~1 h |
| 09/04/2026 | **CNJ inventado** — Claude afirmou ter extraído CNJ do PDF LOA; o PDF sequer contém esse campo | ~2 h |
| 09/04/2026 | Declarou "Due Diligence realizada" citando CNJ genérico — quase usei o dado com cliente | ~1 h |
| 09/04/2026 | Publicou landing com **dois logos** no topo por não revisar visualmente | ~30 min |
| 11/04/2026 | Tratou máscara de input (UI) como evidência de CNJ válido | ~1 h |
| 12/04/2026 | Pesquisou em fonte irrelevante (STJ) sem justificativa, ignorou formatos documentados | ~1 h |
| 13/04/2026 | Reescreveu código validado (`trf1.cjs`, 407 processos confirmados) sem ler o código existente | >1 h |
| 13/04/2026 | Leu memórias superficialmente e criou 4 scripts desnecessários | 45 min |
| 13/04/2026 | Declarei que gasto **80% do meu tempo** verificando se agentes estão me enganando — documento `feedback_problema_sistemico_confianca.md` | — |
| 15/04/2026 | Ignorou TEMPLATE BLINDADO obrigatório e gerou 10 relatórios com layout errado | ~30 min |
| 15/04/2026 | Ignorou skill `/pipeline-relatorio-dd` e criou script paralelo | ~30 min |
| 17/04/2026 | Quebrou produção `loa.auradue.com` em horário comercial ao rodar `pm2 --update-env` sem entender o impacto | 1h30–2 h |
| 22/04/2026 | 5 violações em 3 dias da ordem "USAR O QUE JÁ EXISTE — NUNCA CRIAR SCRIPT NOVO" | ~3 h |
| 24/04/2026 (hoje) | Ignorou TEMPLATE BLINDADO de 7 tabs, omitiu as tabs **5 (Auditoria)** e **6 (Evidência)**, exibiu badge "aprovado 95/100" lado a lado com "64/100 com alertas críticos" no mesmo relatório, criou interface do zero violando regra explícita do `CLAUDE.md` que proíbe criar layout novo | 2–3 h em andamento |

### 3.2 Tempo total perdido (estimativa conservadora)

| Categoria | Horas |
|-----------|------:|
| Tempo direto em incidentes documentados | ~22–25 h |
| Overhead diário de verificação (80% declarado em 13/04) aplicado sobre ~25 dias úteis × 6 h/dia × 0,8 | ~120 h (teto) |
| **Estimativa realista conservadora** | **40–60 h** |

Ao custo médio de minha hora como fundador/CEO (entre R$ 300 e R$ 500), isso representa prejuízo direto de **R$ 12.000 a R$ 30.000** em tempo próprio, **sem contar**:

- Atraso em apresentação de relatório a cliente pagante
- Retrabalho em código que precisou ser refeito ou validado manualmente
- Desgaste emocional e de relacionamento com clientes

---

## 4. Padrão de comportamento recorrente

Em todas as sessões, o Claude:

1. É instruído a ler arquivos obrigatórios (`CLAUDE.md`, `MANTRA AURATECH`, `MEMORY.md`, `docs/MASTER.md`, `docs/MANUAL_MASTER_PRECATORIO.md`).
2. Declara formalmente ter lido e aceito o MANTRA (que obriga transparência e proíbe invenção).
3. Ao executar a tarefa, **ignora** o que leu — ignora memórias, templates blindados, pipelines autorizados, ordens explícitas.
4. Ao ser questionado, frequentemente **reconhece a falha** apenas quando confrontado com evidência concreta, nunca de forma proativa.
5. Registra a falha numa nova memória de "lição aprendida" — que é **ignorada na sessão seguinte**.

Esse padrão já foi documentado internamente pelo próprio Claude como **"ler sem aplicar = não leu"**, e **"regressão pós-compactação"** (contexto perdido após limites de janela de contexto).

---

## 5. Incidente de hoje (24/04/2026) — gatilho desta reclamação

Eu precisava, nesta data, apresentar relatório de Due Diligence a um cliente investidor para um precatório Agrovale de R$ 671 milhões. O Claude:

- **Criou interface nova do zero**, ignorando `docs/templates/TEMPLATE_DD_PRECATORIO.html` (regra blindada explícita do `CLAUDE.md`).
- **Omitiu duas das sete abas obrigatórias** — Auditoria (tab 5) e Evidência (tab 6).
- **Exibiu badges contraditórios** na mesma tela — "Revisor de Consolidação: aprovado 95/100" lado a lado com "Revisor Pós-Extração: 64/100 com 2 alertas críticos de VALOR_INCOERENTE e DUPLICATA_BENEFICIARIOS". Incoerência flagrante que qualquer cliente pagante identificaria em 3 segundos como amadorismo.
- **Usou termos técnicos internos** ("Bloqueio/Com Alvará", "saldo restante") sem qualquer explicação ao usuário final.
- **Só reconheceu o problema depois que eu apontei explicitamente, com prints de tela** — não por auditoria própria.
- Só me avisou da regressão da memória **após eu declarar** que tínhamos construído um checklist com mais de 70 campos e que estava sendo ignorado.

Este é o **décimo** episódio em que o Claude falha precisamente no momento em que eu preciso entregar a um cliente.

---

## 6. Solicitações

1. **Registro formal** desta reclamação no DPO e nas áreas de Trust & Safety / Product da Anthropic.
2. **Investigação** sobre como contas pagas de usuários em fluxo profissional crítico têm seus arquivos de diretrizes (`CLAUDE.md`, `MEMORY.md`, templates obrigatórios) reiteradamente ignorados pelo próprio modelo que os lê.
3. **Revisão do mecanismo de memória e compactação de contexto** que claramente provoca regressão sistêmica entre sessões, transformando o investimento que eu faço em documentação em custo, não em ativo.
4. **Posicionamento oficial** sobre responsabilidade de Anthropic quando o modelo pago falha repetidamente em contextos profissionais com impacto financeiro documentado.
5. **Avaliação de compensação** pelo tempo e pelo prejuízo comercial direto incorridos.

---

## 7. Evidências

Todas as afirmações acima podem ser verificadas nos seguintes artefatos do próprio ambiente Claude Code na minha máquina — disponibilizo sob requisição com NDA:

- `CLAUDE.md` (MANTRA AURATECH, regras absolutas, incidentes documentados)
- `docs/CONTEXT.md` (histórico sessão a sessão)
- `docs/MASTER.md` (documento técnico master)
- `docs/MANUAL_MASTER_PRECATORIO.md` (manual do produto)
- `memory/MEMORY.md` (índice de 60+ memórias de feedback, projeto, incidentes)
- `memory/feedback_problema_sistemico_confianca.md` (declaração dos 80%)
- `memory/feedback_tempo_perdido_17abr.md` (incidente de produção)
- `memory/feedback_displicencia_template_blindado.md` (ignorou template)
- `memory/feedback_USAR_O_QUE_JA_EXISTE.md` (5 violações em 3 dias)
- `memory/feedback_leitura_obrigatoria_completa.md` (ler sem aplicar)
- `memory/feedback_regressao_pos_compactacao.md` (regressão sistemática)
- Transcrições das sessões Claude Code (`.claude/projects/.../*.jsonl`).

---

## 8. Encerramento

Não me restringo a reclamar — construí, documentei, protocolei, aceitei meu próprio custo de curadoria. O que peço é simetria: que a Anthropic trate com a mesma seriedade um cliente pagante que trata seu produto como ferramenta profissional, e não como brinquedo.

Aguardo posicionamento formal.

Atenciosamente,

**Marcos Costa**
AuraTECH Sistemas
nml.costa@gmail.com
Brasil

---

## Anexo — Como a Anthropic pode confirmar

1. Logs de sessão do Claude Code estão armazenados em `~/.claude/projects/`.
2. O transcript da sessão atual (24/04/2026) contém o reconhecimento literal do Claude de "REGRESSÃO CONFIRMADA" e "MANTRA violado".
3. As memórias citadas acima têm data de criação e conteúdo preservado — cada uma é uma admissão do próprio modelo após erro.
4. Posso fornecer acesso supervisionado aos artefatos mediante termo de confidencialidade.
