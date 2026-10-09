# estado-passageiro-saiu-expirado

## Problema
Saída voluntária com lugar `reservado`: `leave_passenger` chama `_expirar_lugar_reservado_sem_divida` → `estado = expirado`. UI mostra «Expirado» em vez de «Saiu».

## Aceite
- `saiu` → «Saiu»; TTL `expirado` → «Expirado»; nunca «Activo» no chip de lugar.
- Fonte única: `src/utils/estadoPassageiro.js`.
- RPC: `leave_passenger` marca `saiu` ao sair de `reservado` (anula pagamento, motivo intacto).
- Legacy UI: `expirado` + motivo saída voluntária → chip «Saiu».
- Copy modal saída: ponto final em vez de travessão.
