"""
Extrator de precatorios — leitura integral do documento.

Diferencas em relacao ao PATCH_EXTRACAO_80_CAMPOS.py:

1. LEITURA COMPLETA. Nao ha `break` por cobertura. A cobertura de campos
   essenciais continua sendo medida, mas so como telemetria no relatorio
   final. No dossie MAYA (34 paginas) os 16 campos essenciais fechavam em
   100% ja no primeiro bloco, enquanto o acordo direto com desagio de 40%
   estava nas paginas 27 a 34 — a parada antecipada descartava justamente o
   dado economicamente mais relevante.

2. MERGE POR CANDIDATOS. `_deep_merge_missing` preservava o primeiro valor e
   nunca sobrescrevia, de modo que uma retificacao posterior era descartada.
   Aqui cada campo acumula todos os candidatos com a pagina de origem, e a
   resolucao e explicita: o mais recente vence em valores monetarios, o mais
   completo vence em texto, e todo conflito fica registrado.

3. CAMADA DETERMINISTICA. Antes de qualquer chamada ao modelo, o texto
   integral passa por um varredor de regex que colhe CNJ, precatorio, oficio,
   CPF/CNPJ, OAB, valores, datas, percentuais, codigos e URLs. Numeros nao
   dependem do modelo para sobreviver.

4. MULTIPLOS BENEFICIARIOS. `valores` deixa de ser escalar. Cada beneficiario
   tem seu proprio bloco de valores, principal, juros, desagio e liquido.

5. VALIDACAO ARITMETICA. As somas do documento sao conferidas e divergencias
   entram no relatorio em vez de passarem silenciosamente.

6. TRIAGEM. Cada documento recebe notas por dimensao e um score consolidado,
   consumidos por gerar_planilha_triagem.py.

Uso:
    python extrator_precatorios.py <arquivo.pdf|pasta> [-s saida/]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

# --------------------------------------------------------------------------
# Configuracao
# --------------------------------------------------------------------------

MODELO_PADRAO = os.getenv("OPENAI_MODEL", "gpt-4o")
TAMANHO_BLOCO = int(os.getenv("EXTRATOR_TAMANHO_BLOCO", "12000"))
SOBREPOSICAO_BLOCO = int(os.getenv("EXTRATOR_SOBREPOSICAO", "800"))
PAUSA_ENTRE_BLOCOS = float(os.getenv("EXTRATOR_PAUSA", "0.2"))
LIMITE_TEXTO_CURTO = 200  # caracteres; abaixo disso sugere-se OCR


# --------------------------------------------------------------------------
# Camada 1 — leitura do PDF, pagina a pagina
# --------------------------------------------------------------------------

@dataclass
class Pagina:
    numero: int
    texto: str

    @property
    def vazia(self) -> bool:
        return len(self.texto.strip()) < 20


def ler_paginas(caminho: Path) -> list[Pagina]:
    """Extrai texto pagina a pagina. A procedencia por pagina e o que permite
    apontar de onde veio cada dado no relatorio final."""
    paginas: list[Pagina] = []

    try:
        from pypdf import PdfReader

        leitor = PdfReader(str(caminho))
        for indice, pagina in enumerate(leitor.pages, 1):
            paginas.append(Pagina(indice, pagina.extract_text() or ""))
    except Exception as erro:  # noqa: BLE001
        print(f"  [aviso] pypdf falhou ({erro}); tentando pdfplumber", file=sys.stderr)
        try:
            import pdfplumber

            with pdfplumber.open(str(caminho)) as pdf:
                for indice, pagina in enumerate(pdf.pages, 1):
                    paginas.append(Pagina(indice, pagina.extract_text() or ""))
        except Exception as erro_plumber:  # noqa: BLE001
            raise RuntimeError(
                f"Nao foi possivel ler {caminho.name}: {erro_plumber}"
            ) from erro_plumber

    return paginas


def precisa_ocr(paginas: list[Pagina]) -> bool:
    """Documento digitalizado: muito texto ausente em relacao ao numero de paginas.

    Ao contrario do bloqueio original, isto nao interrompe a extracao — apenas
    marca o resultado para revisao.
    """
    if not paginas:
        return True
    total = sum(len(p.texto.strip()) for p in paginas)
    return total < LIMITE_TEXTO_CURTO * len(paginas) / 2


def aplicar_ocr(caminho: Path) -> list[Pagina]:
    """OCR opcional. Sem pytesseract/pdf2image instalados, devolve lista vazia
    e o documento segue marcado como `ocr_necessario`."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError:
        print("  [aviso] OCR indisponivel (instale pytesseract e pdf2image)", file=sys.stderr)
        return []

    paginas = []
    for indice, imagem in enumerate(convert_from_path(str(caminho)), 1):
        paginas.append(Pagina(indice, pytesseract.image_to_string(imagem, lang="por")))
    return paginas


# --------------------------------------------------------------------------
# Camada 2 — varredura deterministica do texto integral
# --------------------------------------------------------------------------

