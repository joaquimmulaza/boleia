# Quick — Truncagem de endereços (OD)

## Objectivo

Limitar altura visual de endereços Photon longos nos cards do marketplace com **line-clamp 2 + fade mask + `title` nativo**, sem «Ver mais» e sem Tooltip library.

## Inventário P0 (sem truncagem)

- `PassengerDashboard` — hub procura activa (OD)
- `DriverDashboard` — `OfertaRotaTitulo` + matches direct/waitlist (OD)
- `GrupoDescobertaPanel` — OD do grupo
- `MyAgreements` — card lista + título detalhe + Partida/Chegada

## Inventário P1 (upgrade / pickup)

- `OfertaMatchCard` — `truncate` 1 linha → clamp-2 + fade
- `PropostaReviewCard` — `pickup_name`
- `GrupoProcuraPanel` — `pickup_name`
- `AutocompleteDropdown` — `suggestion.description`

## Fora de âmbito

Forms (`AddressInput`), landing estática, nomes de pessoa já truncados, admin/IBAN, faltas, mapa.

## Aceite

- P0: máx. 2 linhas por lado OD
- Texto completo via `title`
- Dark mode coerente
- Primitivos: `TruncatedText` + `RouteOdRow`
