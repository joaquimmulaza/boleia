# Swipe-to-dismiss nos bottom sheets

## Problema
`SheetDragHandle` fecha o sheet aos 72px de `pointermove`, sem o painel seguir o dedo e sem o backdrop acompanhar. O utilizador precisa de um drag-to-dismiss real, no primitivo partilhado.

## Onde
- Gesto em `OverlayShell` quando `variant="bottom"`, há `onDismiss` e `dismissDisabled` é falso.
- `SheetDragHandle` fica só o grabber visual (`touch-none`). Quem ainda passa `onDismiss` ao handle não ganha um segundo sistema de estado.
- Variante `center` inalterada. Backdrop tap e Escape mantêm-se.
- `InstallAppPrompt`, `UpdatePrompt`, `InstallAppInstructionsModal` e `OnboardingPermissions` usam o mesmo gesto (shell ou `useSheetDrag`). `ConfirmationModal` continua fora.

## Comportamento
- `sheetY = max(0, dy)` via `translate3d` (sem re-render no drag).
- Backdrop: opacidade `1 - clamp(sheetY / altura, 0, 1)`.
- Fecha no `pointerup` se `sheetY >= 28%` da altura do painel, ou se a velocidade para baixo for `>= 0.75` px/ms com pelo menos `24px`.
- Abaixo do limiar: volta em ~380ms (`cubic-bezier(0.22, 1, 0.36, 1)`).
- Ao fechar: duração `clamp(restante / velocidade, 180, 420)` ms (`cubic-bezier(0.32, 0.72, 0, 1)`), depois o mesmo `onDismiss`.
- Altura medida `0` usa fallback `320px`.
- Lock de eixo `10px`. Swipe horizontal não fecha. Arrastar para cima na origem não desloca o painel.
- Scroll: se algum contentor (`overflow-y: auto|scroll`, incluindo classes Tailwind) entre o alvo e o painel tiver `scrollTop > 0`, o gesto é scroll. No topo, drag para baixo passa ao sheet.
- Não iniciar drag em `input`, `textarea`, `select`, `button`, `a` ou `[contenteditable]`.
- `prefers-reduced-motion: reduce` encurta a animação e chama na mesma `onDismiss`.
- Sem dependências novas (Pointer Events + Web Animations API).

## AC
- Painel segue o dedo; backdrop acompanha.
- Swipe suficiente ou flick fecha; swipe curto volta.
- Botão Fechar, backdrop e Escape continuam a fechar pelo mesmo `onDismiss`.
- Scroll, inputs e botões continuam utilizáveis. Swipe horizontal não fecha.
- Testes de `sheetGesture` e `OverlayShell` verdes; lint limpo.