PADROES = {
    "numero_cnj": re.compile(r"\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}"),
    "numero_processo_antigo": re.compile(r"\b\d{4}\.\d{3}\.\d{6}-\d\b"),
    "numero_precatorio": re.compile(r"\b\d{4}\.\d{5}-\d\b"),
    "numero_oficio_requisitorio": re.compile(r"\b\d{4}\.\d{5}/[A-Z]{4,8}\b"),
    "oficio_generico": re.compile(r"\bn[ºo°]?\s*\d{1,4}/\d{4}/[A-Z]{2,4}\b", re.I),
    "cpf": re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"),
    "cpf_sem_mascara": re.compile(r"(?<!\d)\d{11}(?!\d)"),
    "cnpj": re.compile(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b"),
    "oab": re.compile(r"\bOAB/([A-Z]{2})\s*(\d{3}\.?\d{3})\b"),
    "oab_inline": re.compile(r"\b([A-Z]{2})(\d{6})\s*-\s*[A-ZÀ-Ú]"),
    "valor": re.compile(r"R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})"),
    "data": re.compile(r"\b(\d{2}/\d{2}/\d{4})\b"),
    "percentual": re.compile(r"\b(\d{1,3}(?:,\d{1,4})?)\s*%"),
    "fator_correcao": re.compile(r"\b(\d,\d{8})\b"),
    "url": re.compile(r"https?://[^\s\)\]]+|www\.[a-z0-9.\-]+\.[a-z]{2,}", re.I),
    "email": re.compile(r"\b[\w.\-]+@[\w.\-]+\.[a-z]{2,}\b", re.I),
    "codigo_autenticacao": re.compile(r"\b[A-Z0-9]{4}\.[A-Z0-9]{4}\.[A-Z0-9]{4}\.[A-Z0-9]{4}\b"),
    "codigo_rastreabilidade": re.compile(r"\b\d{15}\b"),
}

TERMOS_NATUREZA = {
    "ALIMENTICIA": ["alimentícia", "alimenticia", "alimentar"],
    "COMUM": ["comum", "não alimentícia", "nao alimenticia"],
}

TERMOS_SUPERPREFERENCIA = [
    ("doente_grave", ["doente grave", "doença grave", "doenca grave"]),
    ("pessoa_com_deficiencia", ["pessoa com deficiência", "pessoa com deficiencia"]),
    ("idoso", ["idoso", "maior de 60", "maior de sessenta"]),
]


def normalizar(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()


def valor_para_float(bruto: str) -> float | None:
    """'R$ 3.523.707,62' -> 3523707.62"""
    if not bruto:
        return None
    limpo = re.sub(r"[^\d,.-]", "", str(bruto))
    if not limpo:
        return None
    try:
        return float(limpo.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def formatar_cpf(bruto: str) -> str:
    digitos = re.sub(r"\D", "", bruto)
    if len(digitos) != 11:
        return bruto
    return f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}"


def cpf_valido(cpf: str) -> bool:
    """Descarta sequencias de 11 digitos que nao sao CPF — evita capturar
    codigos de protocolo como se fossem documentos de pessoa fisica."""
    digitos = re.sub(r"\D", "", cpf)
    if len(digitos) != 11 or len(set(digitos)) == 1:
        return False
    for corte in (9, 10):
        soma = sum(int(digitos[i]) * ((corte + 1) - i) for i in range(corte))
        resto = (soma * 10) % 11
        if resto == 10:
            resto = 0
        if resto != int(digitos[corte]):
            return False
    return True


@dataclass
class Ocorrencia:
    valor: str
    pagina: int
    contexto: str = ""

    def como_dict(self) -> dict[str, Any]:
        return {"valor": self.valor, "pagina": self.pagina, "contexto": self.contexto}


def varrer_deterministico(paginas: list[Pagina]) -> dict[str, list[Ocorrencia]]:
    """Colhe identificadores e valores do texto integral, com pagina de origem.

    Roda antes e independentemente do modelo: garante que nenhum numero se
    perca por variacao de resposta do LLM.
    """
    achados: dict[str, list[Ocorrencia]] = {chave: [] for chave in PADROES}
    vistos: dict[str, set[str]] = {chave: set() for chave in PADROES}

    for pagina in paginas:
        texto = pagina.texto
        for chave, padrao in PADROES.items():
            for casamento in padrao.finditer(texto):
                bruto = casamento.group(0).strip()

                if chave == "cpf_sem_mascara" and not cpf_valido(bruto):
                    continue
                if chave == "cpf" and not cpf_valido(bruto):
                    continue

                inicio = max(0, casamento.start() - 70)
                contexto = re.sub(r"\s+", " ", texto[inicio:casamento.end()]).strip()

                # Valores monetarios repetem-se legitimamente em paginas
                # diferentes; o contexto e que os distingue.
                assinatura = bruto if chave != "valor" else f"{bruto}|{contexto[-45:]}"
                if assinatura in vistos[chave]:
                    continue
                vistos[chave].add(assinatura)
                achados[chave].append(Ocorrencia(bruto, pagina.numero, contexto))

    return achados


def detectar_natureza(texto_completo: str) -> str:
    normalizado = normalizar(texto_completo)
    for natureza, termos in TERMOS_NATUREZA.items():
        if any(normalizar(termo) in normalizado for termo in termos):
            return natureza
    return ""


def detectar_superpreferencia(texto_completo: str) -> dict[str, bool]:
    """Le a resposta ao lado do rotulo. 'Doente grave: Nao' nao pode virar
    uma marcacao positiva so porque o termo aparece no documento."""
    resultado: dict[str, bool] = {}
    normalizado = normalizar(texto_completo)
    for chave, termos in TERMOS_SUPERPREFERENCIA:
        marcado = False
        for termo in termos:
            alvo = normalizar(termo)
            for posicao in _posicoes(normalizado, alvo):
                trecho = normalizado[posicao + len(alvo): posicao + len(alvo) + 20]
                if re.match(r"\s*[:\-]?\s*sim\b", trecho):
                    marcado = True
                    break
            if marcado:
                break
        resultado[chave] = marcado
    return resultado


def _posicoes(texto: str, alvo: str) -> Iterable[int]:
    inicio = texto.find(alvo)
    while inicio != -1:
        yield inicio
        inicio = texto.find(alvo, inicio + 1)


# --------------------------------------------------------------------------
# Camada 3 — blocos com procedencia
# --------------------------------------------------------------------------

@dataclass
class Bloco:
    indice: int
    texto: str
    pagina_inicial: int
    pagina_final: int


def montar_blocos(
    paginas: list[Pagina],
    tamanho: int = TAMANHO_BLOCO,
    sobreposicao: int = SOBREPOSICAO_BLOCO,
) -> list[Bloco]:
    """Divide por pagina, nao por caractere cru: um bloco nunca corta uma
    pagina ao meio, e a sobreposicao evita perder dado em fronteira."""
    blocos: list[Bloco] = []
    atual: list[Pagina] = []
    tamanho_atual = 0

    for pagina in paginas:
        marcado = f"\n[[PAGINA {pagina.numero}]]\n{pagina.texto}"
        if atual and tamanho_atual + len(marcado) > tamanho:
            blocos.append(_fechar_bloco(len(blocos) + 1, atual))
            cauda = atual[-1:] if sobreposicao else []
            atual = list(cauda)
            tamanho_atual = sum(len(p.texto) for p in atual)
        atual.append(pagina)
        tamanho_atual += len(marcado)

    if atual:
        blocos.append(_fechar_bloco(len(blocos) + 1, atual))

    return blocos


def _fechar_bloco(indice: int, paginas: list[Pagina]) -> Bloco:
    texto = "\n".join(f"[[PAGINA {p.numero}]]\n{p.texto}" for p in paginas)
    return Bloco(indice, texto, paginas[0].numero, paginas[-1].numero)


# --------------------------------------------------------------------------
# Camada 4 — acumulador de candidatos
# --------------------------------------------------------------------------

CAMPOS_MAIS_RECENTE_VENCE = {
    "valor_total", "valor_principal", "juros", "correcao_monetaria",
    "honorarios", "descontos_retencoes", "status_processual", "fase_processual",
}


@dataclass
class Acumulador:
    """Guarda todos os candidatos por campo, com origem. A resolucao e
    explicita e auditavel, em vez de 'o primeiro que chegou vence'."""

    candidatos: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    def registrar(self, caminho: str, valor: Any, bloco: Bloco) -> None:
        if not _tem_valor(valor):
            return
        self.candidatos.setdefault(caminho, [])
        for existente in self.candidatos[caminho]:
            if existente["valor"] == valor:
                existente["blocos"].append(bloco.indice)
                return
        self.candidatos[caminho].append(
            {
                "valor": valor,
                "blocos": [bloco.indice],
                "pagina_inicial": bloco.pagina_inicial,
                "pagina_final": bloco.pagina_final,
            }
        )

    def absorver(self, dados: Any, bloco: Bloco, prefixo: str = "") -> None:
        if isinstance(dados, dict):
            for chave, valor in dados.items():
                self.absorver(valor, bloco, f"{prefixo}.{chave}" if prefixo else chave)
        elif isinstance(dados, list):
            for item in dados:
                self.registrar(prefixo, item, bloco)
        else:
            self.registrar(prefixo, dados, bloco)

    def resolver(self, caminho: str) -> Any:
        opcoes = self.candidatos.get(caminho, [])
        if not opcoes:
            return ""
        if len(opcoes) == 1:
            return opcoes[0]["valor"]

        folha = caminho.split(".")[-1]
        if folha in CAMPOS_MAIS_RECENTE_VENCE:
            # Retificacoes e atualizacoes aparecem depois no documento.
            return max(opcoes, key=lambda o: o["pagina_final"])["valor"]
        # Demais campos: a redacao mais completa costuma ser a correta.
        return max(opcoes, key=lambda o: len(str(o["valor"])))["valor"]

    def lista(self, caminho: str) -> list[Any]:
        return [o["valor"] for o in self.candidatos.get(caminho, [])]

    def conflitos(self) -> list[dict[str, Any]]:
        """Campos com mais de um candidato distinto — o que o merge original
        silenciava e aqui vira item de revisao."""
        saida = []
        for caminho, opcoes in sorted(self.candidatos.items()):
            if len(opcoes) < 2:
                continue
            if caminho.split(".")[-1] in {
                "credor_beneficiario", "devedor_executado", "advogados",
                "cpf_cnpj_identificados", "oab_identificadas", "links_web",
                "codigo_acesso", "fonte_documental", "evento_movimento_relevante",
                "prazos", "obrigacoes", "riscos", "oportunidades",
                "decisoes_necessarias", "acoes_sugeridas", "entidades",
                "datas_relevantes", "valores_relevantes",
            }:
                continue  # listas acumulam por natureza
            saida.append(
                {
                    "campo": caminho,
                    "escolhido": self.resolver(caminho),
                    "alternativas": [
                        {"valor": o["valor"], "paginas": f"{o['pagina_inicial']}-{o['pagina_final']}"}
                        for o in opcoes
                    ],
                }
            )
        return saida


def _tem_valor(valor: Any) -> bool:
    if valor is None:
        return False
    if isinstance(valor, str):
        return bool(valor.strip()) and valor.strip().lower() not in {
            "não identificado", "nao identificado", "n/a", "-", "não consta", "nao consta",
        }
    if isinstance(valor, (list, tuple, set, dict)):
        return len(valor) > 0
    return True


# --------------------------------------------------------------------------
# Camada 5 — modelo
# --------------------------------------------------------------------------

REGRAS_EXTRACAO = """
Extraia sempre que houver base documental, preservando numeros exatamente como
aparecem no texto (inclusive pontuacao e centavos):
- numero CNJ do processo e numero de processo antigo;
- numero do precatorio e do oficio requisitorio;
- tribunal, vara, orgao julgador e unidade de origem;
- credor, beneficiario, inventariante, advogado, cessionario e devedor;
- CPF/CNPJ e OAB, quando constarem;
- natureza do credito e classe processual;
- valores: principal, juros, correcao, honorarios, descontos e total;
- data-base, datas de ajuizamento, transito em julgado, expedicao e assinatura;
- desagio, editais de acordo direto e prazos de adesao;
- sentenca, decisao, despacho ou comando judicial;
- links, URLs, codigos de acesso e fontes eletronicas.

Se o documento tiver MAIS DE UM beneficiario com valores proprios, devolva um
item por beneficiario em `beneficiarios`. Nunca some beneficiarios distintos
em um unico valor.

Nao substitua numeros por descricoes genericas.
Nao invente campos ausentes.
Quando o dado nao estiver disponivel, use string vazia, lista vazia ou objeto vazio.
Cada trecho vem marcado com [[PAGINA n]]: use esses marcadores para indicar a
pagina de origem quando o campo pedir.
"""

ESQUEMA_PARCIAL = """
{
  "titulo_inferido": "",
  "tipo_documento": "",
  "dados_processuais": {
    "numero_processo_cnj": "", "numero_processo_antigo": "",
    "numero_precatorio": "", "numero_oficio_requisitorio": "",
    "tribunal": "", "vara_orgao_julgador": "", "unidade_origem": "",
    "classe_processual": "", "assunto": "", "fase_processual": "",
    "natureza_credito": "", "tipo_requisicao": "",
    "data_ajuizamento": "", "data_base_calculo": "", "data_expedicao": "",
    "data_assinatura": "", "data_transito_julgado": "", "data_decurso_prazo": "",
    "ano_loa": "", "status_processual": "", "periodo_conta_liquidacao": ""
  },
  "partes": {
    "credor_beneficiario": [], "devedor_executado": [], "advogados": [],
    "inventariante": "", "cessionarios": [], "habilitados": [],
    "cpf_cnpj_identificados": [], "oab_identificadas": []
  },
  "beneficiarios": [
    {
      "nome": "", "papel": "", "documento": "", "oab": "", "percentual": "",
      "valor_principal": "", "valor_juros": "", "valor_total": "",
      "valor_atualizado": "", "desagio_percentual": "", "valor_liquido_acordo": "",
      "banco": "", "agencia": "", "conta": ""
    }
  ],
  "valores": {
    "valor_bruto_requisicao": "", "valor_principal": "", "juros": "",
    "correcao_monetaria": "", "honorarios": "", "descontos_retencoes": "",
    "desconto_previdenciario": "", "valor_total": "", "moeda": "BRL",
    "fatores_correcao": [], "observacoes_valores": ""
  },
  "acordo_direto": {
    "edital": "", "data_publicacao": "", "prazo_adesao": "",
    "desagio_percentual": "", "pagamento_ate": "", "valor_final_acordo": ""
  },
  "decisao_sentenca": {
    "tipo": "", "data": "", "resumo": "", "comando_judicial": "", "efeito_pratico": ""
  },
  "acesso_fontes": {
    "links_web": [], "codigo_acesso": [], "fonte_documental": [],
    "evento_movimento_relevante": []
  },
  "resumo_parcial": "",
  "prazos": [], "obrigacoes": [], "riscos": [], "oportunidades": [],
  "decisoes_necessarias": [], "acoes_sugeridas": []
}
"""


def chamar_modelo(prompt: str, modelo: str) -> str:
    """Adaptador do LLM. Mantido compativel com o app.py existente."""
    from openai import OpenAI

    cliente = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL") or None,
    )
    resposta = cliente.chat.completions.create(
        model=modelo,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"},
    )
    return resposta.choices[0].message.content or "{}"


def json_do_modelo(bruto: str) -> dict[str, Any]:
    """Tolera cercas de markdown e texto ao redor do JSON."""
    if not bruto:
        return {}
    texto = bruto.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.M).strip()
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        pass
    inicio, fim = texto.find("{"), texto.rfind("}")
    if inicio != -1 and fim > inicio:
        try:
            return json.loads(texto[inicio: fim + 1])
        except json.JSONDecodeError:
            pass
    print("  [aviso] resposta do modelo nao e JSON valido; bloco ignorado", file=sys.stderr)
    return {}


