# Editar procura activa — Design

**Status:** Gate design pronto  
**Spec:** `.specs/features/editar-procura/spec.md`  
**Gathered:** 2026-09-08

## Flow

1. Hub procura activa → «Editar procura» (secundário) / «Cancelar procura» (terciário destrutivo)
2. Formulário reutilizado (sem tipo individual/grupo, sem `return_time`)
3. Preview `evaluateMatch` → 0 impacto: gravar; N≥1: `ConfirmationModal`
4. Arquivar: modal sempre com contagens
5. Hub recarrega matches; propostas incompatíveis no histórico; chip «Acima do teto» se o ask exceder

## Estados

| Estado | UI |
| ------ | -- |
| Activa / em negociação | CTAs visíveis |
| Fechada / cancelada | Sem editar/cancelar |
| Loading | `LoadingSkeleton` |
| Erro | `FeedbackAlert` junto da acção |
| Sucesso | «Procura actualizada» / «Procura cancelada» (`role="status"`) |
| Proposta aberta acima do teto | Chip âmbar «Acima do teto» — proposta continua aberta |
| Confirmação impacto | Só se N≥1 a invalidar |
| Confirmação arquivo | Sempre |

## shadcn / primitivos

- Reutilizar `ConfirmationModal` (AlertDialog destrutivo / primary)
- `FeedbackAlert`, `PageHeader`, `PageShell`, `AddressInput`, `TimeInput`
- Chips existentes (não jargon)

## Stitch (SoT)

- Projecto canónico: `8575463146283895778` («Boleia Certa»)
- Ecrã: `14fb5cff846047269c8baf45e4328dec` — «Hub de Procura - Boleia Certa»
- CTAs: Ver ofertas / Editar procura / Cancelar procura; chip «Acima do teto»; modal de impacto

## UI Skills

- `ibelick/baseline-ui` consultado **antes** do generate: `text-balance` / `text-pretty`, `tabular-nums`, erros junto da acção, AlertDialog destrutivo, alvos ≥44px, sem gradientes, um accent.

## Mobbin

Degradado — não bloqueia (plano free / não usado neste ciclo).

## VERDICT

VERDICT: APPROVE  
ISSUES: nenhum bloqueante  
NEXT: implementer TDD
