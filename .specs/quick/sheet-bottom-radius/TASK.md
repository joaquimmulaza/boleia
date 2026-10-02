# Cantos inferiores arredondados nos sheets

## Problema
No telemóvel, `OverlayShell` (`variant="bottom"`) usa `p-0` e só arredonda o topo (`rounded-t-xl`). O painel encosta à base do ecrã e os cantos inferiores ficam rectos. A referência (cartão flutuante) mostra margem e os quatro cantos arredondados, com o fundo a aparecer nos cantos de baixo.

## Onde
- Forma canónica em `OverlayShell` quando `variant="bottom"`.
- Fora do shell, a mesma margem e o raio inferior: `InstallAppPrompt`, `UpdatePrompt`, `InstallAppInstructionsModal`, `OnboardingPermissions`.
- `MyAgreements` (diálogo inline com `rounded-2xl` e `p-4`) fica como está.
- Gesto de arrastar para fechar não muda. Variante `center` inalterada.

## Design
Sem ecrã Stitch novo: é chrome do primitivo existente, não um fluxo novo. UI Skills MCP não está neste ambiente; constraints de baseline aplicadas à mão:

- Raio único de 34px nos quatro cantos, alinhado ao cartão flutuante do Find My.
- Margem lateral 12px (`px-3`). Base `calc(16px + env(safe-area-inset-bottom))`: 16px além da safe area, para o fundo aparecer por baixo do cartão.
- O scrim continua por cima da BottomBar (`z-modal` > `z-bottom-nav`). A margem mostra o scrim nos cantos.
- O raio fica no mesmo elemento que o fundo e o `overflow`, para o conteúdo não quadrar os cantos.

## Comportamento
- Contentor bottom: `px-3` e `pb-[var(--sheet-bottom-inset)]` no telemóvel; `sm:p-4` a partir de `sm`. Sem `p-0`.
- `--sheet-bottom-inset: calc(16px + env(safe-area-inset-bottom, 0px))` em `src/index.css`.
- Painel: `rounded-[34px]` e `pb-sheet` (1.75rem). `pb-safe` no painel zera o padding quando a safe area é 0, por isso a folga interior é uma classe própria.
- `rounded-t-[20px]` sai de `OfertaDetailSheet`, `ProposalSheet` e `PropostaDetailSheet`.
- Prompts e onboarding: o mesmo `rounded-[34px]`, `px-3` e a mesma margem inferior. `pb-safe` no contentor exterior sai quando a margem do sheet já cobre a safe area, para não anular o padding Tailwind.

## AC
- Painel bottom de `OverlayShell` inclui `rounded-[34px]` e `px-3`; o contentor não tem `p-0`.
- Notificações deixam de exigir `rounded-t-xl`.
- Sheets fora do shell têm `rounded-[34px]` e a mesma margem.
- Testes de `OverlayShell` e `NotificationBell` verdes; lint limpo nos ficheiros tocados.