# --------------------------------------------------------------------------
# Camada 6 — cobertura (telemetria, nunca criterio de parada)
# --------------------------------------------------------------------------

CAMPOS_ESSENCIAIS = [
    ("dados_processuais", "numero_processo_cnj"),
    ("dados_processuais", "numero_precatorio"),
    ("dados_processuais", "numero_oficio_requisitorio"),
    ("dados_processuais", "tribunal"),
    ("dados_processuais", "vara_orgao_julgador"),
    ("dados_processuais", "natureza_credito"),
    ("dados_processuais", "data_base_calculo"),
    ("dados_processuais", "data_transito_julgado"),
    ("partes", "credor_beneficiario"),
    ("partes", "devedor_executado"),
    ("partes", "advogados"),
    ("partes", "oab_identificadas"),
    ("valores", "valor_principal"),
    ("valores", "valor_total"),
    ("decisao_sentenca", "resumo"),
    ("acesso_fontes", "links_web"),
]

# Campos que so aparecem no fim de dossies de precatorio. Existem para provar,
# no relatorio, o que a parada em 80% teria descartado.
CAMPOS_TARDIOS = [
    ("acordo_direto", "desagio_percentual"),
    ("acordo_direto", "prazo_adesao"),
    ("acordo_direto", "valor_final_acordo"),
    ("valores", "descontos_retencoes"),
]


