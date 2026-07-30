# Extrator de precatórios — leitura integral

Substitui o fluxo do `PATCH_EXTRACAO_80_CAMPOS.py`. A diferença de fundo é que
a leitura vai até o fim do documento: a cobertura de campos essenciais continua
medida, mas como telemetria, nunca como critério de parada.

## Por que a parada em 80% era um problema

No dossiê `precatorios_diversor.pdf` (34 páginas, precatório 2025.04839-9 do
TJRJ) os 16 campos essenciais fechavam 100% já no primeiro bloco — todos estão
nas páginas 1 a 3. O `break` disparava ali. Só que o acordo direto do Edital
1/2025, com deságio de 40% e prazo de adesão em 25/08/2025, está nas páginas 27
a 34. A extração seria marcada como suficiente sem capturar o dado
economicamente mais relevante do documento.

O campo `controle_extracao.campos_que_a_parada_de_80pct_teria_perdido` registra
exatamente o que teria sido descartado, documento a documento.

## O que mudou

| Ponto | Antes | Agora |
|---|---|---|
| Parada | `break` ao atingir 80% | leitura integral; cobertura vira telemetria |
| Merge | primeiro valor vence, nunca sobrescreve | candidatos com procedência; resolução explícita e auditável |
| Retificações | descartadas (campo já preenchido) | vencem em campos monetários (`CAMPOS_MAIS_RECENTE_VENCE`) |
| Conflitos | silenciosos | listados em `conflitos_detectados` |
| Beneficiários | valores escalares | lista com valores próprios por beneficiário |
| Números | dependiam do LLM | camada regex sobre o texto integral, independente do modelo |
| Somas | não conferidas | `validar_consistencia` compara os totais declarados |
| Texto escasso | `raise` interrompia | segue e marca `ocr_necessario` |
| Seleção | inexistente | score por dimensão + planilha de triagem |

## Provedores

Funciona com Claude (Anthropic) ou GPT (OpenAI). O padrão é a Anthropic — com
`--provedor auto` (o default) ele escolhe pela chave que estiver configurada.

| | Anthropic | OpenAI |
|---|---|---|
| Chave | `ANTHROPIC_API_KEY` | `OPENAI_API_KEY` |
| Modelo padrão | `claude-opus-5` | `gpt-4o` |
| Pacote | `anthropic` | `openai` |
| Saída JSON | structured outputs (`json_schema`) | `response_format: json_object` |

Na Anthropic a resposta é presa ao schema pela própria API — não há cerca de
markdown nem texto ao redor do JSON, então o bloco nunca é descartado por falha
de parse. O `ANTHROPIC_EFFORT` (padrão `medium`) controla profundidade e custo.

Preços por milhão de tokens, entrada/saída: Claude Opus 5 US$ 5/25 · Claude
Sonnet 5 US$ 3/15 · Claude Haiku 4.5 US$ 1/5. Para extração em volume,
`ANTHROPIC_MODEL=claude-sonnet-5` costuma ser o melhor custo-benefício — vale
comparar a cobertura num documento antes de adotar no lote.

## Uso

```bash
pip install pypdf pdfplumber openpyxl
pip install anthropic          # ou: pip install openai
# OCR opcional para PDFs digitalizados:
pip install pytesseract pdf2image

export ANTHROPIC_API_KEY=...   # ou OPENAI_API_KEY

python extrator_precatorios.py "Documento Entrada" -s saida --planilha
```

Para escolher explicitamente:

```bash
python extrator_precatorios.py entrada -s saida --provedor anthropic
python extrator_precatorios.py entrada -s saida --provedor openai -m gpt-4o-mini
```

Sem chave de API, a camada determinística sozinha já preenche identificadores,
CPF/CNPJ, OAB, valores, datas e códigos:

```bash
python extrator_precatorios.py documento.pdf -s saida --sem-modelo
```

Para montar a planilha a partir de JSON já extraídos:

```bash
python gerar_planilha_triagem.py saida/*.json -s saida/triagem_precatorios.xlsx
```

## Variáveis de ambiente

| Variável | Padrão | Efeito |
|---|---|---|
| `EXTRATOR_PROVEDOR` | `auto` | `anthropic`, `openai` ou `auto` |
| `ANTHROPIC_API_KEY` | — | obrigatória no provedor Anthropic |
| `ANTHROPIC_MODEL` | `claude-opus-5` | modelo Claude usado por bloco |
| `ANTHROPIC_EFFORT` | `medium` | `low`/`medium`/`high`/`xhigh`/`max` |
| `OPENAI_API_KEY` | — | obrigatória no provedor OpenAI |
| `OPENAI_MODEL` | `gpt-4o` | modelo OpenAI usado por bloco |
| `OPENAI_BASE_URL` | — | endpoint alternativo compatível |
| `EXTRATOR_TAMANHO_BLOCO` | `12000` | caracteres por bloco |
| `EXTRATOR_SOBREPOSICAO` | `800` | sobreposição entre blocos |
| `EXTRATOR_PAUSA` | `0.2` | pausa entre chamadas, em segundos |
| `EXTRATOR_VALOR_REFERENCIA` | `5000000` | crédito que recebe nota 10 na dimensão Valor |

## A planilha

`triagem_precatorios.xlsx`, oito abas:

- **Triagem** — uma linha por precatório, com score, classificação sugerida e a
  coluna `SELECIONAR p/ Pré-DD` (SIM / NÃO / PENDENTE)
- **Parametros** — pesos e cortes; as notas da aba Triagem são fórmulas que
  apontam para cá, então mudar um peso reordena a triagem sem reprocessar PDF
- **Beneficiarios** — um por linha, com valores próprios
- **Valores** — abertura de principal, juros, correção e descontos
- **Consistencia** — conferência aritmética, OK ou DIVERGENTE
- **Riscos_Pendencias** — riscos, pendências, prazos e conflitos de extração
- **Resumo** — contagens e totais, com recorte dos selecionados
- **Dicionario** — definição de cada coluna

O score vai de 0 a 100 e pondera cinco dimensões: valor do crédito (30),
maturidade documental (25), preferência (15), liquidez (15) e completude da
extração (15). Os cortes padrão são 70 para APROVAR e 45 para REVISAR. A
classificação é sugestão; a decisão é a coluna `SELECIONAR`.

## Custo

O documento de 34 páginas rende 4 blocos. A leitura integral custa 4 chamadas
em vez de 1 — o preço de não perder as páginas finais, que em dossiês de
precatório concentram demonstrativos de cálculo e editais de acordo.
