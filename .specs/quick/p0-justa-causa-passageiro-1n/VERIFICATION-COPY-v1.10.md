# Verificação copy v1.10 (motorista — justa causa passageiro)

Data: 2026-10-12

## Copy implementada

- **B)** Parcial: «O lugar de {nome} terminou por justa causa a {data}. Recebes a parte do mês desse lugar até essa data, menos a comissão da Boleia Certa. Os outros passageiros continuam no acordo e não há penalização para ti.»
- **B2)** Último: «O lugar de {nome} terminou por justa causa a {data}, e o acordo foi encerrado porque era o último passageiro. Recebes a parte do mês até essa data, menos a comissão da Boleia Certa. A tua oferta continua publicada e não há penalização para ti.»

## Pro-rata por lugar

- `terminate_agreement` (passageiro, justa causa imediata) chama `ajustar_obrigacao_pagamento_mes(v_ap_row.id, v_hoje, false)` só para a linha do invocador (`20261012210000` / `20261012213000`).
- `ajustar_obrigacao_pagamento_mes(p_acordo_passageiro_id, …)` ajusta a obrigação/pagamento **daquele** `acordos_passageiros` (`20261009180000_p0_acordo_pagamento_estados.sql`).

**Conclusão:** alinhado com «parte do mês desse lugar até essa data».

## Comissão no repasse

- Pagamentos guardam `valor_payout_liquido_kz` via `compute_payout_liquido_kz(quota, take_rate)` (~10%) no fluxo escrow (`20260906224025_pacote_eng5_pagamentos_escrow.sql`).
- O pro-rata reduz `valor_kz` devido do passageiro; o payout líquido reflecte take-rate sobre o valor proporcional.

**Conclusão:** alinhado com «menos a comissão da Boleia Certa» no repasse ao motorista.

## Oferta publicada (B2)

- Após saída do último passageiro: `_maybe_fechar_acordo_sem_lugares_vivos` + `recount_oferta_vagas(v_acordo.oferta_id)` no ramo passageiro JC.
- `recount_oferta_vagas` repõe vagas e estado `disponivel`/`parcial` se a oferta não estiver `inactiva`.

**Conclusão:** alinhado com «A tua oferta continua publicada» (B2).
