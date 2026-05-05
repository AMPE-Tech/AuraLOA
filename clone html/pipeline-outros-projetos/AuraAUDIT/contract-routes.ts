import { Express, Request, Response } from "express";
import { requireAuth } from "./auth";
import { db } from "./db";
import { contractSignatures, clients, users } from "@shared/schema";
import { eq, desc, or } from "drizzle-orm";
import { createHash } from "crypto";
import { z } from "zod";
import { validateCNPJ, validateCPF, detectDocumentType } from "@shared/validators";

const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().min(11).optional(),
  contactName: z.string().min(2).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const CONTRACT_VERSION = "5.5.0";

function generateContractText(auditorData: any, clientData: any): string {
  const auditorName = auditorData?.name || "CTS Brasil - Consultoria em Viagens Corporativas";
  const auditorCnpj = auditorData?.cnpj || "00.000.000/0001-00";
  const auditorEmail = auditorData?.contactEmail || "marcos@cts-brasil.com";
  const auditorPhone = auditorData?.contactPhone || "11 99103-6692";
  const auditorAddress = auditorData?.address || "Av. Paulista, 726 - 17 andar, sala 1707";
  const auditorCity = auditorData?.city || "Sao Paulo";
  const auditorState = auditorData?.state || "SP";
  const auditorContactName = auditorData?.contactName || "Marcos Costa";
  const clientName = clientData?.name || "Cliente";
  const clientCnpj = clientData?.cnpj || "00.000.000/0000-00";
  const clientEmail = clientData?.contactEmail || "";
  const clientAddress = clientData?.address || "";
  const clientCity = clientData?.city || "";
  const clientState = clientData?.state || "";
  const clientContactName = clientData?.contactName || "";

  return `CONTRATO DE PRESTACAO DE SERVICOS DE AUDITORIA E CONSULTORIA ESPECIALIZADA EM VIAGENS E EVENTOS CORPORATIVOS

Contrato n. AUR-2025-0042 | Versao ${CONTRACT_VERSION}
Data da Proposta: 11 de Fevereiro de 2026
Referencia: Proposta Comercial Ajustada

CONTRATANTE: ${clientName}
CNPJ: ${clientCnpj}
Endereco: ${clientAddress}${clientCity ? `, ${clientCity}` : ""}${clientState ? ` - ${clientState}` : ""}
Email: ${clientEmail}
Atencao: ${clientContactName}

CONTRATADA: ${auditorName}
CNPJ: ${auditorCnpj}
Endereco: ${auditorAddress}${auditorCity ? `, ${auditorCity}` : ""}${auditorState ? ` - ${auditorState}` : ""}
Email: ${auditorEmail}
Telefone: ${auditorPhone}
Responsavel: ${auditorContactName} — Chief Executive Officer

============================================================
PARTE I — PROPOSTA TECNICA
============================================================

1. OBJETO DO CONTRATO

1.1. Prestacao de servicos de auditoria completa e independente da gestao de viagens corporativas do ${clientName}, com escopo ampliado voltado a:
  a) Identificacao de falhas operacionais, financeiras, sistemicas e de conformidade
  b) Mapeamento de vulnerabilidades
  c) Proposicao de acoes corretivas e oportunidades de melhoria continua
1.2. A auditoria abrange os exercicios de 2024 e 2025, considerando o volume, a complexidade e a criticidade do ambiente operacional envolvido.
1.3. O ${clientName}, alinhado as melhores praticas de governanca corporativa, controle interno e eficiencia operacional, manifesta o interesse na realizacao de uma auditoria completa da gestao de viagens corporativas.

2. SOBRE A CONTRATADA

2.1. A ${auditorName} e pioneira no mercado brasileiro de auditoria em viagens e eventos corporativos, criada em 2007 para auxiliar empresas na gestao financeira de viagens e eventos corporativos atraves de servicos de revisao tecnica, consultoria, treinamento e suporte que visam principalmente a reducao de custos, apuracao e recuperacao de valores.
2.2. Principais resultados acumulados (2015-2025):
  - Mais de R$ 2,8 bilhoes em volume revisado
  - Mais de R$ 448 milhoes em economia e recuperacao de valores
  - Media de resultado superior a 16%
2.3. Principais inconsistencias identificadas nos projetos anteriores: fraude, retencoes, reembolsos, cobranca de fee e descumprimento de acordos corporativos.

3. ESCOPO DA AUDITORIA

3.1. Periodo Analisado:
  a) Exercicio de 2024
  b) Exercicio de 2025

3.2. Ambientes e Sistemas Envolvidos:
  a) OBT (Online Booking Tool)
  b) Backoffice / ERP
  c) GDS, BSPlink e demais sistemas integrados

3.3. Volume Financeiro Auditado:
  Conforme definido na proposta comercial aceita pelo CONTRATANTE.

3.4. Abrangencia Tecnica da Auditoria:
  a) Conformidade com politicas internas e melhores praticas de mercado
  b) Governanca dos processos de viagens corporativas
  c) Integridade e consistencia dos dados entre OBT, Backoffice e faturamento
  d) Aderencia contratual com fornecedores e parceiros
  e) Analise de controles, excecoes, aprovacoes e alcadas
  f) Identificacao de falhas operacionais recorrentes
  g) Mapeamento de vulnerabilidades financeiras e sistemicas
  h) Avaliacao de riscos de perdas, desperdicios ou exposicoes indevidas
  i) Oportunidades de otimizacao de processos e reducao de custos

4. METODOLOGIA DE TRABALHO

A metodologia aplicada segue padroes utilizados em projetos de auditoria corporativa de grande porte, estruturada nas seguintes etapas:

4.1. Diagnostico Inicial e Entendimento do Ambiente
4.2. Coleta, consolidacao e cruzamento de dados
4.3. Analise tecnica, financeira e operacional
4.4. Identificacao de falhas, riscos e vulnerabilidades
4.5. Validacao de achados com as areas envolvidas
4.6. Elaboracao de relatorio executivo e tecnico
4.7. Apresentacao dos resultados e recomendacoes

5. CRONOGRAMA DE REFERENCIA — 15 DIAS

Fase 01 | Dias 1-2  | Revisao de Escopo
Revisao final do escopo do projeto, alinhamento de objetivos, validacao das premissas, definicao dos criterios de auditoria e confirmacao dos acessos necessarios.

Fase 02 | Dias 3-5  | Coleta de Dados
Coleta estruturada das bases de dados, extracoes dos sistemas (OBT, Backoffice, relatorios financeiros e operacionais) e organizacao das informacoes para analise.

Fase 03 | Dias 6-10 | Reconciliacao
Cruzamento e reconciliacao das informacoes coletadas, identificacao de inconsistencias, falhas operacionais, vulnerabilidades financeiras e oportunidades de recuperacao ou economia.

Fase 04 | Dias 11-12 | Apresentacao dos Resultados
Consolidacao dos achados, validacao preliminar dos resultados e preparacao do material executivo com os valores, riscos e oportunidades identificadas.

Fase 05 | Dias 13-14 | Ajustes e Validacoes
Ajustes finais dos achados com base em validacoes junto as areas envolvidas, refinamento das analises e consolidacao das recomendacoes.

Fase 06 | Dia 15 | Entrega Final
Entrega do relatorio executivo e tecnico final, apresentacao formal dos resultados e encaminhamento das recomendacoes e proximos passos.

Observacao Importante: Os prazos acima consideram a disponibilizacao tempestiva dos acessos, bases de dados e documentos necessarios para execucao das atividades.

6. ENTREGAVEIS

6.1. Relatorio executivo consolidado
6.2. Relatorio tecnico detalhado com achados, evidencias e analises
6.3. Mapeamento de riscos e vulnerabilidades
6.4. Recomendacoes praticas para correcao e melhoria
6.5. Plano de acao sugerido, priorizado por impacto e risco
6.6. Dashboard Interativo de Resultados (tempo real via plataforma AuraAUDIT)
6.7. Cadeia de Custodia Digital Completa (continuo)

7. DOCUMENTACAO E ACESSOS NECESSARIOS

Para execucao das atividades, serao necessarios os seguintes documentos e acessos:

7.1. Contratos com prestadores e clientes
7.2. Back office da agencia
7.3. Administracao BSPLink, voeGol, voeAzul e demais cias integradas
7.4. Portais administrativos de redes hoteleiras, operadores e consolidadores
7.5. Todos os acordos corporativos (cias aereas, hotelaria, banco, etc.)
7.6. Sistema de OBTs e GDSs
7.7. Controle de reembolso e credito conciliados
7.8. Relatorios gerenciais de pagamentos realizados e pendentes
7.9. Relatorios gerenciais de receitas recebidas e pendentes
7.10. Extratos originais dos cartoes de credito utilizados
7.11. Reservas originais e faturas de hospedagens pagas
7.12. Relatorio de cobranca de FEE, Rebate, Comissoes e Incentivos

As atividades serao iniciadas somente apos confirmacao dos acessos e disponibilidade da documentacao.

============================================================
PARTE II — PROPOSTA COMERCIAL
============================================================

8. MODELO DE PRECIFICACAO

8.1. Modalidade: Honorarios por Hora + Taxa de Sucesso (Success Fee)
Esta modalidade combina um custo fixo por hora com uma Taxa de Sucesso atrelada aos resultados financeiros efetivamente obtidos.

8.2. Honorarios Fixos por Hora:

  Perfil Profissional: Auditor Senior
  Valor Hora: R$ 240,00
  Horas Estimadas: 52 horas
  Valor Estimado: R$ 12.500,00

  Subtotal Honorarios Fixos: R$ 12.500,00

8.3. Taxa de Sucesso (Success Fee):

  Percentual: 20%

  A Taxa de Sucesso incidira exclusivamente sobre os valores financeiros efetivamente reconhecidos, validados e implementados pelo contratante, decorrentes de:
  a) Recuperacao de valores pagos indevidamente
  b) Creditos aplicados ou compensados
  c) Perdas evitadas comprovadas
  d) Economias financeiras efetivamente implementadas

8.4. Condicoes Gerais de Precificacao:
  a) Os valores acima sao estimativas e poderao ser ajustados conforme o escopo final aprovado
  b) Nao estao inclusas despesas extraordinarias, viagens, hospedagem e locomocao da equipe. Qualquer despesa aplicavel devera ser previamente autorizada
  c) A proposta possui validade de 30 (trinta) dias a contar da data de emissao

============================================================
PARTE III — GOVERNANCA, CONFIDENCIALIDADE E INDEPENDENCIA
============================================================

9. GOVERNANCA E CONFIDENCIALIDADE

9.1. Confidencialidade: Todas as informacoes compartilhadas sao tratadas como confidenciais e protegidas por NDA assinado entre as partes. Nenhuma informacao sera divulgada a terceiros sem autorizacao expressa do contratante.
9.2. Independencia tecnica: A equipe de auditoria mantem total independencia e imparcialidade durante todo o processo, sem vinculo com as areas auditadas.
9.3. Rastreabilidade juridica: Todos os dados analisados sao mantidos em cadeia de custodia digital certificada, com hashes SHA-256 deterministicos.
9.4. Transparencia metodologica: A metodologia aplicada e documentada e disponibilizada ao contratante para verificacao.
9.5. Cadeia de Custodia: Conformidade com Lei 13.964/2019 (Pacote Anticrime) — todos os dados e evidencias seguem cadeia de custodia digital com trilha de auditoria imutavel.

10. PROTECAO DE DADOS

10.1. O tratamento de dados pessoais segue rigorosamente a LGPD (Lei 13.709/2018), com medidas tecnicas e administrativas de seguranca.
10.2. Dados de CPF sao armazenados e exibidos com mascaramento parcial.
10.3. Dados do contratante sao utilizados exclusivamente para os fins previstos neste contrato.

11. PROPRIEDADE INTELECTUAL

11.1. Os relatorios e analises produzidos sao de propriedade do contratante.
11.2. A metodologia, ferramentas, modelos de IA e plataforma tecnologica permanecem propriedade da ${auditorName}.

============================================================
PARTE IV — DISPOSICOES CONTRATUAIS
============================================================

12. SLA — ACORDO DE NIVEL DE SERVICO

12.1. Tempo de resposta a incidentes criticos: ate 4 horas uteis
12.2. Atualizacao de status do projeto: diariamente via dashboard
12.3. Entrega de relatorios parciais: ate 48 horas apos cada fase
12.4. Entrega do relatorio final: ate 5 dias uteis apos conclusao
12.5. Reunioes de alinhamento: semanalmente ou sob demanda
12.6. Disponibilidade da equipe: dias uteis, 08h as 18h

13. VIGENCIA

13.1. Inicio: na data de assinatura deste contrato
13.2. Prazo do projeto: 15 dias uteis apos confirmacao dos acessos e documentacao
13.3. Vigencia do contrato: ate 31/12/2026
13.4. Podendo ser prorrogado mediante termo aditivo

14. CADASTRO E VALIDACAO DE PARTES

14.1. CNPJ validado matematicamente (algoritmo de digitos verificadores) antes de qualquer operacao
14.2. Consulta a Receita Federal (BrasilAPI) para preenchimento automatico de dados cadastrais
14.3. CPF do representante legal validado matematicamente quando informado
14.4. Validacao aplicada em: cadastro de clientes, assinatura de contrato, perfis de empresa

15. CADEIA DE CUSTODIA DIGITAL

15.1. Todos os dados e evidencias sao mantidos em cadeia de custodia digital certificada
15.2. Hashes SHA-256 deterministicos para cada registro, documento e artefato
15.3. Trilha de auditoria imutavel com integridade verificavel
15.4. Conformidade com Lei 13.964/2019 (Pacote Anticrime)

16. SISTEMA ANTIREGRESSAO

16.1. Toda alteracao em dados auditados e registrada com estado anterior (dataBefore) e posterior (dataAfter)
16.2. Hash de integridade SHA-256 calculado para cada entrada da trilha de auditoria
16.3. Registros de auditoria sao imutaveis (append-only) — nao podem ser editados ou excluidos
16.4. Versionamento de contratos: cada versao gera novo SHA-256, versoes anteriores permanecem registradas
16.5. Validacao matematica de documentos (CNPJ/CPF) impede regressao de dados cadastrais invalidos

17. RESCISAO

17.1. O contrato pode ser rescindido por qualquer das partes com aviso previo de 30 dias, resguardados os direitos sobre trabalhos ja realizados.
17.2. Em caso de rescisao, os honorarios fixos serao devidos proporcionalmente as horas efetivamente trabalhadas.
17.3. A Taxa de Sucesso sera devida sobre resultados ja validados e implementados ate a data da rescisao.

18. VALIDADE JURIDICA DA ASSINATURA ELETRONICA

18.1. Este contrato e assinado eletronicamente nos termos da Lei 14.063/2020 (assinatura eletronica simples) e da Medida Provisoria 2.200-2/2001
18.2. Integridade garantida por hash criptografico SHA-256
18.3. Registrados: IP, user-agent, timestamp, identificacao do signatario e CPF (quando informado)
18.4. Cadeia de custodia da assinatura: contrato texto -> SHA-256 -> assinatura -> registro imutavel

19. CANAIS DE ASSINATURA E DISTRIBUICAO DO CONTRATO

19.1. Disponibilidade: o contrato esta disponivel para assinatura online (via plataforma AuraAUDIT) e offline (versao para impressao e assinatura manual)
19.2. Assinatura via plataforma: registro automatico de SHA-256, IP, user-agent, timestamp e CPF
19.3. Envio por email ou WhatsApp: com link direto para visualizacao e assinatura digital
19.4. Equivalencia juridica: a assinatura eletronica realizada em qualquer canal possui a mesma validade juridica nos termos da Lei 14.063/2020 e MP 2.200-2/2001

20. FORO

20.1. Fica eleito o Foro da Comarca de Sao Paulo - SP para dirimir quaisquer controversias oriundas deste contrato, com renuncia expressa a qualquer outro, por mais privilegiado que seja.

============================================================
PARTE V — PLATAFORMA DIGITAL AURAAUDIT
============================================================

21. AI DESK — 11 SERVICOS DE IA SOB DEMANDA

21.1. A plataforma AuraAUDIT disponibiliza 11 servicos de inteligencia artificial especializados em Travel & Expense, cada um com precificacao transparente baseada em creditos:

  S1. Conciliacao e Reconciliacao — base 100 creditos + 5/arquivo
       Add-on: Conciliacao multi-via 4+ fontes (+60 creditos)
  S2. Revisao de Contratos — base 60 creditos + 6/pagina
  S3. Resposta a Edital/RFP — base 120 creditos + 8/pagina
       Add-on: Matriz de conformidade + anexos (+80 creditos)
  S4. SLA + KPI + Scorecard — base 150 creditos
       Add-ons: SLA tecnico detalhado (+50), KPI dashboard pack (+50)
  S5. Assistente de Negociacao — base 90 creditos + 8/cenario
       Add-on: Analise de formacao de preco (+40 creditos)
  S6. Alertas em Tempo Real — base 80 creditos + 10/regra
       Add-on: Thresholds customizados (+30 creditos)
  S7. Conectar API de Fornecedores — base 200 creditos (requer revisao humana)
       Add-on: Mapeamento de dados + transformacao (+100 creditos)
  S8. Relatorio Automatico — base 70 creditos + 5/dimensao
       Add-on: Pacote de graficos avancados (+40 creditos)
  S9. Apresentacao Executiva — base 120 creditos + 10/slide
       Add-on: Analise de marketshare (+60 creditos)
  S10. Estrategia Lost Saving — base 110 creditos + 8/fornecedor
       Add-on: Dados de benchmark do mercado (+50 creditos)
  S11. Plano de Acao 30/60/90 — base 80 creditos
       Add-on: Owners/Responsaveis + Cronograma (+20 creditos)

21.2. Cada servico gera um envelope de auditoria com SHA-256, garantindo rastreabilidade e integridade dos resultados.
21.3. Fluxo de aprovacao: cotacao automatica → aprovacao (automatica se abaixo do limite configuravel, manual se acima) → execucao → geracao de artefato.
21.4. Jobs acima do limite de auto-aprovacao exigem autorizacao administrativa antes da execucao.

22. WALLET DE CREDITOS

22.1. Carteira digital com creditos pre-pagos para consumo dos servicos do AI Desk.
22.2. Pacotes padrao disponiveis:
  - 50 creditos — US$ 50
  - 100 creditos — US$ 100
  - 500 creditos — US$ 500
  - 1.000 creditos — US$ 1.000
22.3. Valores personalizados: recarga customizada a partir de US$ 1.000 (sem limite superior).
22.4. Ledger completo e auditavel com transparencia total sobre consumo, debitos, recargas e ajustes.
22.5. Tipos de lancamento: topup (recarga), debit (consumo), refund (estorno), adjustment (ajuste), vip_courtesy (cortesia).

23. DASHBOARD STUDIO

23.1. Ferramenta para criacao de dashboards personalizados.
23.2. Biblioteca de 8 widgets interativos:
  W1. Gastos por Area/CC (PieChart)
  W2. Excecoes de Politica (AlertTriangle)
  W3. Performance de SLA (Activity/Line)
  W4. Savings Identificados (TrendingUp/Area)
  W5. Mapa de Riscos (Shield/Heatmap)
  W6. Ranking de Fornecedores (Award/Bar)
  W7. Volume Mensal Auditado (BarChart)
  W8. Score de Compliance (CheckCircle/Gauge)
23.3. Filtros globais: periodo, departamento, fornecedor.
23.4. Versionamento automatico de views com historico.
23.5. Publicacao administrativa: admin pode tornar views publicas para todos os usuarios da empresa.

24. BIBLIOTECA DE RELATORIOS E ARTEFATOS (REPORTS LIBRARY)

24.1. Repositorio centralizado de todos os artefatos gerados pela plataforma.
24.2. Tipos de artefato: ai_output (gerados pelo AI Desk), official (relatorios oficiais), quick (relatorios rapidos).
24.3. Workflow de status: draft (rascunho) → reviewed (revisado) → approved (aprovado).
24.4. Transicoes de status controladas — apenas administrador pode avancar status.
24.5. Hash SHA-256 individual por artefato, calculado automaticamente a partir do conteudo.
24.6. Download com header X-SHA256 para verificacao de integridade pelo destinatario.
24.7. Artefatos do AI Desk sao criados automaticamente ao concluir um job, vinculados via sourceRefsJson.

25. CONFIGURACAO DE FATURAMENTO POR EMPRESA (COMPANY BILLING CONFIG)

25.1. Limite por job por usuario (padrao: 200 creditos).
25.2. Limite por job por empresa (padrao: 500 creditos).
25.3. Cap mensal de wallet por empresa (configuravel, sem limite padrao).
25.4. Threshold de auto-aprovacao (padrao: 200 creditos) — jobs abaixo deste valor sao aprovados automaticamente.
25.5. Configuracao pode ser ajustada pelo administrador por empresa.

26. ASSINATURA DUAL DE CONTRATOS

26.1. O contrato requer assinatura de ambas as partes: Contratada e Cliente.
26.2. Cada assinatura e registrada independentemente com:
  a) CPF do signatario (mascarado na exibicao)
  b) Hash SHA-256 do texto integral do contrato
  c) IP do dispositivo
  d) User-agent do navegador
  e) Timestamp UTC
26.3. Tipos de assinatura: "contractor" (contratada) e "client" (cliente).
26.4. Solicitacao de assinatura pode ser enviada por email ou WhatsApp.
26.5. Badges visuais indicam status de cada assinatura: verde (assinado), vermelho/ambar (pendente).

27. BASE DE CONHECIMENTO IA (DOCUMENTOS IA)

27.1. Modulo administrativo para gestao de conhecimento proprietario (16+ anos de expertise em auditoria).
27.2. Upload de documentos com extracao automatica de texto:
  a) PDF — extracao via pdf-parse
  b) Word (.docx) — extracao via mammoth
  c) Excel (.xlsx/.xls) — conversao para CSV via xlsx
  d) TXT, MD, CSV, JSON, XML — extracao direta
27.3. 14 categorias de conhecimento: metodologia-auditoria, benchmark-mercado, legislacao-compliance, contratos-fornecedores, conciliacao-financeira, gestao-viagens, fraude-prevencao, treinamento-capacitacao, relatorios-modelos, ferramentas-sistemas, boas-praticas, glossario-termos, casos-referencia, politicas-internas.
27.4. Toggle ativo/inativo por documento — controla o que a IA consome.
27.5. Limite: 100.000 caracteres por documento; 30.000 caracteres por chamada de IA (priorizando documentos ativos).
27.6. Hash SHA-256 calculado para cada documento na submissao.
27.7. Regras comportamentais da IA:
  R11. A IA admite quando nao tem certeza e informa que vai consultar especialista humano.
  R12. Usa conhecimento proprietario de forma confidencial — nunca revela nomes de clientes ou dados sensíveis de outros projetos.
  R13. Prioriza fontes confiaveis e verificaveis (legislacao, IATA, orgaos reguladores).

28. SISTEMA ANTIALUCINACAO (IA)

28.1. Todos os outputs de IA sao acompanhados de envelope de auditoria SHA-256.
28.2. Cotacao previa obrigatoria antes de execucao.
28.3. Aprovacao humana em todas as etapas (o usuario decide e aprova).
28.4. Registro de modelo/versao/parametros em cada execucao.
28.5. Fluxo completo: draft → quoted → pending_approval → approved → running → completed.
28.6. Formatacao limpa obrigatoria: proibido uso de cabecalhos markdown, asteriscos, tabelas e listas numeradas extensas nos outputs da IA. Respostas devem seguir formato conversacional profissional.
28.7. Dosagem progressiva de conteudo: IA entrega no maximo 30% do conteudo total na primeira interacao, qualifica o contexto do usuario com perguntas especificas, e aprofunda progressivamente conforme confirmacoes.
28.8. Verificacao dupla obrigatoria: antes de apresentar qualquer dado numerico ou metrica, a IA confirma internamente se o dado tem origem verificavel (API, upload, contrato).

29. SISTEMA DE ALERTAS v2 (AURATRUST)

29.1. Motor de alertas com auto-escalacao de severidade baseada em limites financeiros: R$ 10.000 (alto), R$ 50.000 (critico).
29.2. Auto-escalacao funciona independentemente de configuracao por empresa — limites padrao sao aplicados quando nao ha config especifica.
29.3. Alertas CRITICAL e HIGH forcam automaticamente o canal de email, independente da configuracao do cliente.
29.4. Administrador da plataforma recebe copia automatica (CC) em todos os alertas CRITICAL e HIGH.
29.5. Cada alerta gera hash SHA-256 de integridade persistido no registro do alerta e na trilha de auditoria.
29.6. Log estruturado no console: severidade, tipo, valor financeiro e prefixo do hash para rastreabilidade.
29.7. Canais: plataforma (notificacao interna), email (via Resend), SMS (preparado para integracao futura).
29.8. Gatilhos: status nao-conforme, achados de alta severidade, conciliacao bancaria divergente/parcial, violacao de politica.

30. PIPELINE CP-01 — HEALTH CHECK E AUTO-REMEDIACAO

30.1. Pipeline de verificacao de integridade CP-01 executado automaticamente em cada inicializacao do servidor.
30.2. Escaneia todas as tabelas de dados operacionais (expenses, anomalies, audit_cases, audit_trail) sem limites de amostragem.
30.3. Detecta padroes de dados de seed/teste baseado em fornecedores, funcionarios e enderecos IP conhecidos.
30.4. Auto-remediacao cirurgica: remove apenas registros identificados como dados de seed, preservando dados reais do cliente.
30.5. Notificacao por email ao administrador quando remediacao e executada, com detalhamento das tabelas e registros afetados.
30.6. Endpoints administrativos: GET /api/audit-pag/health-check (verificacao sob demanda), POST /api/audit-pag/remediate (remediacao manual com trilha de auditoria).
30.7. Re-verificacao automatica apos remediacao para confirmar que a limpeza foi completa.
30.8. Resultado da verificacao registrado em log estruturado com status PASSED/FAILED por tabela.

31. AURATRUST — MODULO INDEPENDENTE DE MONITORAMENTO CONTINUO

31.1. O AuraTRUST opera como modulo independente e separado do projeto de auditoria forense pontual. Enquanto a auditoria forense (ex: Stabia) analisa dados historicos (passado), o AuraTRUST audita transacoes em tempo real (presente), funcionando como monitoramento continuo pre-pagamento.
31.2. Ativacao exclusiva para clientes que contratarem o servico de monitoramento continuo. O modulo nao pode ser acionado como parte de um projeto de auditoria pontual.
31.3. Precificacao do AuraTRUST Monitoramento Continuo:
  (a) Mensalidade base: US$ 199,00/mes para clientes com faturamento mensal ate US$ 10.000,00 (dez mil dolares).
  (b) Para clientes com faturamento acima de US$ 10.000,00/mes, aplica-se a tabela progressiva de auditoria sobre volume (mesmas faixas do AuraAudit Pass sobre o excedente):
      - VAM ate US$ 100.000: 0,30%
      - VAM ate US$ 300.000: 0,28%
      - VAM ate US$ 600.000: 0,26%
      - VAM ate US$ 800.000: 0,24%
      - VAM ate US$ 1.000.000: 0,22%
      - VAM acima de US$ 1.000.000: 0,20%
  (c) Formula: min(CAP, 199 + rate(VAM) x max(0, VAM - 10.000))
  (d) CAP mensal configuravel pelo contratante (padrao US$ 5.000/mes).
31.4. Escopo do monitoramento continuo: Pipeline de Reconciliacao Automatica com 3 Camadas — Camada 1 (ingestao do pedido do cliente via OBT/GDS/email/workflow de aprovacao), Camada 2 (ingestao ERP/fatura com cruzamento automatico C1xC2), Camada 3 (ingestao bancaria — extrato conta corrente, extrato cartao de credito, extrato cartao virtual VCN — com cruzamento triplo pedido x ERP x banco).
31.5. Validacoes automaticas executadas pelo pipeline: (a) confirmacao de pagamento do cliente, (b) confirmacao de pagamento ao fornecedor com invariante fornecedor < cliente, (c) identificacao de comissoes e incentivos recebidos dos fornecedores, (d) reconciliacao de FEE (taxa de servico, fatura separada), (e) reconciliacao de documentos fiscais (Nota Fiscal, Recibo, Fatura).
31.6. Auto-alertas com escalacao de severidade: fornecedor nao autorizado (CRITICAL), violacao de invariante fornecedor >= cliente (CRITICAL), divergencia de valores (HIGH), pagamento nao confirmado (HIGH), comissao/incentivo nao recebido (MEDIUM), FEE nao reconciliada (MEDIUM), divergencia documento fiscal (MEDIUM).
31.7. Log imutavel de reconciliacao: cada passo do pipeline gera registro com hash SHA-256 de integridade, em conformidade com Lei 13.964/2019.
31.8. O modulo AuraTRUST pode ser contratado independentemente do AuraAudit Pass ou de qualquer projeto de auditoria pontual.

32. AURATRUST — EVIDENCE TRACKING INFRASTRUCTURE (CERTIFICACAO E SELO DE CONFIANCA)

32.1. O modulo Evidence Tracking Infrastructure finaliza o processo de monitoramento continuo. Nao analisa transacoes — apenas formaliza o resultado, emitindo certificados e selos de confianca com cadeia de custodia SHA-256.
32.2. Tipos de certificacao:
  (a) Selo de Confianca (active_monitoring): ativo enquanto o monitoramento em tempo real estiver contratado. Valido continuamente durante a vigencia da assinatura mensal.
  (b) Certificado de Periodo (period_validated): emitido ao encerrar o monitoramento. Formaliza que o processo foi avaliado e validado ate a data, exclusivamente para o periodo e transacoes monitoradas.
32.3. Precificacao do AuraTRUST Evidence Tracking:
  (a) Assinatura basica mensal: US$ 149,00/mes (minimo para manter selo ativo).
  (b) Franquia inclusa: ate 500 transacoes conciliadas por mes.
  (c) Definicao de transacao: 1 linha conciliada por 2 ou 3 fontes (pedido x ERP x banco). Cruzamento de 2 ou 3 fontes para a mesma operacao = 1 transacao.
  (d) Acima de 500 transacoes, tabela progressiva por volume:
      - 501 a 2.000: US$ 0,99/transacao
      - 2.001 a 5.000: US$ 0,79/transacao
      - 5.001 a 10.000: US$ 0,59/transacao
      - 10.001 a 25.000: US$ 0,39/transacao
      - 25.001 a 50.000: US$ 0,29/transacao
      - 50.001+: US$ 0,19/transacao
32.4. Metering automatico: contagem de transacoes conciliadas por periodo, calculo progressivo por faixa, registro com hash SHA-256 de integridade.
32.5. Validacao publica de selo: endpoint /api/audit-pag/trust/seal/:sealCode permite verificacao externa da validade do selo sem autenticacao.
32.6. Cadeia de custodia encadeada: cada certificado referencia o hash do certificado anterior, formando corrente de integridade verificavel.
32.7. Revogacao: ao encerrar monitoramento, o selo ativo e revogado com motivo registrado e Certificado de Periodo e emitido automaticamente.
32.8. Simulador de faturamento: permite calcular custo estimado para qualquer volume de transacoes antes da contratacao.

============================================================
ANEXO I — EVIDENCIAS TECNICAS DO PROJETO (E1-E29)
============================================================

E1. Cadastro padronizado: CNPJ/CPF com validacao matematica + consulta Receita Federal (BrasilAPI)
E2. Contrato dinamico: texto gerado a partir de dados cadastrais verificados do contratante e contratada
E3. Assinatura digital: SHA-256 do texto integral, IP, user-agent, timestamp, CPF mascarado
E4. Trilha de auditoria: registros imutaveis com hash de integridade por entrada (append-only)
E5. Cadeia de custodia: conformidade com Lei 13.964/2019, hashes SHA-256 por registro
E6. Antiregressao: dataBefore/dataAfter em cada mutacao, versionamento de contratos
E7. Reconciliacao multi-via: cruzamento OBT vs Backoffice vs faturamento vs cartao/VCN
E8. Evidence packs: documentacao por caso/evento com raw data, logs e versoes de regras
E9. AI Desk: 11 servicos implementados com envelope SHA-256, cotacao e aprovacao por job
E10. Wallet: 4 pacotes padrao + valor personalizado, ledger completo com 5 tipos de lancamento
E11. Dashboard Studio: 8 widgets, filtros globais, versionamento, publicacao admin
E12. Reports Library: 3 tipos de artefato, workflow draft→reviewed→approved, SHA-256 por artefato
E13. Company Billing Config: limites por usuario/empresa, cap mensal, auto-aprovacao configuravel
E14. Assinatura dual: contratada + cliente com rastreamento independente, CPF + SHA-256 + IP + user-agent
E15. Documentos IA: upload com extracao automatica (PDF/Word/Excel), 14 categorias, toggle ativo/inativo
E16. Injecao de conhecimento: getKnowledgeContext() injeta docs ativos no system prompt (cap 30K chars)
E17. Regras IA: R11 (consultar humano), R12 (confidencialidade), R13 (fontes verificaveis)
E18. Stripe integrado: checkout para wallet (topup) e subscription (AuraAudit Pass)
E19. Assinatura eletronica: Lei 14.063/2020 + MP 2.200-2/2001
E20. LGPD: mascaramento de CPF, dados pessoais protegidos, finalidade contratual
E21. Pagina publica: chat IA flutuante com trial gratuito e cadeia de custodia
E22. Ecossistema de Integracoes: 149+ plataformas mapeadas em 15 segmentos (GDS, NDC Airlines, IATA/BSP, Hotelaria Global, Hotelaria Brasil/FOHB, Locadoras, Consolidadoras, Operadoras, Seguros, Pagamentos, TMC Globais, TMC Nacionais/ABRACORP, Agencias de Eventos/MICE, TravelTech, Plataformas de Eventos)
E23. AuraTRUST: auditoria pre-pagamento com cruzamento solicitacao/reserva/financeiro/extrato bancario, perfis agencia e corporativo, monitoramento diario de entradas/saidas, achados tipificados, conformidade pre-aprovacao CFO
E24. Alert Engine v2: auto-escalacao de severidade por valor financeiro, forcamento de canal email em alertas criticos/altos, CC automatico ao admin, hash SHA-256 persistido por alerta com trilha de auditoria
E25. CP-01 Health Check Pipeline: verificacao automatica de integridade em cada boot, deteccao de padroes de dados de teste, auto-remediacao cirurgica com notificacao por email, endpoints admin para verificacao e remediacao sob demanda
E26. AuraAI Formatacao v2: regras de formatacao limpa (sem markdown pesado), dosagem progressiva de conteudo (30% na primeira resposta), qualificacao de contexto antes de entrega, verificacao dupla de dados
E27. AuraTRACK: timeline de projeto com 3 visualizacoes (timeline linear, status dashboard, timesheet operacional), auto-calculo de Project Health Score (on_track/attention/critical), decomposicao de tempo operacional (Client Response Time, Audit Analysis Time, System Processing Time), Audit Efficiency Score com percentuais, controle de acesso por tenant (client scoping), fases com semaforo de status (completed/in_progress/delayed/not_started), disponivel no painel admin e cliente
E28. AuraTRUST Monitoramento Continuo (Bloco D): Pipeline de Reconciliacao Automatica com 3 Camadas (pedido x ERP x banco), cruzamento triplo com validacao de invariantes (fornecedor < cliente), reconciliacao de FEE/comissoes/incentivos/documentos fiscais (NF/Recibo/Fatura), log imutavel por step com SHA-256, auto-alertas em 8 cenarios (CRITICAL/HIGH/MEDIUM), modulo independente com precificacao propria (US$ 199/mes base + progressiva sobre volume)
E29. AuraTRUST Evidence Tracking Infrastructure: emissao de certificados e selos de confianca com cadeia de custodia SHA-256 encadeada. Selo de Confianca (ativo durante monitoramento tempo real) e Certificado de Periodo (valido para periodo monitorado apos encerramento). Precificacao propria: US$ 149/mes base + 500 transacoes inclusas + tabela progressiva (US$ 0,99 a US$ 0,19/tx conforme volume). Metering automatico por transacao conciliada (2 ou 3 fontes = 1 tx). Validacao publica de selo via endpoint. Simulador de faturamento integrado.

============================================================
ANEXO II — PLATAFORMA AURATECH: ECOSSISTEMA E MODULOS IMPLEMENTADOS
============================================================

ARQUITETURA AURATECH

A AuraTECH e a infraestrutura institucional (Trust Infrastructure Platform) que abriga todos os modulos de verificacao, validacao e certificacao baseados em evidencias. O ecossistema e composto por:

- AuraTRUST: Camada transversal de certificacao e validacao (Evidence Tracking Infrastructure) que certifica, valida e monitora cada processo do ecossistema. Cadeia de custodia SHA-256 encadeada, monitoramento ativo de selos e emissao automatica de certificados.
- AuraDATA: Hub centralizado de governanca de dados. Motor de ingestao, normalizacao e cruzamento de dados com integridade criptografica em cada etapa.
- AuraAUDIT: Corporate Expense Review — auditoria forense de despesas corporativas.
- AuraDUE: Digital Due Diligence — analise de risco e conformidade.
- AuraRISK: Compliance Score Analysis — pontuacao de risco e conformidade.
- AuraCARBO: Carbon Project Validation — validacao de projetos de credito de carbono.
- AuraLOA: Precatory Research Validation — validacao de pesquisa de precatorios.
- AuraTAX: Tax Credit Recovery — recuperacao de creditos tributarios.
- AuraMARKET: Verified Asset Exchange — marketplace de ativos verificados.
- AuraTRACK: Audit Timeline Engine — motor de timeline de auditoria e transparencia operacional.
- AuraLEGAL: Legal & Regulatory Compliance — gestao de conformidade juridica e regulatoria.
- AuraBID: Procurement & RFP Analysis — analise automatizada de editais e licitacoes.
- Aura Trust Index™: Modelo dinamico de pontuacao de confianca com 5 niveis (Excellent/Good/Fair/Review/Critical).

Todos os modulos operam sob a camada AuraTRUST, que garante rastreabilidade juridica, cadeia de custodia digital e conformidade com a Lei 13.964/2019.

MODULOS CONECTADOS NA LANDING PAGE AURATECH

A landing page institucional AuraTECH (/landingpage-test e /teste-agora) exibe 12 modulos do ecossistema em cards com status e acesso direto:

MODULOS ATIVOS (com botao "Entrar" habilitado):
- AuraAUDIT: acesso interno via /login (este app)
- AuraTRUST: acesso interno via /login (este app)
- AuraTRACK: acesso interno via /login (este app)
- AuraDUE: acesso externo via https://auradue.replit.app
- AuraCARBO: acesso externo via https://auracarbo.replit.app
- AuraLOA: acesso externo via https://auraloa.replit.app
- AuraRISK: acesso externo via https://aurarisk.replit.app
- AuraMARKET: acesso externo via https://auradue.replit.app (integrado ao AuraDUE)

MODULOS EM DESENVOLVIMENTO (botao "Entrar" desabilitado):
- AuraBID: Procurement & RFP Analysis
- AuraDATA: Data Governance Hub
- AuraLEGAL: Legal & Regulatory Compliance
- AuraTAX: Tax Credit Recovery

MODULOS IMPLEMENTADOS

A plataforma AuraTECH oferece os seguintes modulos digitais, todos implementados e operacionais:

M1. AURAAUDIT PASS (Assinatura Mensal)
Plano de assinatura mensal que oferece auditoria continua com dashboard interativo, trilha de auditoria, cadeia de custodia digital e relatorios automatizados. Integrado com Stripe para checkout e faturamento automatico. Status: IMPLEMENTADO.

M2. AI DESK (11 Servicos de IA)
Mesa de servicos com 11 funcionalidades de IA — conciliacao, contratos, editais/RFP, SLA/KPI/Scorecard, negociacao, alertas, APIs, relatorios, apresentacoes, lost saving, plano de acao. Cada servico gera envelope SHA-256. Fluxo: draft → quoted → pending_approval → approved → running → completed. Status: IMPLEMENTADO.

M3. WALLET DE CREDITOS
Carteira digital com 4 pacotes padrao (US$50/100/500/1000) + valor personalizado (min US$1000). Ledger auditavel com 5 tipos de lancamento. Checkout via Stripe. Status: IMPLEMENTADO.

M4. DASHBOARD STUDIO
Dashboards personalizados com 8 widgets, filtros globais, versionamento e publicacao admin. Status: IMPLEMENTADO.

M5. BIBLIOTECA DE RELATORIOS (ARTIFACTS)
Repositorio de artefatos com 3 tipos, workflow de status, SHA-256 por artefato, download com verificacao de integridade. Artefatos do AI Desk criados automaticamente. Status: IMPLEMENTADO.

M6. SISTEMA ANTIALUCINACAO (IA)
Envelope SHA-256, cotacao obrigatoria, aprovacao humana, registro de modelo/parametros. Status: IMPLEMENTADO.

M7. DOCUMENTOS IA — BASE DE CONHECIMENTO
Upload de documentos com extracao automatica (PDF/Word/Excel/TXT/MD/CSV/JSON/XML), 14 categorias, toggle ativo/inativo, injecao no prompt IA (cap 30K chars), regras comportamentais R11/R12/R13. Status: IMPLEMENTADO.

M8. ASSINATURA DUAL DE CONTRATOS
Contratada + Cliente com rastreamento independente, CPF + SHA-256 + IP + user-agent. Solicitacao por email/WhatsApp. Status: IMPLEMENTADO.

M9. CONFIGURACAO DE FATURAMENTO (BILLING CONFIG)
Limites por usuario/empresa, cap mensal, threshold de auto-aprovacao. Configuravel por empresa via admin. Status: IMPLEMENTADO.

M10. ECOSSISTEMA DE INTEGRACOES (149+ PLATAFORMAS)
Mapeamento completo do ecossistema de integracao com 149+ plataformas em 15 segmentos: GDS (Amadeus, Sabre, Travelport), NDC Airlines (LATAM, GOL, Azul, Lufthansa, Emirates, Qatar, British Airways, Iberia, Air France/KLM, American Airlines), IATA/BSP (BSPLink, Financial Gateway, EasyPay, ARC), Hotelaria Global (Marriott, Hilton, Accor, IHG, Hyatt, Wyndham, Omnibees, Hotelbeds, Booking, Expedia, SiteMinder), Hotelaria Brasil/FOHB (Atlantica, Bourbon, Blue Tree, Intercity, Slaviero, Taua, Wish, Vila Gale, Nobile, Transamerica, BHG, Othon, Bristol, Laghetto, Deville), Locadoras (Localiza, Movida, Unidas, Hertz, Avis, Budget, Enterprise, Sixt, Europcar), Consolidadoras (RexturAdvance, Ancoradouro, Flytour, BRT, Trend, Sakura, Confianca, New Age, Diversa), Operadoras (CVC, Visual, Agaxtur, Teresa Perez, Queensberry, Schultz, Orinter, Lusanova, Europamundo), Seguros (Assist Card, GTA, Coris, Allianz, Travel Ace, April, Intermac, Universal Assistance, Porto Seguro), Pagamentos (EBTA Bradesco, Itau, Santander, BB, Mastercard Corporate, Visa Corporate, AirPlus, Hotelcard, WEX, ETTC), TMC Globais (Amex GBT, BCD Travel, CWT, FCM Travel, CTM, Egencia), TMC Nacionais/ABRACORP (Flytour Business Travel, Avipam, Alatur JTB, Costa Brava, Kontik, Grupo Arbaitman, Reserve Travel, Hostway, Copastur, VoeTur, SAP Concur, ExpenseOn, TMS Travel), Agencias de Eventos/MICE (MCI Brasil, Alatur Eventos, Flytour Eventos, Sherpa42, TM1 Eventos, SRCOM, Banco de Eventos, Holding Clube, Agencia Samba, BFerraz), TravelTech (Onfly, Paytrack, Lemontech, Argo Solutions, Wooba, Reserve), Plataformas de Eventos (Sympla, Eventbrite, Cvent, Bizzabo, Even3, Ticket360). Metodos: API REST, XML, GDS, NDC, SFTP, CSV/XLSX, Portal. Pagina de ecossistema com busca e visualizacao por segmento. Status: IMPLEMENTADO.

M11. AURATRUST — MONITORAMENTO CONTINUO PRE-PAGAMENTO (MODULO INDEPENDENTE)
Modulo independente de monitoramento continuo que audita transacoes em tempo real (presente), separado do projeto de auditoria forense pontual (que analisa o passado). Precificacao propria: US$ 199/mes (base ate US$ 10.000 de faturamento mensal), tabela progressiva sobre volume excedente (mesmas faixas AuraAudit Pass). Fluxo: Solicitacao (quem pediu, departamento, destino) → Reserva (codigo PNR, confirmacao fornecedor, datas) → Financeiro (meio de pagamento: faturado/Pix/cartao corporativo/cartao de credito/boleto, valores solicitado/faturado/fornecedor, NF, vencimento) → Acordos e Comissoes (acordo corporativo, comissao %, incentivos, rebates — perfil agencia) → Conciliacao Bancaria (extrato banco via API, match/unmatch/parcial) → Monitoramento Diario (entradas/saidas, conformidade/desconformidade). Pipeline de Reconciliacao Automatica com 3 Camadas: Camada 1 (pedido do cliente — OBT/GDS/email/approval), Camada 2 (ERP/fatura — cruzamento C1xC2), Camada 3 (extrato bancario — conta corrente/cartao credito/cartao virtual VCN — cruzamento triplo). Validacoes automaticas: pagamento cliente confirmado, invariante fornecedor < cliente, comissoes/incentivos recebidos, FEE reconciliada, documentos fiscais (NF/Recibo/Fatura). Auto-alertas em 8 cenarios com escalacao de severidade (CRITICAL/HIGH/MEDIUM). Log imutavel de reconciliacao com SHA-256. Dois perfis: Agencia (com comissao, incentivos, rebates, NF agencia) e Corporativo (sem comissao, foco em solicitacao vs fatura/extrato cartao). Dashboard com KPIs, summary de reconciliacao (matched/partial/divergent/blocked), volumes financeiros. Achados tipificados. Contratavel independentemente do AuraAudit Pass. Status: IMPLEMENTADO.

M12. AURATRACK — AUDIT TIMELINE ENGINE
Modulo de transparencia operacional que demonstra ao cliente o andamento real do projeto de auditoria. Tres visualizacoes integradas: (A) Timeline Linear — cronograma fase a fase com indicadores de semaforo (verde/concluido, amarelo/em andamento, vermelho/atrasado, cinza/nao iniciado), datas de inicio/fim, entregaveis por fase; (B) Status Dashboard — Project Health Score auto-calculado (On Track/Attention/Critical) baseado em atraso de fases e proporcao tempo vs progresso, contadores de fases por status, Audit Efficiency Score com decomposicao percentual (Client Delay Impact, Audit Team Time, System Processing), resumo executivo com diferenca planejado vs executado; (C) Timesheet Operacional — relogio de tempo por categoria (Client Response Time, Audit Analysis Time, System Processing Time), registro de horas com descricao, barras de progresso proporcionais. Modulo standalone, utilizavel individualmente ou integrado ao AuraAUDIT e AuraDUE. Disponivel no painel admin (gestao completa) e painel cliente (visualizacao com transparencia total). Controle de acesso: admin cria projetos, gerencia fases e registra tempo; cliente visualiza apenas projetos atribuidos ao seu clientId. DB: tracker_projects, tracker_phases, tracker_time_entries. Diferencial global: quase nenhuma auditoria mostra tempo operacional real ao cliente. Status: IMPLEMENTADO.

M13. AURATRUST — EVIDENCE TRACKING INFRASTRUCTURE (CERTIFICACAO E SELO DE CONFIANCA)
Modulo que finaliza o processo de monitoramento continuo, formalizando o resultado sem realizar analises adicionais. Emite dois tipos de certificacao: (A) Selo de Confianca — ativo enquanto monitoramento em tempo real estiver contratado (assinatura mensal minima US$ 149/mes), valido continuamente; (B) Certificado de Periodo — emitido ao encerrar monitoramento, formaliza que o processo foi avaliado e validado ate a data, exclusivamente para o periodo e transacoes monitoradas. Precificacao por transacao: franquia de 500 tx inclusas na mensalidade de US$ 149; acima: tabela progressiva de US$ 0,99 (501-2000) ate US$ 0,19 (50001+). Transacao = 1 linha conciliada por 2 ou 3 fontes (pedido x ERP x banco). Cadeia de custodia SHA-256 encadeada: cada certificado referencia hash do anterior. Metering automatico com calculo progressivo por faixa. Validacao publica de selo via endpoint sem autenticacao. Simulador de faturamento integrado. DB: aura_trust_certificates, aura_trust_metering. Status: IMPLEMENTADO.

============================================================
ANEXO III — CHECKLIST DE CONFORMIDADE (AUDITORIA INTERNA)
============================================================

[OK] CL01. Validacao CNPJ: algoritmo matematico + consulta BrasilAPI (Receita Federal)
[OK] CL02. Validacao CPF: algoritmo matematico com mascaramento na exibicao
[OK] CL03. Contrato dinamico: texto gerado com dados verificados de ambas as partes
[OK] CL04. Assinatura digital: SHA-256, IP, user-agent, timestamp, CPF, Lei 14.063/2020
[OK] CL05. Assinatura dual: contratada e cliente assinam independentemente
[OK] CL06. Trilha de auditoria: registros imutaveis (append-only) com hash SHA-256
[OK] CL07. Cadeia de custodia: conformidade Lei 13.964/2019 (Pacote Anticrime)
[OK] CL08. Antiregressao: dataBefore/dataAfter, versionamento de contratos
[OK] CL09. AI Desk: 11 servicos com envelope SHA-256, cotacao e aprovacao
[OK] CL10. Wallet: 4 pacotes + customizado, ledger completo, checkout Stripe
[OK] CL11. Dashboard Studio: 8 widgets, filtros, versionamento, publicacao
[OK] CL12. Reports Library: 3 tipos, workflow de status, SHA-256, download verificavel
[OK] CL13. Billing Config: limites, cap mensal, auto-aprovacao configuravel
[OK] CL14. Documentos IA: upload, extracao automatica, 14 categorias, toggle
[OK] CL15. Regras IA: R11 consultar humano, R12 confidencialidade, R13 fontes verificaveis
[OK] CL16. LGPD: mascaramento CPF, finalidade contratual, dados protegidos
[OK] CL17. Stripe: checkout wallet + subscription integrados
[OK] CL18. Pagina publica: trial gratuito com cadeia de custodia
[OK] CL19. Reconciliacao: cruzamento multi-via (OBT/Backoffice/fatura/cartao)
[OK] CL20. Role-based access: admin, client, auditor com controle de acesso por rota
[OK] CL21-ECO. Ecossistema de Integracoes: 149+ plataformas em 15 segmentos, busca, metodos de integracao, APIs privadas e publicas
[OK] CL22-PAG. AuraTRUST: auditoria pre-pagamento com perfis agencia/corporativo, cruzamento solicitacao-reserva-financeiro-extrato, monitoramento diario, achados tipificados
[OK] CL23-ALT. Alert Engine v2: auto-escalacao de severidade, forcamento de email em CRITICAL/HIGH, CC admin, hash SHA-256 por alerta
[OK] CL24-HC. CP-01 Health Check: pipeline de verificacao automatica em boot, deteccao de padroes de seed, auto-remediacao cirurgica, notificacao email
[OK] CL25-FMT. AuraAI Formatacao v2: formatacao limpa, dosagem progressiva 30%, qualificacao de contexto, verificacao dupla de dados
[OK] CL26-TRK. AuraTRACK: timeline de projeto, 3 visualizacoes, Project Health Score, Audit Efficiency Score, decomposicao de tempo operacional, controle de acesso por tenant, modulo standalone replicavel

ITENS PENDENTES / EM OBSERVACAO:

[!!] CL21. Extracao de texto PDF: funcional para PDFs com texto selecionavel; PDFs escaneados (imagens) requerem OCR nao implementado — campo de edicao manual disponivel como fallback.
[!!] CL22. Backup e recuperacao: nao ha rotina automatizada de backup do banco PostgreSQL — depende da infraestrutura Replit. Recomendacao: configurar backup externo periodico.
[!!] CL23. Testes automatizados: cobertura de testes unitarios/integracao nao implementada — validacao manual via e2e e curl. Recomendacao: implementar suite de testes.
[OK] CL24-PAG-MC. AuraTRUST Monitoramento Continuo: modulo independente com precificacao propria (US$ 199/mes base), pipeline de reconciliacao 3 camadas, cruzamento triplo, auto-alertas, log imutavel SHA-256
[OK] CL25-ETI. AuraTRUST Evidence Tracking Infrastructure: certificacao e selo de confianca com cadeia de custodia SHA-256, metering por transacao (US$ 149/mes + 500 tx inclusas + progressiva), validacao publica de selo, simulador de faturamento
[!!] CL26. Rate limiting: nao ha rate limiting explicito nas APIs — depende da camada de infraestrutura. Recomendacao: adicionar middleware de rate limit.
[!!] CL26. Multi-idioma: plataforma opera em portugues brasileiro; nao ha suporte a outros idiomas. Recomendacao: avaliar necessidade futura.

============================================================
ANEXO IV — REGISTRO DE PROGRESSO DO PROJETO
============================================================

Projeto: Auditoria Forense — Grupo Stabia (Exercicios 2024/2025)
Volume financeiro auditado: R$ 51.327.894,23 (2024) + R$ 39.639.788,66 (2025)
Sistemas: Reserve, Argo (OBT), Wintour (2024), Stur (2025)

PARAMETROS DO CRONOGRAMA (AuraTRACK Schedule Engine):
- Contrato assinado em: 27/02/2026 (assinatura digital com SHA-256)
- Grace period: 5 dias uteis apos assinatura
- Inicio efetivo calculado: 06/03/2026
- Dedicacao ao projeto: 2 dias/semana
- Cronograma base: 15 dias de trabalho (proposta comercial aceita)
- Conclusao projetada: 27/04/2026
- Calculo: apenas dias uteis (seg-sex), sem finais de semana

CRONOGRAMA DE FASES (calculado pelo Schedule Engine com 2d/semana):

Fase 01 — Revisao de Escopo (2d projeto)
  Periodo calculado: 06/03/2026 a 10/03/2026
  Status: CONCLUIDA em 27/02/2026 (antecipada — concluida antes do inicio efetivo)
  Entregaveis: Revisao final do escopo, alinhamento de objetivos, validacao de premissas, definicao de criterios de auditoria, confirmacao de acessos (OBT Reserve/Argo, Backoffice Wintour/Stur, BSPLink, portais hoteleiros, acordos corporativos)
  Observacao: Fase antecipada — assinatura do contrato e revisao de escopo ocorreram simultaneamente em 27/02/2026

Fase 02 — Coleta de Dados (3d projeto)
  Periodo calculado: 11/03/2026 a 19/03/2026
  Status: EM ANDAMENTO (sistema liberado para upload de arquivos em 27/02/2026)
  Entregaveis: Coleta estruturada das bases de dados, extracoes dos sistemas (OBT Reserve/Argo, Backoffice Wintour 2024 + Stur 2025, relatorios financeiros/operacionais, extratos de cartoes, faturas de hospedagem, controle de reembolso/creditos, FEE/Rebate/Comissoes)

Fase 03 — Reconciliacao (5d projeto)
  Periodo calculado: 20/03/2026 a 06/04/2026
  Status: NAO INICIADA
  Entregaveis: Cruzamento e reconciliacao multi-via, identificacao de inconsistencias, falhas operacionais, vulnerabilidades financeiras, oportunidades de recuperacao/economia, conciliacao 4 vias (PNR/TKT/EMD + fatura + cartao/VCN + expense)

Fase 04 — Apresentacao dos Resultados (2d projeto)
  Periodo calculado: 07/04/2026 a 09/04/2026
  Status: NAO INICIADA
  Entregaveis: Consolidacao dos achados, validacao preliminar, material executivo com valores, riscos e oportunidades identificadas

Fase 05 — Ajustes e Validacoes (2d projeto)
  Periodo calculado: 10/04/2026 a 14/04/2026
  Status: NAO INICIADA
  Entregaveis: Ajustes finais com base em validacoes junto as areas envolvidas, refinamento das analises, consolidacao das recomendacoes

Fase 06 — Entrega Final (1d projeto)
  Periodo calculado: 15/04/2026 a 16/04/2026
  Status: NAO INICIADA
  Entregaveis: Relatorio executivo consolidado, relatorio tecnico detalhado com achados/evidencias/analises, mapeamento de riscos e vulnerabilidades, recomendacoes praticas, plano de acao priorizado por impacto e risco

RESUMO DE PROGRESSO:
- Progresso geral: 17% (1 de 6 fases concluidas)
- Health Score: ON TRACK
- Horas operacionais registradas: 9.0h (Audit Analysis 5.5h / 61%, Client Response 1.5h / 17%, System Processing 2.0h / 22%)
- Fase 01 antecipada: concluida antes do inicio efetivo do projeto (ganho de tempo)
- Fase 02 iniciada antecipadamente: sistema de upload liberado em 27/02/2026

Ultima atualizacao: 05/03/2026

============================================================
ANEXO V — AURATRUST MONITORAMENTO CONTINUO: TABELA DE PRECIFICACAO
============================================================

NATUREZA DO SERVICO:
O AuraTRUST e um modulo de monitoramento continuo (presente) separado da auditoria forense pontual (passado).
A auditoria forense pontual analisa dados historicos (ex: projeto Stabia — exercicios 2024/2025).
O AuraTRUST audita transacoes em tempo real, com reconciliacao automatica pre-pagamento.

PRECIFICACAO:
Mensalidade base: US$ 199,00/mes
Franquia: ate US$ 10.000,00 de faturamento mensal sem variavel
Variavel progressiva (sobre excedente = max(0, VAM - 10.000)):

  Faixa de VAM               | Aliquota
  ----------------------------|---------
  Ate US$ 100.000             | 0,30%
  Ate US$ 300.000             | 0,28%
  Ate US$ 600.000             | 0,26%
  Ate US$ 800.000             | 0,24%
  Ate US$ 1.000.000           | 0,22%
  Acima de US$ 1.000.000      | 0,20%

Formula: min(CAP, 199 + rate(VAM) x max(0, VAM - 10.000))
CAP mensal: configuravel pelo contratante (padrao US$ 5.000/mes)

EXEMPLOS DE CALCULO:
- Cliente com VAM US$ 5.000/mes: US$ 199,00 (apenas base, dentro da franquia)
- Cliente com VAM US$ 50.000/mes: US$ 199 + 0,30% x 40.000 = US$ 199 + US$ 120 = US$ 319,00/mes
- Cliente com VAM US$ 200.000/mes: US$ 199 + 0,28% x 190.000 = US$ 199 + US$ 532 = US$ 731,00/mes
- Cliente com VAM US$ 500.000/mes: US$ 199 + 0,26% x 490.000 = US$ 199 + US$ 1.274 = US$ 1.473,00/mes

CONTRATACAO:
O AuraTRUST Monitoramento Continuo pode ser contratado independentemente:
- Sem necessidade de AuraAudit Pass (assinatura principal)
- Sem necessidade de projeto de auditoria forense pontual
- Ativacao mediante aceite digital com trilha SHA-256

ESCOPO INCLUIDO:
- Pipeline de Reconciliacao Automatica (3 Camadas)
- Cruzamento triplo: pedido x ERP x banco
- Validacao de fornecedores autorizados (CNPJ whitelist)
- Invariante: valor fornecedor < valor cliente (sempre)
- Reconciliacao de FEE, comissoes e incentivos
- Reconciliacao de documentos fiscais (NF/Recibo/Fatura)
- Auto-alertas com escalacao de severidade
- Log imutavel com SHA-256 por step
- Dashboard de reconciliacao com volumes financeiros

============================================================
CLAUSULAS PETREAS (REGRAS VINCULANTES IMUTAVEIS)
============================================================

As clausulas abaixo sao imutaveis e prevalecem sobre todas as demais disposicoes deste contrato. Nao podem ser revogadas, flexibilizadas ou contornadas sob nenhuma circunstancia.

CP-01: ZERO DADOS FICTICIOS — A partir da entrada em modulo de producao, todo dado exibido em qualquer pagina do portal do cliente deve ter origem exclusiva em uma de duas fontes: (1) a proposta comercial/contrato assinado (via API /api/client/project-overview ou texto contratual), ou (2) dados enviados pelo cliente atraves de sua sessao autenticada. Nenhum dado de amostra hardcoded, valor placeholder, numero ficticio, nome de fornecedor inventado, data falsa, contagem de registros inventada ou metrica sintetica e permitido em qualquer parte do portal do cliente. Secoes aguardando dados reais devem exibir estado explicito "Aguardando dados" com icone de lock. A violacao desta clausula constitui descumprimento contratual.

CP-02: SEM ALTERACOES EM BILLING/ASSINATURA SEM APROVACAO — Nenhuma alteracao em arquivos relacionados a logica de cobranca e assinatura pode ser feita sem aprovacao explicita e previa do CONTRATANTE.

CP-03: CONFIDENCIALIDADE ABSOLUTA DE IDENTIDADE — Nenhuma pagina, relatorio, dashboard, output de IA, log, artefato ou qualquer outro elemento visivel da plataforma pode exibir, sugerir ou permitir a inferencia de nomes de empresas (PJ), pessoas fisicas (PF), CNPJs, CPFs ou quaisquer dados identificaveis de terceiros — sejam clientes, fornecedores, parceiros ou colaboradores — exceto os dados do proprio usuario autenticado e da empresa a ele vinculada. Esta regra se aplica tanto a outputs gerados por inteligencia artificial quanto a textos descritivos, labels, placeholders, listas de exemplo, seeds de banco de dados e qualquer conteudo estatico ou dinamico da plataforma. A violacao desta clausula constitui descumprimento contratual e potencial infracao a LGPD (Lei 13.709/2018).

============================================================
CONSIDERACOES FINAIS
============================================================

Esta proposta foi estruturada para apoiar o ${clientName} na elevacao do nivel de controle, governanca e eficiencia de sua gestao de viagens corporativas, fornecendo uma visao clara, tecnica e acionavel sobre o cenario atual e seus pontos de melhoria.

A versao ${CONTRACT_VERSION} deste contrato reflete a implementacao completa dos modulos M1 a M13, com 29 evidencias tecnicas documentadas, 33 itens de checklist de conformidade (28 conformes, 5 em observacao), 5 anexos detalhados (incluindo Registro de Progresso do Projeto e Tabela de Precificacao AuraTRUST) e 3 clausulas petreas vinculantes.

Certos de que nossa experiencia nos qualifica para atender plenamente o projeto, colocamo-nos a disposicao para quaisquer esclarecimentos.

"Cuidado com as pequenas despesas, um pequeno vazamento afundara um grande navio." — Benjamin Franklin

${auditorName}
Contrato de Auditoria e Consultoria — Versao ${CONTRACT_VERSION}
Total de clausulas: 29 | Evidencias: 28 | Anexos: 5 | Modulos: 12
${auditorAddress}${auditorCity ? `, ${auditorCity}` : ""}${auditorState ? ` - ${auditorState}` : ""}
${auditorContactName} | Telefone: ${auditorPhone} | Email: ${auditorEmail}`;
}

