# PACOTE ENG #20 — Completar Partial E2E 4 / 8 / 10

**Branch:** `cursor/pacote-eng-20-e2e-partial-1375`  
**Base:** `main` pós ENG#18 (PR #110)

## Objetivo

Tornar **PASS** os fluxos Partial do audit E2E (#17 remapeado):

| # | Fluxo | Critério |
|---|--------|----------|
| 4 | Pagamento/comprovativo | upload → estados → admin activation; IBAN plataforma regressão |
| 8 | Renovação M0→M1 | explícita; herda termos; M1 exige pagamento; sem silent renew |
| 10 | Grupo entrada OR push | pedido→owner aceita/rejeita; push deep-link + auth soft-prompt |

## Entregáveis

- `PacoteEng20Acceptance.test.js` — evidência E2E Vitest
- Fix mocks drift (`.in`, `log_falta` RPC, `memberIds`, OnboardingPermissions)
- Audit actualizado em `.specs/audits/pacote-eng-e2e-fluxos-2026-09-10.md`

## Fora de scope

Pack B · TTL B1 (ENG#18) · features ENG#19 OD/WhatsApp
