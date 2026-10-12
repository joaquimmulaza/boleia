# UX 4/6 — Criar procura (geocoder bairro)

## Objetivo
Autocomplete origem/destino ao nível do bairro (Luanda/Angola), reutilizando `LocationService` + `useAutocomplete` + `AddressInput`.

## Decisões
- Nominatim OSM: `countrycodes=ao`, `viewbox` Luanda (sem `bounded`).
- Label sugestões: «Bairro, Município»; só município por último.
- Texto livre sem coordenadas se sem resultados; nunca inventar lat/lng.
- Debounce + cancelar pedidos pendentes (AbortController).

## Fora de âmbito
Migrações, auth, env, copy nova (TODO Copywriter se necessário).
