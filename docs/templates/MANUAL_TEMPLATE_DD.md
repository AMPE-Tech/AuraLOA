# MANUAL DO TEMPLATE DD — Regra Obrigatoria para Todos os Agentes

> **Versao:** 1.0 — 15/04/2026
> **Status:** BLINDADO — nao alterar sem autorizacao de Marcos
> **Template:** `docs/templates/TEMPLATE_DD_PRECATORIO.html`
> **Referencia:** `Saida/due_diligence/santacasa-pp/due_diligence_santacasa_pp_20260413.html`

---

## REGRA ABSOLUTA

```
TODO RELATORIO DE DUE DILIGENCE DEVE USAR O TEMPLATE BLINDADO.
NENHUM AGENTE PODE CRIAR LAYOUT DO ZERO.
NENHUM AGENTE PODE ALTERAR CSS, SVGs, ESTRUTURA HTML OU GRAFICOS.
A UNICA ACAO PERMITIDA E SUBSTITUIR PLACEHOLDERS POR DADOS VERIFICADOS.
```

**Violacao = regressao grave = remocao do projeto.**

---

## COMO USAR O TEMPLATE

### Passo 1 — Copiar o template
```bash
cp docs/templates/TEMPLATE_DD_PRECATORIO.html Saida/due_diligence/{slug}/due_diligence_{slug}_{data}.html
```

### Passo 2 — Substituir TODOS os placeholders
Usar find-and-replace. Cada `{{CAMPO}}` deve ser substituido pelo dado verificado.

### Passo 3 — Adaptar secoes condicionais
- **Tab Processo Incidental:** Manter se existir processo bloqueador. Remover conteudo (nao a tab) se nao existir, e colocar "Nenhum processo incidental identificado".
- **Tab Movimentacoes:** Substituir a tabela inteira pelas movimentacoes reais.
- **Outros Precatorios da Entidade:** Atualizar tabela com dados reais do credor.

### Passo 4 — Verificar anti-regressao
Antes de publicar, conferir:
- [ ] Todos os `{{` foram substituidos (grep)
- [ ] Nenhum dado da Santa Casa permanece
- [ ] Valores batem com a fonte
- [ ] Layout visual identico ao original

---

## MAPA COMPLETO DE PLACEHOLDERS (40 campos)

### Identificacao do Processo

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{CNJ_NUMERO}}` | Numero CNJ do processo (XX.XXXXXXX.AAAA.J.TR.OOOO) | TRF/PJe | SIM |
| `{{PRECATORIO_NUMERO}}` | Numero do precatorio no tribunal (PRC XXXXXXX-XX.XXXX.X.XX.XXXX) | LOA/TRF | SIM |
| `{{OFICIO_NUMERO}}` | Numero do oficio requisitorio | Oficio PDF | SIM |
| `{{SLUG}}` | Identificador URL do relatorio (ex: santacasa-pp, suframa) | Definido por Marcos | SIM |
| `{{INCIDENTAL_CNJ}}` | CNJ do processo incidental/bloqueador | TRF/PJe | Se existir |

### Credor / Beneficiario

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{CREDOR_NOME}}` | Razao social completa do credor | Oficio/BrasilAPI | SIM |
| `{{CREDOR_NOME_CURTO}}` | Nome abreviado para uso em textos (ex: "Santa Casa") | Derivado | SIM |
| `{{CREDOR_INICIAIS}}` | 2 letras para o avatar (ex: SC, DN, SF) | Derivado | SIM |
| `{{CREDOR_CNPJ}}` | CNPJ formatado (XX.XXX.XXX/XXXX-XX) | Oficio/BrasilAPI | SIM |
| `{{CREDOR_TELEFONE}}` | Telefone(s) principal(is) | Fonte verificada | Se disponivel |
| `{{CREDOR_WHATSAPP}}` | WhatsApp/agendamentos | Fonte verificada | Se disponivel |
| `{{CREDOR_EMAIL}}` | Email administrativo | Fonte verificada | Se disponivel |

