# ENG#8b — Fecho residual S22 (rescisão A + anular adenda)

**Data:** 2026-09-07  
**Tipo:** eng + UI `/acordos`  
**Origem:** tick local gaps visão × contrato × info-product

## Problema

Visão §22: rescisão consensual (A) deve permitir **imediato com pro-rata** ou **fim de ciclo**; iniciador deve poder **anular adenda** pendente (`cancelada_iniciador`). Hoje A só faz handshake → `cancelado` sem pro-rata/fim-ciclo; estado `cancelada_iniciador` existe no CHECK sem RPC/UI.

## Requisitos

| ID | Requisito | Verificação |
|----|-----------|-------------|
| A1 | Pedido consensual escolhe vigência `imediato` \| `fim_ciclo` (persistida no acordo) | Vitest + UI picker |
| A2 | Confirmação contraparte + `imediato` → `cancelado` + pro-rata quotas (dias úteis decorridos / `dias_uteis_mes`) | G15 + SQL |
| A3 | Confirmação + `fim_ciclo` → `cancelamento_pendente` até dia 1 (como aviso prévio) | G15 |
| A4 | RPC `cancel_agreement_adenda` → `cancelada_iniciador`; só `created_by`; só pendente | G14 + serviço |
| A5 | CTA «Anular renegociação» no detalhe do acordo para o iniciador | MyAgreements Vitest |
| A6 | Copy humana PT-PT; sem jargon N_* | UI QA |

## Fora do slice

- Contraproposta complexa de adenda
- Upload de provas para justa causa
- Assento antes de custódia / cláusula 9 ida-regresso (backlog #2/#3)
- ProxyPay / Garantie Retour

## DoD

- Migração aplicada remoto (Supabase MCP)
- `AgreementService.terminateAgreement` aceita `vigencia`
- `AgreementService.cancelAgreementAdenda`
- Testes G15/G14 + MyAgreements verdes
- PR aberto; merge = humano
