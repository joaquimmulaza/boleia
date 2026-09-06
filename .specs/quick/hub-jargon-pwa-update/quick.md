# Quick — Hub jargon regression tests + PWA update once-per-version

## A) Hub jargon (regression only)
- Hubs já limpos em `a1d59c9` — sem `1:N` / `matchmaking` / `marketplace` na UI.
- **Não** reescrever vocabulário de produto (oferta, procura, compatíveis, lista de espera).
- Estender ban tests estilo PR #73 às árvores hub/dashboard.

## B) PWA (delta principal)
- Ficheiros: `UpdatePrompt.jsx` + `UpdatePrompt.test.jsx` apenas.
- «Mais tarde» persiste `scriptURL` do SW à espera em `localStorage`.
- Gate modal até worker à espera diferente; «Atualizar agora» → fluxo existente.