### Valores

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{VALOR_TOTAL}}` | Valor total requisitado formatado (ex: 235.492.820,70) | Oficio | SIM |
| `{{VALOR_TOTAL_ABREV}}` | Valor abreviado (ex: 235,4M) | Calculado | SIM |
| `{{VALOR_PRINCIPAL}}` | Valor principal do credor (ex: 131.661.817,74) | Oficio | SIM |
| `{{VALOR_PRINCIPAL_ABREV}}` | Abreviado (ex: 131,6M) | Calculado | SIM |
| `{{VALOR_JUROS}}` | Valor de juros/Selic (ex: 56.732.438,83) | Oficio | SIM |
| `{{VALOR_JUROS_ABREV}}` | Abreviado (ex: 56,7M) | Calculado | SIM |
| `{{VALOR_LIQUIDO_CREDOR}}` | Subtotal liquido do credor (principal + juros) | Calculado | SIM |
| `{{VALOR_LIQUIDO_ABREV}}` | Abreviado (ex: 188,4M) | Calculado | SIM |
| `{{VALOR_HONORARIOS}}` | Valor dos honorarios advocaticios | Oficio | SIM |
| `{{VALOR_HONORARIOS_ABREV}}` | Abreviado (ex: 47,1M) | Calculado | SIM |

### Datas

| Placeholder | Descricao | Formato | Obrigatorio |
|------------|-----------|---------|-------------|
| `{{DATA_AJUIZAMENTO}}` | Data de ajuizamento do processo | DD/MM/AAAA | SIM |
| `{{DATA_TRANSITO}}` | Data do transito em julgado | DD/MM/AAAA | SIM |
| `{{DATA_OFICIO}}` | Data do oficio requisitorio | DD/MM/AAAA | SIM |
| `{{DATA_BASE}}` | Data base dos calculos | DD/MM/AAAA | SIM |
| `{{DATA_ULTIMA_MOV}}` | Data da ultima movimentacao | DD/MM/AAAA | SIM |
| `{{DATA_RELATORIO}}` | Data de geracao do relatorio | DD/MM/AAAA | SIM |
| `{{TIMESTAMP_ISO}}` | Timestamp ISO 8601 completo | AAAA-MM-DDTHH:MM:SS-03:00 | SIM |

### Partes e Representacao

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{JUIZA_REQUISITANTE}}` | Nome do juiz/juiza que expediu o oficio | Oficio | SIM |
| `{{VARA_REQUISITANTE}}` | Vara que expediu (ex: 6a Vara Federal de Brasilia) | Oficio | SIM |
| `{{ADVOGADO_NOME}}` | Nome do advogado principal | Oficio/OAB | SIM |
| `{{ADVOGADO_OAB}}` | Numero da OAB (ex: DF29502) | Oficio | SIM |
| `{{ADVOGADO_CPF}}` | CPF do advogado | Oficio | Se disponivel |
| `{{HONORARIOS_ESCRITORIO}}` | Nome do escritorio de advocacia | Oficio | SIM |
| `{{HONORARIOS_CNPJ}}` | CNPJ do escritorio | Oficio/BrasilAPI | SIM |

### Processo Incidental (se existir)

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{RELATORA_NOME}}` | Desembargadora relatora | PJe 2g | Se existir |
| `{{DESEMBARGADOR2_NOME}}` | Segundo desembargador | PJe 2g | Se existir |
| `{{PRESIDENTE_SESSAO}}` | Presidente da sessao | PJe 2g | Se existir |
| `{{PROCURADORA_NOME}}` | Procuradora federal | PJe 2g | Se existir |
| `{{SECRETARIA_SESSAO}}` | Secretaria da sessao | PJe 2g | Se existir |
| `{{DOCUMENTO_ID}}` | ID do documento no PJe | PJe 2g | Se existir |

### Contatos do Escritorio

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{ESCRITORIO_TELEFONE}}` | Telefone do escritorio | Fonte verificada | Se disponivel |
| `{{ESCRITORIO_EMAIL}}` | Email do escritorio | Fonte verificada | Se disponivel |
| `{{ESCRITORIO_ENDERECO}}` | Endereco do escritorio | Fonte verificada | Se disponivel |