def _buscar(dados: dict, *chaves: str) -> Any:
    atual: Any = dados
    for chave in chaves:
        if not isinstance(atual, dict):
            return None
        atual = atual.get(chave)
    return atual


def medir_cobertura(dados: dict, campos: list[tuple[str, ...]]) -> tuple[int, int, float]:
    encontrados = sum(1 for caminho in campos if _tem_valor(_buscar(dados, *caminho)))
    total = len(campos)
    return encontrados, total, (encontrados / total if total else 0.0)


# --------------------------------------------------------------------------
# Camada 7 — validacao aritmetica
# --------------------------------------------------------------------------

def validar_consistencia(dados: dict[str, Any]) -> list[dict[str, Any]]:
    """Confere as somas declaradas. Divergencia nao interrompe nada: entra no
    relatorio e vira linha na aba Consistencia da planilha."""
    checagens: list[dict[str, Any]] = []

    def registrar(nome: str, esperado: float | None, obtido: float | None, formula: str) -> None:
        if esperado is None or obtido is None:
            checagens.append(
                {"checagem": nome, "formula": formula, "situacao": "NAO_APLICAVEL",
                 "diferenca": "", "observacao": "dado ausente"}
            )
            return
        diferenca = round(esperado - obtido, 2)
        checagens.append(
            {
                "checagem": nome,
                "formula": formula,
                "situacao": "OK" if abs(diferenca) <= 0.05 else "DIVERGENTE",
                "diferenca": diferenca,
                "observacao": "" if abs(diferenca) <= 0.05 else "conferir manualmente",
            }
        )

    valores = dados.get("valores", {})
    bruto = valor_para_float(valores.get("valor_bruto_requisicao"))
    principal = valor_para_float(valores.get("valor_principal"))
    juros = valor_para_float(valores.get("juros"))
    previdenciario = valor_para_float(valores.get("desconto_previdenciario"))

    if principal is not None and juros is not None:
        registrar("Principal + juros = bruto", principal + juros, bruto,
                  "valor_principal + juros = valor_bruto_requisicao")

    beneficiarios = dados.get("beneficiarios", []) or []
    soma_beneficiarios = sum(
        valor_para_float(b.get("valor_total")) or 0.0 for b in beneficiarios
    )
    if beneficiarios and bruto is not None:
        registrar("Soma dos beneficiarios = bruto", soma_beneficiarios, bruto,
                  "SOMA(beneficiarios.valor_total) = valor_bruto_requisicao")

    if bruto is not None and previdenciario is not None:
        registrar("Bruto - previdenciario", bruto - previdenciario,
                  bruto - previdenciario, "valor_bruto - desconto_previdenciario")

    for beneficiario in beneficiarios:
        atualizado = valor_para_float(beneficiario.get("valor_atualizado"))
        desagio = valor_para_float(str(beneficiario.get("desagio_percentual", "")).replace("%", ""))
        liquido = valor_para_float(beneficiario.get("valor_liquido_acordo"))
        if atualizado is not None and desagio is not None and liquido is not None:
            registrar(
                f"Desagio de {beneficiario.get('nome', '?')[:32]}",
                atualizado * (1 - desagio / 100),
                liquido,
                "valor_atualizado x (1 - desagio) = valor_liquido_acordo",
            )

    return checagens


