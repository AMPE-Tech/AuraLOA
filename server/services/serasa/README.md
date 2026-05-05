# Serasa Experian — String de Dados HTTPS

Módulo NOVO. Não altera nada de `server/services/*` existente.
Pode ser usado pelo AuraDNA como camada complementar de validação cadastral do credor.

## Referência

Guia oficial Serasa: `Instrucoes-de-utilizacao-HTTPS.pdf` (jan/2022).

## Endpoints

| Ambiente | URL |
|---|---|
| Homologação | `https://mqlinuxext-2.serasa.com.br/Homologa/consultahttps` |
| Produção | `https://sitenet43-2.serasa.com.br/Prod/consultahttps` |

IP whitelistado (Serasa precisa liberar nosso IP de saída):
- Produção: `200.245.207.218:443`
- Homologação: `200.245.207.217:443`

## Protocolo

- HTTPS, **TLS 1.2 ou superior** (versões anteriores recusadas)
- Método: **POST** com `Content-Type: application/x-www-form-urlencoded`
- Único parâmetro `p` no body, formato:
  ```
  Logon(8) + Senha(8) + NovaSenha(8) + Layout do Produto
  ```
  Os 3 primeiros blocos são **fixos em 8 chars** cada (24 chars iniciais).
  `NovaSenha` = repetir `Senha` quando NÃO for trocar.

## Produtos (a configurar)

Cada produto Serasa tem **layout próprio** (string de entrada + estrutura do retorno).
Esses layouts NÃO estão no PDF de transporte — Serasa fornece à parte por contrato.

Lista comum:
- Cadastral PF / PJ
- Concentre
- Score PF (Crédito) / Score PJ
- Pefin (pendências)
- Relato (relacionamento)

⚠️ **Implementar 1 produto por arquivo em `produtos/`** — cada um com seu builder de string e parser de resposta.

## Estrutura

```
serasa/
├── README.md                  (este arquivo)
├── types.ts                   (interfaces SerasaCredentials, SerasaRequest, SerasaResponse)
├── client.ts                  (transporte HTTPS POST genérico — TLS 1.2)
├── auth.ts                    (lê credenciais do .env)
└── produtos/
    ├── _template.ts           (esqueleto p/ novos produtos)
    └── (um arquivo por produto contratado)
```

## Credenciais

Variáveis de ambiente (a adicionar no `.env`):
```
SERASA_LOGON=xxxxxxxx          # 8 chars exatos
SERASA_SENHA=xxxxxxxx          # 8 chars exatos
SERASA_NOVA_SENHA=xxxxxxxx     # repetir SENHA se não vai trocar
SERASA_AMBIENTE=homologacao    # ou 'producao'
```

⚠️ NÃO commitar `.env` (já está no `.gitignore` do AuraLOA).

## Próximos passos

1. Marcos confirma qual produto começar (ex: Cadastral PF)
2. Marcos cola o layout do produto (PDF/manual Serasa)
3. Implementar `produtos/cadastral_pf.ts` com builder + parser
4. Teste em homologação
5. Liberação IP de saída do Replit/Hetzner pela Serasa antes de produção

## Status

Esqueleto criado em 2026-04-27. Aguardando: credenciais + escolha do produto + layout.
