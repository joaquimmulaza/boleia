# PACOTE ENG#28 — Bottom bar vs modais/sheets

## Problema
Modais/sheets renderizados dentro de `<main>` (overflow) ficam abaixo da bottom nav (`z-bottom-nav: 50`) porque o stacking context de `main` é `z-auto`.

## Solução
1. `ModalPortal` — `createPortal` para `document.body` (padrão NotificationBell).
2. Tokens CSS: `--bottom-nav-height`, `pb-safe`, utilitários shell.
3. Actualizar shells partilhados: `ConfirmationModal`, `LogAbsenceModal`, `RejeicaoComprovativoModal`, `OnboardingPermissions`, sheets inline (MyAgreements, PassengerDashboard).
4. `z-50` → `z-modal` onde aplicável; painéis bottom com scroll + `pb-safe`.

## AC
- Overlay/modal acima da nav (portal + z-modal)
- CTAs alcançáveis (scroll interno, safe-area)
- Regressão: Acordos, propostas, pagamento, editar oferta, enviar proposta
