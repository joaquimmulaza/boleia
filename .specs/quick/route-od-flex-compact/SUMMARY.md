# SUMMARY — RouteOd flex compacto + fade condicional

## Feito

- `RouteOdRow`: flex compacto 1 linha; fade-x só com `.is-truncated`; sem `TruncatedText`
- CSS `.truncate-fade-x` (+ start/end) em `index.css`
- Cards: wrapper OD + badge `shrink-0`; `border-t` preço em procuras motorista; chips `shrink-0`
- Stitch: `ofertas-compativeis-od-flex` (`19eb9112bf1947bfbaca6d053097d5d2`)
- Spec: `.specs/quick/route-od-flex-compact/`

## Verificação

- Vitest RouteOdRow + OfertaMatchCard: 17/17
- ESLint limpo nos JS/JSX tocados
- Browser `/passageiro`: curto/curto sem fade; longo com `is-truncated` alinhado a overflow; seta `shrink-0`
- UI QA: VERDICT APPROVE ([UI QA](c78bd57a-4a85-4dfa-a3f0-a59cd0ffac31))
- Code reviewer: VERDICT APPROVE ([Code review](143358a9-0a46-48d5-9109-b20965ff8877))

## Commit (quando pedires)

`fix(ui): RouteOdRow flex compacto com fade condicional`
