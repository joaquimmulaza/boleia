# PACOTE ENG #14 — Renovação M0→M1 sem recriar acordo

## Objetivo

Acordo mensal renova para o período seguinte **sem recriar** cabeçalho/passageiros; termos do snapshot ou adenda `em_vigor`; pagamento escrow reutilizado.

## Acceptance

1. Renovação **explícita** (RPC dedicada) — participante autenticado (motorista ou passageiro activo)
2. Novo período herda termos vigentes (adenda `em_vigor` ou cabeçalho + `quota_mensal_kz`) — **nunca** defaults plataforma
3. Pagamento M+1 → `pagamentos_acordo` + IBAN/comprovativo (path ENG #5)
4. Sem renovação → `apply_due_agreement_non_renewals` encerra no fim do ciclo (vagas + waitlist, sem órfãos)
5. CTAs só com auth; estados claros em `MyAgreements`

## Schema (mínimo)

- `pagamentos_acordo`: UNIQUE `(acordo_passageiro_id, mes_referencia)` em vez de só `acordo_passageiro_id`
- Colunas `acordos`: `renovacao_estado`, `renovacao_proximo_mes`, `renovacao_por`, `renovacao_em`
- RPCs: `renew_agreement_period`, `decline_agreement_renewal`, `apply_due_agreement_non_renewals`
- Helper SQL: `_resolve_termos_vigentes_acordo`, `_create_pagamentos_periodo`

## Fora de escopo

Pack B, ProxyPay, UX polish, testers