### Descritivos

| Placeholder | Descricao | Fonte | Obrigatorio |
|------------|-----------|-------|-------------|
| `{{ASSUNTO_PRINCIPAL}}` | Assunto/tipo de causa principal | TRF/LOA | SIM |
| `{{DESCRICAO_CREDITO}}` | Descricao por extenso do credito (para o texto de analise) | Oficio | SIM |

---

## SECOES DO TEMPLATE (7 tabs)

| Tab | Nome | Conteudo | Obrigatoria |
|-----|------|---------|-------------|
| 1 | **Resumo** | Cover, badges, credor/devedor, score gauge, valores, donut, KPIs, timeline, etapas, alerta | SIM |
| 2 | **Dados do Processo** | Dados completos, partes, assuntos, status cards, outros precatorios | SIM |
| 3 | **Movimentacoes** | Tabela cronologica de todas as movimentacoes PJe | SIM |
| 4 | **Processo Incidental** | Dados, votacao, decisao, significado | Se existir |
| 5 | **Auditoria** | Checklist 11 itens, 3 caminhos (PJe, CJF, Portal), conclusao | SIM |
| 6 | **Evidencia** | SHA-256, timestamp, conformidade, verificacoes | SIM |
| 7 | **Contatos** | Telefones, emails, enderecos do credor e escritorio | SIM |

---

## ELEMENTOS VISUAIS BLINDADOS (nao alterar)

| Elemento | Descricao |
|----------|-----------|
| Gauge SVG | Score de viabilidade (0-100), gradiente vermelho-amarelo-verde |
| Donut SVG | Composicao do credito (principal + juros + honorarios) |
| Timeline bars | Linha do tempo do processo (2020-2026) |
| Avatar ring SVG | Iniciais do credor com anel de progresso |
| Escudo devedor SVG | Icone de escudo para a Uniao Federal |
| Sparkline bars | Distribuicao de movimentacoes por ano |
| Progress bars | Etapas do pagamento (concluido/pendente) |
| Mini donut | Credor vs Honorarios |

**REGRA:** Ajustar apenas os DADOS dentro destes elementos (percentuais, valores, cores de status). NUNCA recriar o SVG, NUNCA alterar o CSS, NUNCA mudar dimensoes.

---

## AJUSTES PERMITIDOS

| O que pode mudar | Como |
|-----------------|------|
| Percentuais do donut | Alterar `stroke-dasharray` e `stroke-dashoffset` |
| Larguras da barra horizontal | Alterar `width: XX%` |
| Score do gauge | Alterar `stroke-dashoffset` e numero central |
| Cor do score (verde/amber/red) | Mudar `color: var(--green)` para a cor adequada |
| Badge de status (OK/WARN/FAIL) | Trocar classe `badge-ok` por `badge-warn` ou `badge-fail` |
| Altura das barras da timeline | Alterar `height: XX%` |
| Movimentacoes na tabela | Substituir linhas `<tr>` por dados reais |
| Texto descritivo da analise | Reescrever com dados do caso |

---

## VERIFICACAO FINAL (checklist obrigatorio)

```bash
# 1. Verificar que nenhum placeholder ficou sem substituir
grep -c '{{' arquivo.html
# Resultado esperado: 0

# 2. Verificar que nenhum dado da Santa Casa permanece
grep -i 'santa casa\|santacasa\|presidente prudente' arquivo.html
# Resultado esperado: 0

# 3. Verificar que o layout renderiza corretamente
# Abrir no Chrome localhost e conferir visualmente

# 4. Verificar que impressao PDF funciona
# Ctrl+P no Chrome, conferir que todas as abas aparecem
```

---

## HISTORICO

| Data | Acao |
|------|------|
| 15/04/2026 | Template criado a partir de santacasa-pp (1399 linhas, 40 placeholders) |
| 13/04/2026 | Layout aprovado 100% por Marcos ("perfeito!") |
| 14/04/2026 | Modelo confirmado com SUFRAMA (1224 linhas) — "perfeito!" |
