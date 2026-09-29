# PACOTE #29 — Anti-duplicado após Enviar/Propor

## Objetivo
Idempotência backend + UI: 2º tap não cria proposta duplicada; CTA «Proposta enviada» ou oculto.

## AC
1. `(oferta_id, procura_id, created_by)` único parcial `WHERE estado='aberta'`
2. RPC `create_proposal` devolve existente em conflito
3. UI passageiro (browse + direct) e motorista (procuras hub)
4. Vitest `PacoteEng29Acceptance`

## Fora
Pack B, polish genérico.
