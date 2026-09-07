# Design gate — ENG#8b (2026-09-07)

## UI Skills
- `ibelick/baseline-ui`: text-balance/pretty, tabular-nums, AlertDialog destrutivo, sem gradientes, erros junto da acção.

## Stitch
- Project: Boleia Certa `8575463146283895778`
- Screens editados: `rescindir-acordo`, `detalhe-acordo-s22`
- Fluxo: picker modalidade → (se consensual) picker vigência imediato|fim_ciclo → ConfirmationModal
- CTA «Anular renegociação» só para iniciador com adenda pendente

## Componentes
- `ConfirmationModal`, `Button`, chips adenda existentes em `MyAgreements`
- Sem novos primitivos shadcn obrigatórios

## Estados
- Loading/busy nos CTAs
- Sucesso/erro via `setMessage` / FeedbackAlert
- Offline queue já coberto por AgreementService