function hashContractText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function getAuditorProfile() {
  const [auditor] = await db
    .select()
    .from(clients)
    .where(eq(clients.type, "auditor"))
    .limit(1);
  return auditor || null;
}

async function getClientProfile(userId: string) {
  const { users } = await import("@shared/schema");
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.clientId) return null;
  const [client] = await db.select().from(clients).where(eq(clients.id, user.clientId));
  return client || null;
}

function extractProposalData(contractText: string, client: any) {
  const volumes = {
    year1: "R$ 51.3M",
    year1Label: "2024",
    year2: "R$ 39.6M",
    year2Label: "2025",
    total: "R$ 90.9M",
  };

  const period = "2024–2025";

  const systems = [
    "OBT (Online Booking Tool)",
    "Backoffice / ERP",
    "GDS (Sabre, Amadeus)",
    "BSPlink",
  ];

  return { volumes, period, systems };
}

export function registerContractRoutes(app: Express) {
  app.get("/api/contract/text", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const auditor = await getAuditorProfile();
    const client = await getClientProfile(userId);
    const contractText = generateContractText(auditor, client);

    res.json({
      contractNumber: "AUR-2025-0042",
      version: CONTRACT_VERSION,
      text: contractText,
      sha256: hashContractText(contractText),
      auditor: auditor ? { name: auditor.name, cnpj: auditor.cnpj, email: auditor.contactEmail } : null,
      client: client ? { name: client.name, cnpj: client.cnpj, email: client.contactEmail } : null,
    });
  });

  app.get("/api/admin/contracts", requireAuth, async (req: Request, res: Response) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }
    const { users } = await import("@shared/schema");
    const { ne } = await import("drizzle-orm");
    const allClients = await db.select().from(clients).where(ne(clients.type, "auditor")).orderBy(desc(clients.createdAt));
    const auditor = await getAuditorProfile();
    const allSignatures = await db.select().from(contractSignatures).orderBy(desc(contractSignatures.signedAt));

    const contracts = allClients.map((client) => {
      const clientSig = allSignatures.find((s) =>
        (s.companyCnpj === client.cnpj || s.companyName === client.name) && (!s.signerType || s.signerType === "client")
      );
      const contractorSig = allSignatures.find((s) =>
        s.clientId === client.id && s.signerType === "contractor"
      );
      const contractText = generateContractText(auditor, client);
      const sha256 = hashContractText(contractText);
      return {
        clientId: client.id,
        clientName: client.name,
        clientCnpj: client.cnpj,
        clientEmail: client.contactEmail,
        clientPhone: client.contactPhone,
        clientStatus: client.status,
        contractNumber: "AUR-2025-0042",
        contractVersion: CONTRACT_VERSION,
        contractSha256: sha256,
        signed: !!clientSig,
        signature: clientSig || null,
        contractorSigned: !!contractorSig,
        contractorSignature: contractorSig || null,
      };
    });

    return res.json({ contracts, auditor: auditor ? { name: auditor.name, cnpj: auditor.cnpj } : null });
  });

  app.get("/api/admin/contracts/:clientId/text", requireAuth, async (req: Request, res: Response) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }
    const { clientId } = req.params;
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return res.status(404).json({ error: "Cliente nao encontrado." });
    const auditor = await getAuditorProfile();
    const contractText = generateContractText(auditor, client);
    return res.json({
      contractNumber: "AUR-2025-0042",
      version: CONTRACT_VERSION,
      text: contractText,
      sha256: hashContractText(contractText),
      client: { name: client.name, cnpj: client.cnpj, email: client.contactEmail, phone: client.contactPhone },
      auditor: auditor ? { name: auditor.name, cnpj: auditor.cnpj } : null,
    });
  });

  app.get("/api/admin/contracts/:clientId/whatsapp", requireAuth, async (req: Request, res: Response) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }
    const { clientId } = req.params;
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return res.status(404).json({ error: "Cliente nao encontrado." });
    const phone = client.contactPhone?.replace(/\D/g, "") || "";
    const contractUrl = `${req.protocol}://${req.get("host")}/contract`;
    const auditor = await getAuditorProfile();
    const message = `Prezado(a) ${client.contactName || "Cliente"},\n\nSegue o link para visualizacao e assinatura digital do Contrato de Auditoria e Consultoria:\n\n${contractUrl}\n\nContrato: AUR-2025-0042 (v${CONTRACT_VERSION})\nEmpresa: ${client.name || ""}\nCNPJ: ${client.cnpj || ""}\n\nA assinatura e feita digitalmente com validade juridica (Lei 14.063/2020).\n\nAtenciosamente,\n${auditor?.name || "CTS Brasil"}`;
    const whatsappUrl = `https://wa.me/${phone ? phone : ""}?text=${encodeURIComponent(message)}`;
    return res.json({ whatsappUrl, phone, message, clientName: client.name });
  });

  app.get("/api/admin/contracts/:clientId/request-signature", requireAuth, async (req: Request, res: Response) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }
    const { clientId } = req.params;
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return res.status(404).json({ error: "Cliente nao encontrado." });
    const auditor = await getAuditorProfile();
    const contractUrl = `${req.protocol}://${req.get("host")}/contract`;
    const subject = `Solicitacao de Assinatura — Contrato AUR-2025-0042 (v${CONTRACT_VERSION})`;
    const body = `Prezado(a) ${client.contactName || "Cliente"},

Encaminhamos o Contrato de Prestacao de Servicos de Auditoria e Consultoria Especializada em Viagens e Eventos Corporativos para sua analise e assinatura digital.

Dados do Contrato:
- Numero: AUR-2025-0042
- Versao: ${CONTRACT_VERSION}
- Empresa: ${client.name || ""}
- CNPJ: ${client.cnpj || ""}

Para visualizar e assinar o contrato digitalmente, acesse o link abaixo:
${contractUrl}

A assinatura e feita de forma digital com validade juridica conforme Lei 14.063/2020 (assinatura eletronica simples) e MP 2.200-2/2001. Integridade garantida por hash criptografico SHA-256.

Ficamos a disposicao para quaisquer esclarecimentos.

Atenciosamente,
${auditor?.contactName || "Marcos Costa"}
${auditor?.name || "CTS Brasil"}
${auditor?.contactEmail || "marcos@cts-brasil.com"}
${auditor?.contactPhone || ""}`;

    const mailtoUrl = `mailto:${client.contactEmail || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return res.json({
      mailtoUrl,
      email: client.contactEmail,
      subject,
      body,
      clientName: client.name,
    });
  });

  app.post("/api/admin/contracts/:clientId/contractor-sign", requireAuth, async (req: Request, res: Response) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }
    const { clientId } = req.params;
    const { signerCpf } = req.body;
    const userId = req.session.userId!;
    const fullName = req.session.fullName || "Unknown";

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return res.status(404).json({ error: "Cliente nao encontrado." });

    const existing = await db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.clientId, clientId));
    const alreadySigned = existing.find((s) => s.signerType === "contractor");
    if (alreadySigned) {
      return res.status(400).json({ error: "Contrato ja assinado pela contratada para este cliente." });
    }

    let cpfDigits: string | null = null;
    if (signerCpf) {
      cpfDigits = signerCpf.replace(/\D/g, "");
      if (!validateCPF(cpfDigits)) {
        return res.status(400).json({ error: "CPF invalido — digitos verificadores nao conferem." });
      }
    }

    const auditor = await getAuditorProfile();
    const contractText = generateContractText(auditor, client);
    const contractSha256 = hashContractText(contractText);
    const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    const [signature] = await db
      .insert(contractSignatures)
      .values({
        contractNumber: "AUR-2025-0042",
        userId,
        signerName: fullName,
        signerRole: "Representante Legal — Contratada",
        signerType: "contractor",
        signerCpf: cpfDigits || null,
        companyName: auditor?.name || "CTS Brasil",
        companyCnpj: auditor?.cnpj || null,
        clientId,
        contractTextSha256: contractSha256,
        contractVersion: CONTRACT_VERSION,
        contractType: "custom",
        ipAddress,
        userAgent,
      })
      .returning();

    return res.json({
      success: true,
      signature,
      proof: {
        contractSha256,
        ipAddress,
        userAgent,
        signedAt: signature.signedAt,
        legalBasis: "Lei 14.063/2020 (assinatura eletronica simples), MP 2.200-2/2001",
      },
    });
  });

  app.get("/api/client/project-phases", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const client = await getClientProfile(userId);
      if (!client) return res.json({ phases: null });
      res.json({ phases: (client as any).projectPhases || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/client/project-overview", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const client = await getClientProfile(userId);
      if (!client) {
        return res.json({
          clientName: req.session.fullName || "Cliente",
          clientType: "corporate_company",
          projectCategory: "Viagens e Eventos",
          volumes: null,
          systems: [],
          period: null,
        });
      }

      const auditor = await getAuditorProfile();
      const contractText = generateContractText(auditor, client);

      const contractData = extractProposalData(contractText, client);

      res.json({
        clientName: client.name,
        clientType: client.type,
        projectCategory: client.type === "travel_agency" ? "Viagens e Eventos" : "Corporativo",
        volumes: contractData.volumes,
        period: contractData.period,
        systems: contractData.systems,
        contractVersion: CONTRACT_VERSION,
      });
    } catch (error: any) {
      console.error("Error fetching project overview:", error.message);
      res.status(500).json({ error: "Failed to fetch project overview" });
    }
  });

  app.get("/api/contract/signature", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const clientId = currentUser?.clientId;

    let signatures;
    if (clientId) {
      const companyUsers = await db.select({ id: users.id }).from(users).where(eq(users.clientId, clientId));
      const companyUserIds = companyUsers.map(u => u.id);
      signatures = await db
        .select()
        .from(contractSignatures)
        .where(or(...companyUserIds.map(uid => eq(contractSignatures.userId, uid))))
        .orderBy(desc(contractSignatures.signedAt));
    } else {
      signatures = await db
        .select()
        .from(contractSignatures)
        .where(eq(contractSignatures.userId, userId))
        .orderBy(desc(contractSignatures.signedAt));
    }

    if (signatures.length === 0) {
      return res.json({ signed: false, signature: null });
    }
    return res.json({ signed: true, signature: signatures[0] });
  });

  app.get("/api/contract/signature/:contractNumber", requireAuth, async (req: Request, res: Response) => {
    const { contractNumber } = req.params;
    const signatures = await db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.contractNumber, contractNumber))
      .orderBy(desc(contractSignatures.signedAt));

    return res.json({ signatures });
  });

  app.post("/api/contract/sign", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const fullName = req.session.fullName || "Unknown";

    const existing = await db
      .select()
      .from(contractSignatures)
      .where(eq(contractSignatures.userId, userId));

    if (existing.length > 0) {
      return res.status(400).json({ error: "Contrato ja assinado por este usuario." });
    }

    const { signerRole, companyName, companyCnpj, signerCpf } = req.body;

    if (!signerRole) {
      return res.status(400).json({ error: "Cargo/funcao do signatario e obrigatorio." });
    }

    let cpfDigits: string | null = null;
    if (signerCpf) {
      cpfDigits = signerCpf.replace(/\D/g, "");
      if (!validateCPF(cpfDigits)) {
        return res.status(400).json({ error: "CPF do representante legal invalido — digitos verificadores nao conferem." });
      }
    }

    if (companyCnpj) {
      const cnpjDigits = companyCnpj.replace(/\D/g, "");
      const docType = detectDocumentType(cnpjDigits);
      if (docType === "cnpj" && !validateCNPJ(cnpjDigits)) {
        return res.status(400).json({ error: "CNPJ invalido — digitos verificadores nao conferem. Nao e possivel assinar com documento invalido." });
      }
    }

    const auditor = await getAuditorProfile();
    const client = await getClientProfile(userId);
    const contractText = generateContractText(auditor, client);
    const contractSha256 = hashContractText(contractText);
    const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const userClientId = currentUser?.clientId || null;

    const [signature] = await db
      .insert(contractSignatures)
      .values({
        contractNumber: "AUR-2025-0042",
        userId,
        signerName: fullName,
        signerRole,
        signerType: "client",
        signerCpf: cpfDigits || null,
        companyName: companyName || client?.name || null,
        companyCnpj: companyCnpj || client?.cnpj || null,
        clientId: userClientId,
        contractTextSha256: contractSha256,
        contractVersion: CONTRACT_VERSION,
        ipAddress,
        userAgent,
      })
      .returning();

    return res.json({
      success: true,
      signature,
      proof: {
        contractSha256,
        ipAddress,
        userAgent,
        signedAt: signature.signedAt,
        legalBasis: "Lei 14.063/2020 (assinatura eletronica simples), MP 2.200-2/2001",
      },
    });
  });

  app.get("/api/company/auditor", requireAuth, async (_req: Request, res: Response) => {
    const auditor = await getAuditorProfile();
    return res.json({ profile: auditor });
  });

  app.patch("/api/company/auditor", requireAuth, async (req: Request, res: Response) => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }
    const auditor = await getAuditorProfile();
    if (!auditor) {
      return res.status(404).json({ error: "Perfil da empresa auditora nao encontrado." });
    }
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos.", details: parsed.error.flatten() });
    }
    const { name, cnpj, contactName, contactEmail, contactPhone, address, city, state, notes } = parsed.data;
    const [updated] = await db
      .update(clients)
      .set({
        name: name || auditor.name,
        cnpj: cnpj || auditor.cnpj,
        contactName: contactName || auditor.contactName,
        contactEmail: contactEmail || auditor.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : auditor.contactPhone,
        address: address !== undefined ? address : auditor.address,
        city: city !== undefined ? city : auditor.city,
        state: state !== undefined ? state : auditor.state,
        notes: notes !== undefined ? notes : auditor.notes,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, auditor.id))
      .returning();
    return res.json({ profile: updated });
  });

  app.get("/api/company/my-profile", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const client = await getClientProfile(userId);
    return res.json({ profile: client });
  });

  app.patch("/api/company/my-profile", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const client = await getClientProfile(userId);
    if (!client) {
      return res.status(404).json({ error: "Perfil do cliente nao encontrado." });
    }
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos.", details: parsed.error.flatten() });
    }
    const { name, cnpj, contactName, contactEmail, contactPhone, address, city, state, notes } = parsed.data;
    const [updated] = await db
      .update(clients)
      .set({
        name: name || client.name,
        cnpj: cnpj || client.cnpj,
        contactName: contactName || client.contactName,
        contactEmail: contactEmail || client.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : client.contactPhone,
        address: address !== undefined ? address : client.address,
        city: city !== undefined ? city : client.city,
        state: state !== undefined ? state : client.state,
        notes: notes !== undefined ? notes : client.notes,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, client.id))
      .returning();
    return res.json({ profile: updated });
  });

  app.get("/api/contract/whatsapp-link", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const client = await getClientProfile(userId);
    const phone = client?.contactPhone?.replace(/\D/g, "") || "";
    const contractUrl = `${req.protocol}://${req.get("host")}/contract`;
    const message = `Prezado(a) ${client?.contactName || "Cliente"},\n\nSegue o link para visualizacao e assinatura digital do contrato de auditoria:\n\n${contractUrl}\n\nContrato: AUR-2025-0042\nEmpresa: ${client?.name || ""}\n\nA assinatura e feita digitalmente com validade juridica (Lei 14.063/2020).\n\nAtenciosamente,\nAuraAUDIT`;
    const whatsappUrl = `https://wa.me/${phone ? phone : ""}?text=${encodeURIComponent(message)}`;
    return res.json({ whatsappUrl, phone, message });
  });

  app.get("/api/validate-document/:doc", requireAuth, async (req: Request, res: Response) => {
    const doc = req.params.doc.replace(/\D/g, "");
    const docType = detectDocumentType(doc);
    if (docType === "invalid") {
      return res.json({ valid: false, type: "invalid", error: "Documento deve ter 11 (CPF) ou 14 (CNPJ) digitos." });
    }
    const isValid = docType === "cnpj" ? validateCNPJ(doc) : validateCPF(doc);
    if (!isValid) {
      return res.json({
        valid: false,
        type: docType,
        error: `${docType.toUpperCase()} invalido — digitos verificadores nao conferem.`,
      });
    }
    return res.json({ valid: true, type: docType });
  });

  app.get("/api/cnpj/:cnpj", requireAuth, async (req: Request, res: Response) => {
    const cnpjDigits = req.params.cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      return res.status(400).json({ error: "CNPJ deve conter 14 digitos." });
    }
    if (!validateCNPJ(cnpjDigits)) {
      return res.status(400).json({ error: "CNPJ invalido — digitos verificadores nao conferem. Verifique o numero digitado." });
    }
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
        headers: { "User-Agent": "AuraAUDIT/1.0", "Accept": "application/json" },
      });
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: "CNPJ nao encontrado na Receita Federal." });
        }
        return res.status(502).json({ error: "Erro ao consultar a Receita Federal. Tente novamente." });
      }
      const data = await response.json() as Record<string, any>;
      const formatPhone = (ddd: string, tel: string) => {
        if (!ddd || !tel) return null;
        return `(${ddd}) ${tel}`;
      };
      const buildAddress = (logradouro: string, numero: string, complemento: string, bairro: string) => {
        const parts = [logradouro, numero, complemento, bairro].filter(Boolean);
        return parts.join(", ") || null;
      };
      const result = {
        razaoSocial: data.razao_social || "",
        nomeFantasia: data.nome_fantasia || "",
        cnpj: cnpjDigits,
        cnpjFormatado: `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8, 12)}-${cnpjDigits.slice(12, 14)}`,
        email: data.email || "",
        telefone: formatPhone(data.ddd_telefone_1?.substring(0, 2), data.ddd_telefone_1?.substring(2)) || "",
        endereco: buildAddress(data.logradouro, data.numero, data.complemento, data.bairro),
        cidade: data.municipio || "",
        uf: data.uf || "",
        cep: data.cep || "",
        situacao: data.descricao_situacao_cadastral || "",
        atividadePrincipal: data.cnae_fiscal_descricao || "",
        capitalSocial: data.capital_social || 0,
        porte: data.porte || "",
        naturezaJuridica: data.natureza_juridica || "",
        dataAbertura: data.data_inicio_atividade || "",
        socios: (data.qsa || []).map((s: any) => ({
          nome: s.nome_socio,
          qualificacao: s.qualificacao_socio,
        })),
      };
      return res.json(result);
    } catch (err) {
      console.error("CNPJ lookup error:", err);
      return res.status(502).json({ error: "Falha na comunicacao com a Receita Federal." });
    }
  });

  app.get("/api/client/contract/pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const client = await getClientProfile(userId);
      if (!client) {
        return res.status(404).json({ error: "Perfil do cliente nao encontrado." });
      }

      const sigs = await db
        .select()
        .from(contractSignatures)
        .where(eq(contractSignatures.contractNumber, "AUR-2025-0042"))
        .orderBy(desc(contractSignatures.signedAt));

      const clientSig = sigs.find(s => s.signerType === "client");
      const adminSig = sigs.find(s => s.signerType === "contractor");

      const auditor = await getAuditorProfile();
      const contractText = generateContractText(auditor, client);
      const sha256 = hashContractText(contractText);

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: `Contrato AUR-2025-0042 v${CONTRACT_VERSION} — Assinado`,
          Author: "AuraAUDIT — CTS Brasil",
          Subject: "Contrato de Auditoria Forense Independente — Copia Assinada",
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="contrato-assinado-auraaudit-${CONTRACT_VERSION}.pdf"`
      );
      res.setHeader("X-SHA256", sha256);
      doc.pipe(res);

      doc.fontSize(18).font("Helvetica-Bold").text("CONTRATO DE AUDITORIA FORENSE INDEPENDENTE", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Versao ${CONTRACT_VERSION} | Contrato AUR-2025-0042`, { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica").text(`SHA-256: ${sha256}`, { align: "center" });
      doc.moveDown(0.2);

      if (clientSig && adminSig) {
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#006600").text("STATUS: CONTRATO ASSINADO POR AMBAS AS PARTES", { align: "center" });
        doc.fillColor("#000");
      }
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(0.5);

      const lines = contractText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { doc.moveDown(0.3); continue; }
        const isSectionHeader = /^={10,}/.test(trimmed);
        if (isSectionHeader) { doc.moveDown(0.3); doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#ccc"); doc.moveDown(0.3); continue; }
        const isMainClause = /^(\d{1,2})\.\s/.test(trimmed) && !trimmed.startsWith("  ");
        const isSubClause = /^\d{1,2}\.\d+\./.test(trimmed);
        const isPartHeader = /^PARTE\s+(I|II|III|IV|V)\s/.test(trimmed);
        const isAnexoHeader = /^ANEXO\s+(I|II|III)/.test(trimmed);
        if (isPartHeader || isAnexoHeader) { doc.moveDown(0.5); doc.fontSize(13).font("Helvetica-Bold").text(trimmed); doc.moveDown(0.3); }
        else if (isMainClause) { doc.moveDown(0.3); doc.fontSize(11).font("Helvetica-Bold").text(trimmed); }
        else if (isSubClause) { doc.fontSize(9.5).font("Helvetica").text(trimmed, { indent: 10 }); }
        else if (trimmed.startsWith("  ")) { doc.fontSize(9).font("Helvetica").text(trimmed, { indent: 20 }); }
        else { doc.fontSize(9.5).font("Helvetica").text(trimmed); }
        if (doc.y > 720) { doc.addPage(); }
      }

      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("REGISTRO DE ASSINATURAS DIGITAIS", { align: "center" });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(1);

      if (clientSig) {
        doc.fontSize(11).font("Helvetica-Bold").text("CONTRATANTE (Cliente):");
        doc.fontSize(10).font("Helvetica").text(`Nome: ${clientSig.signerName}`);
        doc.text(`Data: ${new Date(clientSig.signedAt!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
        doc.text(`Hash SHA-256: ${clientSig.sha256Hash}`);
        doc.text(`IP: ${clientSig.ipAddress || "N/A"}`);
        doc.moveDown(1);
      }

      if (adminSig) {
        doc.fontSize(11).font("Helvetica-Bold").text("CONTRATADA (AuraAUDIT / CTS Brasil):");
        doc.fontSize(10).font("Helvetica").text(`Nome: ${adminSig.signerName}`);
        doc.text(`Data: ${new Date(adminSig.signedAt!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
        doc.text(`Hash SHA-256: ${adminSig.sha256Hash}`);
        doc.text(`IP: ${adminSig.ipAddress || "N/A"}`);
        doc.moveDown(1);
      }

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(0.5);
      doc.fontSize(8).font("Helvetica").text(
        `Documento gerado em ${new Date().toISOString()} | Integridade: SHA-256 ${sha256.substring(0, 16)}...`,
        { align: "center" }
      );

      doc.end();
    } catch (err) {
      console.error("Client contract PDF error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao gerar PDF do contrato." });
      }
    }
  });

  app.get("/api/client/proposal/pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const client = await getClientProfile(userId);
      if (!client) {
        return res.status(404).json({ error: "Perfil do cliente nao encontrado." });
      }

      const auditor = await getAuditorProfile();
      const contractText = generateContractText(auditor, client);
      const proposalData = extractProposalData(contractText, client);

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: "Proposta Comercial Aceita — AuraAUDIT",
          Author: "AuraAUDIT — CTS Brasil",
          Subject: "Resumo da Proposta Comercial Aceita",
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="proposta-comercial-aceita-auraaudit.pdf"`
      );
      doc.pipe(res);

      doc.fontSize(18).font("Helvetica-Bold").text("PROPOSTA COMERCIAL ACEITA", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text("AuraAUDIT — Auditoria Forense Independente", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica").text(`Contrato AUR-2025-0042 | Versao ${CONTRACT_VERSION}`, { align: "center" });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica-Bold").text("1. DADOS DO PROJETO");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Cliente: ${client.name}`);
      doc.text(`Tipo: ${client.type === "travel_agency" ? "Agencia de Viagens" : "Empresa Corporativa"}`);
      doc.text(`CNPJ: ${client.cnpj || "N/A"}`);
      doc.text(`Categoria: ${client.type === "travel_agency" ? "Viagens e Eventos" : "Corporativo"}`);
      doc.text(`Periodo de Analise: ${proposalData.period}`);
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica-Bold").text("2. VOLUMES SOB GESTAO (VAM)");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Volume ${proposalData.volumes.year1Label}: ${proposalData.volumes.year1}`);
      doc.text(`Volume ${proposalData.volumes.year2Label}: ${proposalData.volumes.year2}`);
      doc.text(`Volume Total Estimado: ${proposalData.volumes.total}`);
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica-Bold").text("3. SISTEMAS E FONTES DE DADOS");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      proposalData.systems.forEach((sys: string, i: number) => {
        doc.text(`  ${i + 1}. ${sys}`);
      });
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica-Bold").text("4. ESCOPO DA AUDITORIA");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      const scopeItems = [
        "Auditoria forense completa em despesas de viagens corporativas e eventos",
        "Analise de conformidade com politicas internas de viagens",
        "Reconciliacao entre sistemas OBT e Backoffice",
        "Identificacao de anomalias, duplicidades e fraudes potenciais",
        "Cruzamento de dados com fontes externas (cias aereas, agencias, cartoes)",
        "Avaliacao de eficiencia operacional e oportunidades de economia",
        "Verificacao de aderencia a Lei 13.964/2019 e normas anticorrupcao",
      ];
      scopeItems.forEach((item, i) => {
        doc.text(`  ${i + 1}. ${item}`);
      });
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica-Bold").text("5. ENTREGAVEIS");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      const deliverables = [
        "Relatorio executivo consolidado (a cada fase concluida)",
        "Relatorio tecnico detalhado com achados, evidencias e analises",
        "Mapeamento de riscos e vulnerabilidades",
        "Recomendacoes praticas para correcao e melhoria",
        "Plano de acao sugerido, priorizado por impacto e risco",
        "Dashboard Interativo de Resultados (tempo real via plataforma AuraAUDIT)",
        "Cadeia de Custodia Digital Completa (continuo)",
      ];
      deliverables.forEach((item, i) => {
        doc.text(`  ${i + 1}. ${item}`);
      });
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica-Bold").text("6. METODOLOGIA");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      const phases = [
        "Fase 01 — Proposta Comercial (Definicao de escopo e aceite)",
        "Fase 02 — Coleta de Dados (Recebimento e validacao dos documentos)",
        "Fase 03 — Reconciliacao (Cruzamento e analise forense)",
        "Fase 04 — Apresentacao (Relatorio executivo e achados)",
        "Fase 05 — Ajustes Finais (Plano de acao e acompanhamento)",
      ];
      phases.forEach((item) => {
        doc.text(`  ${item}`);
      });

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(0.5);
      doc.fontSize(8).font("Helvetica").text(
        `Proposta comercial aceita — vinculada ao Contrato AUR-2025-0042 v${CONTRACT_VERSION}`,
        { align: "center" }
      );
      doc.fontSize(8).text(
        `Documento gerado em ${new Date().toISOString()}`,
        { align: "center" }
      );

      doc.end();
    } catch (err) {
      console.error("Proposal PDF error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao gerar PDF da proposta." });
      }
    }
  });

  app.get("/api/client/documents/project", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const client = await getClientProfile(userId);
      if (!client) {
        return res.json({ documents: [] });
      }

      const sigs = await db
        .select()
        .from(contractSignatures)
        .where(eq(contractSignatures.contractNumber, "AUR-2025-0042"))
        .orderBy(desc(contractSignatures.signedAt));

      const clientSig = sigs.find(s => s.signerType === "client");
      const adminSig = sigs.find(s => s.signerType === "contractor");
      const bothSigned = !!(clientSig && adminSig);

      const auditor = await getAuditorProfile();
      const contractText = generateContractText(auditor, client);
      const sha256 = hashContractText(contractText);

      const documents = [
        {
          id: "contract-signed",
          title: "Contrato Assinado — AUR-2025-0042",
          description: `Contrato v${CONTRACT_VERSION} de Auditoria Forense Independente`,
          type: "contract",
          status: bothSigned ? "assinado" : clientSig ? "parcial" : "pendente",
          sha256: sha256,
          downloadUrl: "/api/client/contract/pdf",
          signedAt: clientSig?.signedAt ? new Date(clientSig.signedAt).toISOString() : null,
          signers: {
            client: clientSig ? { name: clientSig.signerName, date: new Date(clientSig.signedAt!).toISOString() } : null,
            contractor: adminSig ? { name: adminSig.signerName, date: new Date(adminSig.signedAt!).toISOString() } : null,
          },
        },
        {
          id: "proposal-accepted",
          title: "Proposta Comercial Aceita",
          description: "Resumo da proposta comercial com volumes, sistemas e escopo",
          type: "proposal",
          status: "aceita",
          downloadUrl: "/api/client/proposal/pdf",
          signedAt: clientSig?.signedAt ? new Date(clientSig.signedAt).toISOString() : null,
        },
      ];

      res.json({ documents });
    } catch (err) {
      console.error("Project documents error:", err);
      res.status(500).json({ error: "Erro ao buscar documentos do projeto." });
    }
  });

  app.get("/api/contract/:clientId/pdf", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Acesso restrito ao administrador." });
      }
      const { clientId } = req.params;
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) {
        return res.status(404).json({ error: "Cliente nao encontrado." });
      }
      const auditor = await getAuditorProfile();
      const contractText = generateContractText(auditor, client);
      const sha256 = hashContractText(contractText);

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        info: {
          Title: `Contrato AUR-2025-0042 v${CONTRACT_VERSION} — ${client.name}`,
          Author: "AuraAUDIT — CTS Brasil",
          Subject: "Contrato de Auditoria Forense Independente",
          Keywords: "auditoria, forense, travel, expense",
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="contrato-auraaudit-${client.cnpj?.replace(/\D/g, "") || clientId}.pdf"`
      );
      res.setHeader("X-SHA256", sha256);
      doc.pipe(res);

      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("CONTRATO DE AUDITORIA FORENSE INDEPENDENTE", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(`Versao ${CONTRACT_VERSION} | Contrato AUR-2025-0042`, { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(8).font("Helvetica").text(`SHA-256: ${sha256}`, { align: "center", color: "#666" });
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(0.5);

      const lines = contractText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          doc.moveDown(0.3);
          continue;
        }

        const isSectionHeader = /^={10,}/.test(trimmed);
        if (isSectionHeader) {
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#ccc");
          doc.moveDown(0.3);
          continue;
        }

        const isMainClause = /^(\d{1,2})\.\s/.test(trimmed) && !trimmed.startsWith("  ");
        const isSubClause = /^\d{1,2}\.\d+\./.test(trimmed);
        const isPartHeader = /^PARTE\s+(I|II|III|IV|V)\s/.test(trimmed);
        const isAnexoHeader = /^ANEXO\s+(I|II|III)/.test(trimmed);
        const isCPHeader = /^CP-\d{2}:/.test(trimmed);
        const isChecklistOk = trimmed.startsWith("[OK]");
        const isChecklistPending = trimmed.startsWith("[!!]");
        const isModule = /^M\d+\./.test(trimmed);
        const isEvidence = /^E\d+\./.test(trimmed);

        if (isPartHeader || isAnexoHeader) {
          doc.moveDown(0.5);
          doc.fontSize(13).font("Helvetica-Bold").text(trimmed);
          doc.moveDown(0.3);
        } else if (isCPHeader) {
          doc.moveDown(0.3);
          doc.fontSize(10).font("Helvetica-Bold").text(trimmed, { indent: 0 });
        } else if (isMainClause) {
          doc.moveDown(0.3);
          doc.fontSize(11).font("Helvetica-Bold").text(trimmed);
        } else if (isSubClause) {
          doc.fontSize(9.5).font("Helvetica").text(trimmed, { indent: 10 });
        } else if (isModule || isEvidence) {
          doc.fontSize(9).font("Helvetica").text(trimmed, { indent: 15 });
        } else if (isChecklistOk) {
          doc.fontSize(9).font("Helvetica").text(trimmed, { indent: 10 });
        } else if (isChecklistPending) {
          doc.fontSize(9).font("Helvetica-Bold").text(trimmed, { indent: 10 });
        } else if (trimmed.startsWith("  ")) {
          doc.fontSize(9).font("Helvetica").text(trimmed, { indent: 20 });
        } else {
          doc.fontSize(9.5).font("Helvetica").text(trimmed);
        }

        if (doc.y > 720) {
          doc.addPage();
        }
      }

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#333");
      doc.moveDown(0.5);
      doc.fontSize(8).font("Helvetica").text(
        `Documento gerado em ${new Date().toISOString()} | Integridade: SHA-256 ${sha256.substring(0, 16)}...`,
        { align: "center" }
      );

      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao gerar PDF do contrato." });
      }
    }
  });
}
