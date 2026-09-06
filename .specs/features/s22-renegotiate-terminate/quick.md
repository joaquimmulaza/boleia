# S22 — Renegociação bilateral + rescisão (slice UX)

**Data:** 2026-09-06  
**Scope:** Medium — UI + AgreementService; schema/RPC já existem em migrações s22.

## Requisitos

| ID | Requisito | Verificação |
|----|-----------|-------------|
| R1 | Passageiro activo vê «Renegociar preço» e propõe adenda (`renegotiate_agreement_pricing` → `pendente_contraparte`) | Vitest MyAgreements + motorista vê CTAs aceitar/rejeitar |
| R2 | Motorista responde adenda `pendente_contraparte` (aceitar/rejeitar) | Vitest MyAgreements |
| R3 | «Sair do acordo» apresenta 3 modalidades A/B/C ligadas a `terminate_agreement` | Vitest + AgreementService.test |
| R4 | Rescisão consensual pendente: contraparte confirma | Vitest banner + RPC |

## Fora do slice

- Idempotência offline para `terminate_agreement` (opcional wave seguinte)
- Motorista «Encerrar acordo» (passageiro cobre audit gap principal)

## RPCs (já aplicadas)

- `renegotiate_agreement_pricing` — bilateral
- `accept_agreement_adenda` / `reject_agreement_adenda` — contraparte
- `terminate_agreement(p_modo: consensual|aviso_previo|justa_causa, p_justificativa?)`
