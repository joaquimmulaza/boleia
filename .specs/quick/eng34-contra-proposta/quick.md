# ENG#34 — CTA Contra-proposta na proposta recebida

## Plano (reuse)

| Peça | Reuso |
|------|--------|
| Counter BE | `create_proposal` sentido oposto (B propõe após A); idempotência #29 por `(oferta, procura, created_by)` |
| Proposta A aberta | Mantém-se — não auto-reject; negociação paralela |
| Sheet valor | `PropostaValorInput` + `propostaValor.js` + `OverlayShell` + confirm |
| Preço publicado | `askKz` = `oferta.valor_mensal_ask_kz` |
| Valor proposto | `proposta.valor_mensal_ask_kz` no card recebido |
| Histórico | Secção «Propostas concluídas» existente — sem schema novo |
| Deep link #33 | `data-proposta-id` intacto; sem alterar query focus |

## AC
1. CTA «Fazer contra-proposta» em `PropostaReviewCard` (modo contraparte).
2. Sheet #30 com validação PT.
3. Distinção preço publicado vs valor proposto.
4. Pós-envio: notif/inbox existentes; deep links intactos.
5. Sem histórico dedicado (BE não tem chain).
