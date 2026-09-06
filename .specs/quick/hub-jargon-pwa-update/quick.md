# Quick — Hub jargon sweep + PWA update once-per-version

## A) Hub jargon
- Substituir copy técnica visível nos hubs (nav principal): «oferta de capacidade», «capacidade pretendida», etc.
- Manter identificadores internos / comentários de serviço.
- Testes: banir `1:N|matchmaking|marketplace` + enums `N_*` / `POR_PASSAGEIRO` nas árvores landing+hub (espelhar PR #73).

## B) PWA update
- Modal «Atualização disponível» uma vez por versão (scriptURL do SW à espera).
- «Agora não» persiste dismiss em `localStorage` até versão diferente.
- «Atualizar agora» aplica SW + reload.
- Sem re-prompt na mesma versão entre navegações.

## Verificação
- `npm run test:run` scoped + lint
- Testes UpdatePrompt + pwaUpdateDismiss
