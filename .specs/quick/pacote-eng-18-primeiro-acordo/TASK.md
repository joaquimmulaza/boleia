# PACOTE ENG #18 — Fechar path 1.º acordo (B1+B3+B4)

**Escopo:** B1 TTL reservas · B3 admin piloto · B4 IBAN motorista na liquidação  
**Fora:** B2 env · Pack B · fluxos 4/8/10

## B1 — TTL reservas
- `reservado_expira_em` (72h piloto) definido no aceite
- RPC lazy `apply_due_reserva_expiry` → `expirado`, liberta vaga, `promote_waitlist` best-effort
- Não expira se pagamento já `comprovativo_enviado` / `em_custodia` / `liquidado`
- UI: chip/banner «Reserva expirada»

## B3 — Admin piloto
- Documentar passos mínimos em `OPS.md`
- Painel `/admin/pagamentos`: guia piloto na tab Validar

## B4 — IBAN motorista
- `admin_liquidate_period` + `admin_liquidate_payment` + `_refresh_repasse_motorista` exigem `iban` + `iban_titular`
- Erro PT claro na UI admin
