# Serasa — Pendências para ativação

Criado: 2026-04-27 (esqueleto pronto, aguardando inputs do Marcos).

## Checklist

- [ ] **Credenciais Serasa** — adicionar no `.env`:
  - `SERASA_LOGON` (8 chars)
  - `SERASA_SENHA` (8 chars)
  - `SERASA_NOVA_SENHA` (8 chars; repetir SENHA se não vai trocar)
  - `SERASA_AMBIENTE=homologacao` (começar por homologação)

- [ ] **IP de saída liberado** com a Serasa
  - Decidir: VPS Replit ou Hetzner?
  - Enviar IP para `implantacao@br.experian.com` / (11) 2847-9040
  - Aguardar confirmação de whitelist

- [ ] **Escolher 1º produto** a implementar (Marcos decide)
  - Sugestão: **Cadastral PF** (mais comum, base pra outros)
  - Outros candidatos: Cadastral PJ, Concentre, Score PF/PJ, Pefin

- [ ] **Obter layout do produto** escolhido
  - Manual específico Serasa (não está no PDF de transporte)
  - Cola aqui ou anexa no chat

- [ ] **Implementar `produtos/{produto}.ts`** com builder + parser

- [ ] **Testar em homologação** (1 caso real)

- [ ] **Validar** + integrar como camada complementar do AuraDNA

## O que JÁ está pronto (esqueleto)

- `README.md` — visão geral, endpoints, regras de acesso
- `types.ts` — interfaces públicas
- `client.ts` — transporte HTTPS POST TLS 1.2+ (testado: validação 8-chars, monta body, chama URL)
- `auth.ts` — lê credenciais do `.env`
- `produtos/_template.ts` — esqueleto pra copiar e implementar cada produto

Nada de código existente foi alterado. Pasta totalmente isolada em `server/services/serasa/`.

## Referência

- PDF: `Instrucoes-de-utilizacao-HTTPS.pdf` (Serasa Experian, jan/2022)
- Endpoints:
  - Homologação: `https://mqlinuxext-2.serasa.com.br/Homologa/consultahttps`
  - Produção: `https://sitenet43-2.serasa.com.br/Prod/consultahttps`
- IPs Serasa: `200.245.207.218` (prod) / `200.245.207.217` (homol) — porta 443