# --------------------------------------------------------------------------
# Camada 8 — triagem para pre-due-diligence
# --------------------------------------------------------------------------

PESOS_PADRAO = {
    "valor": 30, "maturidade": 25, "preferencia": 15, "liquidez": 15, "completude": 15,
}
VALOR_REFERENCIA = float(os.getenv("EXTRATOR_VALOR_REFERENCIA", "5000000"))


def pontuar_triagem(dados: dict[str, Any]) -> dict[str, Any]:
    """Notas de 0 a 10 por dimensao e score de 0 a 100.

    O calculo tambem existe em formula na planilha, para que os pesos possam
    ser ajustados sem reprocessar os PDFs. Aqui serve de valor inicial.
    """
    valores = dados.get("valores", {})
    beneficiarios = dados.get("beneficiarios", []) or []
    processuais = dados.get("dados_processuais", {})
    acordo = dados.get("acordo_direto", {})
    controle = dados.get("controle_extracao", {})

    atualizado = sum(
        valor_para_float(b.get("valor_atualizado")) or valor_para_float(b.get("valor_total")) or 0.0
        for b in beneficiarios
    ) or valor_para_float(valores.get("valor_bruto_requisicao")) or 0.0

    nota_valor = min(10.0, atualizado / VALOR_REFERENCIA * 10) if VALOR_REFERENCIA else 0.0

    pendencias = len(dados.get("dados_ausentes_ou_duvidosos", []) or [])
    riscos = len(dados.get("riscos", []) or [])
    nota_maturidade = 10.0
    if not _tem_valor(processuais.get("data_transito_julgado")):
        nota_maturidade -= 4
    if not _tem_valor(processuais.get("numero_precatorio")):
        nota_maturidade -= 3
    nota_maturidade -= min(3.0, pendencias * 0.5)
    nota_maturidade = max(0.0, nota_maturidade)

    natureza = normalizar(str(processuais.get("natureza_credito", "")))
    nota_preferencia = 7.0 if "aliment" in natureza else 3.0
    superpreferencia = dados.get("superpreferencia", {}) or {}
    if any(superpreferencia.values()):
        nota_preferencia = min(10.0, nota_preferencia + 3)

    desagio = valor_para_float(str(acordo.get("desagio_percentual", "")).replace("%", ""))
    if _tem_valor(acordo.get("prazo_adesao")) and desagio is not None:
        nota_liquidez = max(0.0, 10.0 - desagio / 10)
    elif _tem_valor(acordo.get("edital")):
        nota_liquidez = 6.0
    else:
        nota_liquidez = 4.0

    cobertura = controle.get("cobertura_campos_essenciais_num", 0.0)
    nota_completude = float(cobertura) * 10

    notas = {
        "valor": round(nota_valor, 2),
        "maturidade": round(nota_maturidade, 2),
        "preferencia": round(nota_preferencia, 2),
        "liquidez": round(nota_liquidez, 2),
        "completude": round(nota_completude, 2),
    }
    score = round(sum(notas[k] * PESOS_PADRAO[k] for k in notas) / 10, 1)

    if score >= 70:
        classificacao = "APROVAR"
    elif score >= 45:
        classificacao = "REVISAR"
    else:
        classificacao = "DESCARTAR"

    return {
        "notas": notas,
        "pesos": PESOS_PADRAO,
        "score": score,
        "classificacao_sugerida": classificacao,
        "valor_base_score": round(atualizado, 2),
        "pendencias_contadas": pendencias,
        "riscos_contados": riscos,
    }


