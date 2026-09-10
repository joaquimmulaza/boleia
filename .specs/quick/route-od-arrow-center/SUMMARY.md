# SUMMARY — Centrar seta Origem→Destino

## Feito

- `RouteOdRow`: grelha `minmax(0,1fr) | auto | minmax(0,1fr)`; origem `text-end`; destino `text-start`; seta `self-center`
- `OfertaMatchCard`: `min-w-0 flex-1` no item flex (badge fora da grelha)
- TDD em `RouteOdRow.test.jsx` + asserção no card browse

## Verificação

- Vitest: RouteOdRow + OfertaMatchCard + consumidores — verde
- ESLint nos ficheiros tocados — limpo
- Browser `/passageiro`: geometria `dx=0` `dy=0` em 1/1, 2/2 e 1/2 linhas; colunas iguais
- UI QA: VERDICT APPROVE ([UI QA](f05bb134-110f-4b53-9626-57da6527ec92))
- Code reviewer: VERDICT APPROVE ([Code review](c9d8c399-0ebc-4a00-8074-5696efd7f850))

## Commit (quando pedires)

`fix(ui): centrar seta origem-destino em RouteOdRow`
