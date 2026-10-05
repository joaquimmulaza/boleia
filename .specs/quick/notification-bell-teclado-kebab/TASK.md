# Quick Task: Teclado do kebab de notificação

**Date:** 2026-10-05
**Status:** Done

## Problema

Depois do #197, Enter/Espaço no kebab («Mais acções da notificação») ou em «Apagar» activa a linha (abre/navega a notificação). O `onKeyDown` do `<li>` faz `preventDefault` + `handleNotificationClick` para qualquer Enter/Espaço que borbulha. O wrapper do kebab corta o clique, não o keydown.

## Alteração

- A linha só activa com Enter/Espaço quando o foco está nela.
- O kebab corta a propagação de Enter/Espaço, para o menu e «Apagar» funcionarem pelo teclado.
- O `<li>` fica `role="button"` com nome acessível da mensagem.
- Não mexer nos anéis de foco de «Marcar todas lidas» nem do item do menu.
- Sem schema, sem `/explorar`.

## Verification

- [x] Enter/Espaço na linha com foco abre a notificação.
- [x] Enter/Espaço no kebab abre o menu e não a notificação.
- [x] Enter/Espaço em «Apagar» apaga e não abre a notificação.
- [x] Teste de apagar pelo teclado.
- [x] `role="button"` com nome da mensagem.