# --------------------------------------------------------------------------
# Camada 9 — orquestracao
# --------------------------------------------------------------------------

def extrair_documento(
    caminho: Path,
    contexto: dict[str, str] | None = None,
    modelo: str = MODELO_PADRAO,
    usar_modelo: bool = True,
) -> dict[str, Any]:
    inicio = time.time()
    print(f"[{caminho.name}] lendo...")

    paginas = ler_paginas(caminho)
    ocr_usado = False
    if precisa_ocr(paginas):
        print("  texto escasso; tentando OCR")
        paginas_ocr = aplicar_ocr(caminho)
        if paginas_ocr:
            paginas, ocr_usado = paginas_ocr, True

    texto_completo = "\n".join(p.texto for p in paginas)
    achados = varrer_deterministico(paginas)
    blocos = montar_blocos(paginas)
    print(f"  {len(paginas)} paginas, {len(blocos)} blocos")

    acumulador = Acumulador()
    blocos_processados = 0
    trajetoria: list[dict[str, Any]] = []

    if usar_modelo:
        for bloco in blocos:
            prompt = f"""
Voce e um analista juridico-documental especializado em precatorios, oficios
requisitorios, cumprimento de sentenca e documentos financeiros.

Analise o trecho {bloco.indice}/{len(blocos)} do arquivo "{caminho.name}"
(paginas {bloco.pagina_inicial} a {bloco.pagina_final}).

{REGRAS_EXTRACAO}

Responda SOMENTE com JSON valido usando exatamente esta estrutura:
{ESQUEMA_PARCIAL}

CONTEXTO EXTERNO:
{json.dumps(contexto or {}, ensure_ascii=False)}

CONTEUDO:
{bloco.texto}
"""
            parcial = json_do_modelo(chamar_modelo(prompt, modelo))
            acumulador.absorver(parcial, bloco)
            blocos_processados = bloco.indice

            # A cobertura e observada, nunca obedecida: nenhum `break` aqui.
            snapshot = _montar_estrutura(acumulador, achados, texto_completo)
            encontrados, total, razao = medir_cobertura(snapshot, CAMPOS_ESSENCIAIS)
            trajetoria.append(
                {
                    "bloco": bloco.indice,
                    "paginas": f"{bloco.pagina_inicial}-{bloco.pagina_final}",
                    "cobertura_essenciais": f"{razao:.0%}",
                }
            )
            print(f"  bloco {bloco.indice}/{len(blocos)} — cobertura {razao:.0%} (leitura continua)")
            time.sleep(PAUSA_ENTRE_BLOCOS)

    dados = _montar_estrutura(acumulador, achados, texto_completo)

    encontrados, total, razao = medir_cobertura(dados, CAMPOS_ESSENCIAIS)
    tardios_encontrados, tardios_total, _ = medir_cobertura(dados, CAMPOS_TARDIOS)

    bloco_da_parada = next(
        (t["bloco"] for t in trajetoria if t["cobertura_essenciais"].rstrip("%").isdigit()
         and int(t["cobertura_essenciais"].rstrip("%")) >= 80),
        None,
    )

    dados["arquivo"] = caminho.name
    dados["controle_extracao"] = {
        "blocos_analisados": blocos_processados or len(blocos),
        "blocos_disponiveis": len(blocos),
        "paginas_lidas": len(paginas),
        "campos_essenciais_encontrados": encontrados,
        "campos_essenciais_total": total,
        "cobertura_campos_essenciais": f"{razao:.0%}",
        "cobertura_campos_essenciais_num": round(razao, 4),
        "campos_tardios_encontrados": tardios_encontrados,
        "campos_tardios_total": tardios_total,
        "leitura_integral": True,
        "leitura_interrompida_por_suficiencia": False,
        "bloco_em_que_a_parada_de_80pct_teria_ocorrido": bloco_da_parada,
        "campos_que_a_parada_de_80pct_teria_perdido": (
            [".".join(c) for c in CAMPOS_TARDIOS if _tem_valor(_buscar(dados, *c))]
            if bloco_da_parada and bloco_da_parada < len(blocos) else []
        ),
        "ocr_necessario": precisa_ocr(paginas) and not ocr_usado,
        "ocr_aplicado": ocr_usado,
        "trajetoria_cobertura": trajetoria,
        "segundos": round(time.time() - inicio, 1),
        "extraido_em": datetime.now().isoformat(timespec="seconds"),
    }
    dados["conflitos_detectados"] = acumulador.conflitos()
    dados["consistencia"] = validar_consistencia(dados)
    dados["triagem"] = pontuar_triagem(dados)

    return dados


