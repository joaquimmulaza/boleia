# falta-ida-regresso-policy — Meia quota (decisão produto 2026-09-07)

**Tipo:** eng · **Tick:** 23  
**Decisão:** Opção 1 — **Meia quota** (manter código).

## Política canónica

| `viagem` | Desconto |
|----------|----------|
| `ambas` | `ROUND(quota_mensal / dias_uteis, 2)` — 100% do dia |
| `ida` ou `regresso` | `ROUND(quota_mensal / dias_uteis / 2, 2)` — 50% do dia |

Ex.: 30 000 Kz / 22 → ambas ≈ 1363,64 Kz; só ida ≈ 681,82 Kz.

## Requisitos

| ID | Requisito | Verificação |
|----|-----------|-------------|
| F1 | Trigger `handle_falta_desconto` aplica meia quota | SQL + teste aceite |
| F2 | `computeFaltaDesconto` espelha viagem | Vitest |
| F3 | UI `/faltas` permite escolher ida/regresso/ambas + copy proporcional | Vitest |
| F4 | Minuta contrato §9 alinhada (local gitignore) + texto em Spec | ficheiro |
| F5 | `STATE.md` regista decisão | docs |

## Fora do slice

- TTL reservas; ProxyPay; mudar gate custódia

## DoD

- Testes verdes; PR; merge = humano
