# PACOTE ENG #25 — Ciclo de vida da oferta (motorista)

## Goal
Após publicar, motorista edita/actualiza/despublica sem ficar preso a «Publicado».

## Reutiliza
- `OfertaService.updateOferta` → RPC `update_oferta` (espelho `update_procura`)
- `oferta_compativel_com_procura` (editar procura migration)
- Estados `inactiva|disponivel|parcial|cheia`; browse/matching já filtram `inactiva`
- `DriverDashboard` hub; padrão CTAs `PassengerDashboard` editar/cancelar
- Guard acordo activo: espelho `_assert_procura_editavel` → `_assert_oferta_editavel`

## Diff
1. SQL: `update_oferta`, `cancel_oferta`, `_assert_oferta_editavel`, notify contraparte
2. `OfertaService.cancelOferta`; `updateOferta` via RPC
3. `canEditOferta`, `countPropostasAInvalidarPorOferta`
4. UI `DriverDashboard`: Editar / Despublicar + aviso snapshot

## AC
- [ ] Editar horário, preço/modalidade, dias, flex sem OD inventada
- [ ] Despublicar → `inactiva`; chip UI claro
- [ ] Browse/matching reflecte estado
- [ ] Propostas abertas: só invalidada/cancelada; snapshot intacto
- [ ] Dono-only (RPC)
- [ ] Acordo activo bloqueia cancelar (terminate existente)
