# Summary: Teclado do kebab de notificação

A hipótese confirmou-se no `main` (`610bc7a`): o `onKeyDown` do `<li>` tratava qualquer Enter/Espaço que borbulhava, e o wrapper do kebab só fazia `stopPropagation` no clique.

A linha activa-se só quando o evento nasce nela. O kebab corta Enter/Espaço. O `<li>` tem `role="button"` e `aria-label` com a mensagem. Os anéis de foco de «Marcar todas lidas» e do item «Apagar» ficaram iguais.

Testes: `src/components/NotificationBell.test.jsx` — 10/10.
