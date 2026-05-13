# Pendências de Governança · Aguardam Marcos · 2026-05-12

> Arquivo aberto pela **persona DPO AuraTECH** em 2026-05-12 19:55 BRT, ao assumir governança documental por delegação explícita de Marcos Costa.
>
> **Escopo:** este arquivo lista pendências que **NÃO podem ser decididas pelo agente** — exigem decisão humana de Marcos. Foram registradas para evitar carry-over silencioso para próximas sessões.

---

## 1. Estrutura 11 abas · Dra. Márcia Mirtes Alvarenga Ribeiro

### Inconsistência detectada
- **Memória** `AuraLEGAL/memory/feedback_estrutura_relatorio_dra_marcia_travada.md` afirma:
  > "🔒 ESTRUTURA TRAVADA · aprovada pela Dra. Márcia Mirtes Alvarenga Ribeiro · OAB/SP 244.190 em 30/04/2026"
- **Skill global** `/session-start` (passo 4.3.0) afirma:
  > "Status atual: 🟡 PROVISÓRIA · aguardando revisão final da Dra. Márcia"

### O que precisa de você
Confirme qual é a verdade:

- [ ] Opção A — A Dra. Márcia **JÁ aprovou** em 30/04 (memória correta) → **ajustar skill global** `/session-start` removendo "PROVISÓRIA" e colocando "TRAVADA"
- [ ] Opção B — A Dra. Márcia **ainda NÃO aprovou** (skill correta) → **ajustar memória** colocando "🟡 PROVISÓRIA · aguardando OK"
- [ ] Opção C — Houve aprovação parcial → registrar quais abas estão travadas e quais ainda em revisão

### Por que importa
Próximo agente Claude trabalhando em caso AuraLEGAL pode:
- Achar que pode mudar a estrutura (se ler skill) → quebrar padrão aprovado
- Achar que NÃO pode mudar (se ler memória) → bloquear ajuste necessário

### Bloqueio
Não foi resolvido pela persona DPO porque envolve **conversa entre você e a Dra. Márcia** — fora do escopo agente.

---

## 2. WhatsApp 4 precatórios SP — destino dos rascunhos

### Estado atual
Arquivos em `docs/comerciais/whatsapp/`:
- `2026-04_4_precatorios_sp_v1.txt` (SHA `942b675c...`) — rascunho inicial
- `2026-04_4_precatorios_sp_v2_final.txt` (SHA `f496a7ac...`) — rascunho "final"

### O que diz o conteúdo
4 precatórios federais TRF1 R$ 20-35M (R$ 113M total), LOA 2026, com 3 dos 4 CNJs originários localizados. Texto pronto para copy-paste no WhatsApp Web. **Sem integração técnica de envio.**

### O que precisa de você
Decidir destino:

- [ ] **Enviar manualmente via WhatsApp Web** — copy-paste para contatos qualificados (advogados de cessão / investidores de precatório). Memória `feedback_protecao_competitiva` exige mascarar fontes (tribunais e APIs) — texto atual já faz isso.
- [ ] **Descartar** — material envelheceu (5 semanas) e perdeu janela. Mover de `docs/comerciais/whatsapp/` para `docs/comerciais/whatsapp/arquivados/` ou deletar.
- [ ] **Arquivar como caso de uso** — manter como template para próximas campanhas. Renomear para `TEMPLATE_lote_4_precatorios_meio_termo.txt`.

### Bloqueio
Decisão **comercial**, fora do escopo agente. Persona DPO não decide o que é enviado a terceiros.

---

## 3. Sessão AuraLEGAL para o Caso Fernando Guide

### Estado
- Handoff completo em `docs/handoffs/auralegal/2026-05-12_fernando_guide.md`
- 6 PDFs selados em SHA-256
- DD AuraLOA descartada (Fase 0 detectou 7 sinais inconsistentes)

### O que precisa de você
- [ ] Fernando deu prazo? Se sim, prioridade ALTA
- [ ] Você inicia a sessão AuraLEGAL ou delega?
- [ ] Caso passa para Dra. Márcia (estrutura 11 abas) ou outro fluxo AuraLEGAL?

### Bloqueio
DD AuraLEGAL é projeto separado — persona DPO AuraLOA não toca lá. Necessita você abrir sessão dedicada.

---

## 4. Push para `origin/AMPE-Tech/AuraLOA`

### Estado
Branch local `wip/save-2026-05-05` está **13 commits ahead + 0 behind** de `origin/main`. Após o commit DPO de hoje, ficará **14 commits ahead**.

### O que precisa de você
- [ ] Autorizar push (decisão irreversível externa — exposição pública via GitHub) — `git push origin wip/save-2026-05-05`
- [ ] Ou autorizar merge para main + push
- [ ] Ou manter local até decisão posterior

### Bloqueio
**Persona DPO local NÃO autoriza push.** Push expõe trabalho ao remote público (AMPE-Tech). Decisão fica com o titular, não com DPO funcional.

---

## 5. PII em arquivos legacy

### Estado
- `dashboard_cliente_acessos.log` (1,9 KB) — contém email completo de Ricardo Vinicius (cagiva.industria@gmail.com)
- 4 PDFs antigos em `Documento Entrada/MONTICHIARI*` removidos do tracking via `git rm --cached` hoje — mas histórico Git anterior contém esses arquivos

### O que precisa de você
- [ ] Deletar fisicamente `dashboard_cliente_acessos.log`? (gitignored mas existe no disco)
- [ ] Considerar `git filter-repo` para apagar PDFs antigos do histórico Git? (operação destrutiva — só se for compartilhar repo publicamente)
- [ ] Política de retenção de logs cliente — quantos dias?

### Bloqueio
**Política de retenção é DPO real (você).** Persona funcional do agente não tem autoridade para deletar dados de cliente sem decisão escrita.

---

## Resumo executivo

| # | Pendência | Bloqueio | Quando vira urgente |
|---|---|---|---|
| 1 | Dra. Márcia 🔒/🟡 | Você + Dra. Márcia | Próximo caso AuraLEGAL grande |
| 2 | WhatsApp | Decisão comercial | Cada dia perde valor (~5 sem decisão) |
| 3 | Sessão AuraLEGAL Fernando | Você + projeto separado | Se Fernando cobrar |
| 4 | Push origin | Você (decisão pública) | Quando quiser publicar trabalho |
| 5 | Política retenção PII | Você como DPO real | Auditoria LGPD ou auditoria Gemini |

— Persona DPO AuraTECH · 2026-05-12
