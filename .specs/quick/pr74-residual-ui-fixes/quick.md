# Quick: PR #74 residual UI fixes (C1 + C2)

**Data:** 2026-09-06

## C1 — Contagem «Ofertas compatíveis»
- Secção só renderiza `matches.direct`; label contava `direct + waitlist`.
- Fix: contar só `matches.direct`.

## C2 — Órfãos waitlist sem filtro de estado
- `listWaitlistByProcura` devolve todos os estados; órfãos tratavam `cancelada`/`promovida` como activos.
- Fix: `filterWaitlistEntriesVisiveis` (activa | notificada) em `WaitlistService`; usar em `PassengerDashboard`.

## Soft — PropostaReviewCard historico
- `needsPicker` gated com `!isHistorico`.