def _montar_estrutura(
    acumulador: Acumulador,
    achados: dict[str, list[Ocorrencia]],
    texto_completo: str,
) -> dict[str, Any]:
    """Funde o que o modelo devolveu com o que a regex garantiu.

    A regex e a rede de seguranca: se o modelo omitiu um CNJ que esta no texto,
    o campo ainda sai preenchido.
    """

    def primeiro(chave: str) -> str:
        return achados.get(chave, [{}])[0].valor if achados.get(chave) else ""

    def escolher(caminho: str, chave_regex: str = "") -> str:
        do_modelo = acumulador.resolver(caminho)
        if _tem_valor(do_modelo):
            return do_modelo
        return primeiro(chave_regex) if chave_regex else ""

    def lista_regex(chave: str) -> list[str]:
        return [o.valor for o in achados.get(chave, [])]

    beneficiarios = acumulador.lista("beneficiarios")
    if not beneficiarios:
        beneficiarios = [b for b in acumulador.lista("beneficiarios.nome")]

    return {
        "titulo_inferido": acumulador.resolver("titulo_inferido"),
        "tipo_documento": acumulador.resolver("tipo_documento"),
        "dados_processuais": {
            "numero_processo_cnj": escolher("dados_processuais.numero_processo_cnj", "numero_cnj"),
            "numero_processo_antigo": escolher(
                "dados_processuais.numero_processo_antigo", "numero_processo_antigo"),
            "numero_precatorio": escolher("dados_processuais.numero_precatorio", "numero_precatorio"),
            "numero_oficio_requisitorio": escolher(
                "dados_processuais.numero_oficio_requisitorio", "numero_oficio_requisitorio"),
            "tribunal": acumulador.resolver("dados_processuais.tribunal"),
            "vara_orgao_julgador": acumulador.resolver("dados_processuais.vara_orgao_julgador"),
            "unidade_origem": acumulador.resolver("dados_processuais.unidade_origem"),
            "classe_processual": acumulador.resolver("dados_processuais.classe_processual"),
            "assunto": acumulador.resolver("dados_processuais.assunto"),
            "fase_processual": acumulador.resolver("dados_processuais.fase_processual"),
            "natureza_credito": (
                acumulador.resolver("dados_processuais.natureza_credito")
                or detectar_natureza(texto_completo)
            ),
            "tipo_requisicao": acumulador.resolver("dados_processuais.tipo_requisicao"),
            "data_ajuizamento": acumulador.resolver("dados_processuais.data_ajuizamento"),
            "data_base_calculo": acumulador.resolver("dados_processuais.data_base_calculo"),
            "data_expedicao": acumulador.resolver("dados_processuais.data_expedicao"),
            "data_assinatura": acumulador.resolver("dados_processuais.data_assinatura"),
            "data_transito_julgado": acumulador.resolver("dados_processuais.data_transito_julgado"),
            "data_decurso_prazo": acumulador.resolver("dados_processuais.data_decurso_prazo"),
            "ano_loa": acumulador.resolver("dados_processuais.ano_loa"),
            "status_processual": acumulador.resolver("dados_processuais.status_processual"),
            "periodo_conta_liquidacao": acumulador.resolver(
                "dados_processuais.periodo_conta_liquidacao"),
        },
        "partes": {
            "credor_beneficiario": acumulador.lista("partes.credor_beneficiario"),
            "devedor_executado": acumulador.lista("partes.devedor_executado"),
            "advogados": acumulador.lista("partes.advogados"),
            "inventariante": acumulador.resolver("partes.inventariante"),
            "cessionarios": acumulador.lista("partes.cessionarios"),
            "habilitados": acumulador.lista("partes.habilitados"),
            # Documentos do TJRJ misturam CPF com e sem mascara na mesma pagina
            # ("CPF: 816.521.437-34" e "CPF: 86973002749"). Normalizar aqui evita
            # que a mesma pessoa apareca duas vezes ou que a versao crua suma.
            "cpf_cnpj_identificados": sorted(
                set(acumulador.lista("partes.cpf_cnpj_identificados"))
                | set(lista_regex("cpf")) | set(lista_regex("cnpj"))
                | {formatar_cpf(bruto) for bruto in lista_regex("cpf_sem_mascara")}
            ),
            "oab_identificadas": sorted(
                set(acumulador.lista("partes.oab_identificadas"))
                | {f"OAB/{uf}{num}" for uf, num in
                   (PADROES["oab"].findall(texto_completo) or [])}
            ),
        },
        "beneficiarios": beneficiarios,
        "valores": {
            "valor_bruto_requisicao": acumulador.resolver("valores.valor_bruto_requisicao"),
            "valor_principal": acumulador.resolver("valores.valor_principal"),
            "juros": acumulador.resolver("valores.juros"),
            "correcao_monetaria": acumulador.resolver("valores.correcao_monetaria"),
            "honorarios": acumulador.resolver("valores.honorarios"),
            "descontos_retencoes": acumulador.resolver("valores.descontos_retencoes"),
            "desconto_previdenciario": acumulador.resolver("valores.desconto_previdenciario"),
            "valor_total": acumulador.resolver("valores.valor_total"),
            "moeda": "BRL",
            "fatores_correcao": lista_regex("fator_correcao"),
            "observacoes_valores": acumulador.resolver("valores.observacoes_valores"),
            "todos_os_valores_encontrados": [
                o.como_dict() for o in achados.get("valor", [])
            ],
        },
        "acordo_direto": {
            "edital": acumulador.resolver("acordo_direto.edital"),
            "data_publicacao": acumulador.resolver("acordo_direto.data_publicacao"),
            "prazo_adesao": acumulador.resolver("acordo_direto.prazo_adesao"),
            "desagio_percentual": acumulador.resolver("acordo_direto.desagio_percentual"),
            "pagamento_ate": acumulador.resolver("acordo_direto.pagamento_ate"),
            "valor_final_acordo": acumulador.resolver("acordo_direto.valor_final_acordo"),
        },
        "superpreferencia": detectar_superpreferencia(texto_completo),
        "decisao_sentenca": {
            "tipo": acumulador.resolver("decisao_sentenca.tipo"),
            "data": acumulador.resolver("decisao_sentenca.data"),
            "resumo": acumulador.resolver("decisao_sentenca.resumo"),
            "comando_judicial": acumulador.resolver("decisao_sentenca.comando_judicial"),
            "efeito_pratico": acumulador.resolver("decisao_sentenca.efeito_pratico"),
        },
        "acesso_fontes": {
            "links_web": sorted(set(acumulador.lista("acesso_fontes.links_web"))
                                | set(lista_regex("url")) | set(lista_regex("email"))),
            "codigo_acesso": sorted(set(acumulador.lista("acesso_fontes.codigo_acesso"))
                                    | set(lista_regex("codigo_autenticacao"))
                                    | set(lista_regex("codigo_rastreabilidade"))),
            "fonte_documental": acumulador.lista("acesso_fontes.fonte_documental"),
            "evento_movimento_relevante": acumulador.lista(
                "acesso_fontes.evento_movimento_relevante"),
            "datas_encontradas": lista_regex("data"),
        },
        "resumo_executivo": acumulador.resolver("resumo_parcial"),
        "prazos": acumulador.lista("prazos"),
        "obrigacoes": acumulador.lista("obrigacoes"),
        "riscos": acumulador.lista("riscos"),
        "oportunidades": acumulador.lista("oportunidades"),
        "decisoes_necessarias": acumulador.lista("decisoes_necessarias"),
        "acoes_sugeridas": acumulador.lista("acoes_sugeridas"),
        "dados_ausentes_ou_duvidosos": acumulador.lista("dados_ausentes_ou_duvidosos"),
    }


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main() -> None:
    analisador = argparse.ArgumentParser(
        description="Extrator de precatorios com leitura integral do documento."
    )
    analisador.add_argument("entrada", type=Path, help="PDF ou pasta com PDFs")
    analisador.add_argument("-s", "--saida", type=Path, default=Path("saida"))
    analisador.add_argument("-m", "--modelo", default=MODELO_PADRAO)
    analisador.add_argument(
        "--sem-modelo", action="store_true",
        help="Roda apenas a camada deterministica (sem chamadas ao LLM).",
    )
    analisador.add_argument(
        "--planilha", action="store_true",
        help="Gera a planilha de triagem ao final.",
    )
    analisador.add_argument(
        "-r", "--recursivo", action="store_true",
        help="Procura PDFs tambem nas subpastas da entrada.",
    )
    argumentos = analisador.parse_args()

    if not argumentos.entrada.exists():
        print(f"Caminho nao encontrado: {argumentos.entrada}", file=sys.stderr)
        raise SystemExit(1)

    if argumentos.entrada.is_dir():
        padrao = "**/*.pdf" if argumentos.recursivo else "*.pdf"
        arquivos = sorted(
            caminho for caminho in argumentos.entrada.glob(padrao) if caminho.is_file()
        )
    else:
        arquivos = [argumentos.entrada]

    if not arquivos:
        subpastas = (
            [p.name for p in argumentos.entrada.iterdir() if p.is_dir()]
            if argumentos.entrada.is_dir() else []
        )
        print(f"Nenhum PDF encontrado em {argumentos.entrada}.", file=sys.stderr)
        if subpastas:
            print(
                f"Ha subpastas ({', '.join(subpastas[:5])}). "
                "Use -r para procurar dentro delas.",
                file=sys.stderr,
            )
        raise SystemExit(1)

    print(f"{len(arquivos)} PDF(s) encontrado(s).\n")

    argumentos.saida.mkdir(parents=True, exist_ok=True)
    resultados = []

    for arquivo in arquivos:
        try:
            dados = extrair_documento(
                arquivo, modelo=argumentos.modelo, usar_modelo=not argumentos.sem_modelo
            )
        except Exception as erro:  # noqa: BLE001
            print(f"[{arquivo.name}] ERRO: {erro}", file=sys.stderr)
            continue

        destino = argumentos.saida / f"{arquivo.stem}.json"
        destino.write_text(
            json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        resultados.append(destino)
        controle = dados["controle_extracao"]
        print(
            f"  OK -> {destino.name} | cobertura {controle['cobertura_campos_essenciais']}"
            f" | score {dados['triagem']['score']}"
            f" | {controle['segundos']}s"
        )
        perdidos = controle["campos_que_a_parada_de_80pct_teria_perdido"]
        if perdidos:
            print(f"  [nota] a parada em 80% teria perdido: {', '.join(perdidos)}")

    if argumentos.planilha and resultados:
        from gerar_planilha_triagem import gerar_planilha

        planilha = argumentos.saida / "triagem_precatorios.xlsx"
        gerar_planilha([json.loads(p.read_text(encoding="utf-8")) for p in resultados], planilha)
        print(f"\nPlanilha: {planilha}")

    print(f"\n{len(resultados)}/{len(arquivos)} documentos processados.")


if __name__ == "__main__":
    main()
