# Quick — Interruptor push em /perfil

## Objetivo
Linha «Notificações» em `/perfil` com switch e 6 estados (Figma `245:4`, copy NOTIFICACOES v1.6).

## Estados (Figma)
1. Activado · 2. Desactivado · 3. A activar · 4. Bloqueado · 5. Erro · 6. Sem suporte (+ ajuda iPhone)

## Fora de scope
- `send-push`, NotificationBell, serviços de notificações, MyAgreements, leave/terminate.

## Verificação
- 6 testes (um por estado) · `npm run test:run` · `npm run lint`
