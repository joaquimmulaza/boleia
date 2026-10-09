# lugares-vivos-contagem (P0 QA acordo 104aa236)

## Problema
Contagens e listas usam `n_passageiros_contrato` ou `estado` bruto em vez do chip canónico (`estadoPassageiroParaChip` + pagamento). Motorista vê «Passageiros · 2» e «Reservados 2» com seat1 `reservado` e seat2 `saiu`. Passageiro vê cabeçalho 2 com 1 linha (RLS). Pagamentos motorista mostram quota do que saiu de `reservado` (anulado) no primeiro open.

## Aceite
1. Cabeçalho «Passageiros · N» e «Confirmados · Reservados» só lugares vivos (`activo`|`reservado` após chip).
2. Quem saiu → chip «Saiu» (nunca «Reservado»), via `estadoPassageiro.js`.
3. Passageiro: N do cabeçalho = linhas vivas visíveis (não `N_contrato`).
4. «Pagamentos do mês» motorista: sem linha para lugar não vivo / pagamento `anulado` no primeiro load.
5. Contactos: só passageiros vivos.

## Fonte única
`lugaresVivos` / `contagemLugaresVivos` em `src/utils/estadoPassageiro.js`.
