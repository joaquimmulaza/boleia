# Gaps 2026-09-07 — Visão × Contrato × info-product

Fontes: `Boleia_Certa_Visao_e_Fluxo_de_Produto.md`, `CONTRATO_PARTICULAR_…` (local/gitignore), `info-product.md`.

## Alinhado (Done)

- Invariantes marketplace §27 (quatro N, flex sem OD, propostas A/B, contraparte)
- Escrow take-rate ~10% + hard-gate contactos pós-`em_custodia` (ENG#5/#11/#13)
- Rescisão B (`aviso_previo`) e C (`justa_causa` + pro-rata)
- Renovação explícita M0→M1 (ENG#14)
- Waitlist = notificação, sem auto-aceite
- Adenda com consentimento + vigência próximo mês (motorista **e** passageiro podem iniciar)

## P1 — este tick (ENG#8b)

| Gap | Origem | Acção |
|-----|--------|-------|
| Rescisão A sem pro-rata / fim de ciclo | Visão §22 | `p_vigencia` + pro-rata ou `cancelamento_pendente` |
| Anular adenda pelo iniciador | Visão §22 | RPC `cancel_agreement_adenda` + CTA |

## P1 — próximo tick

| Gap | Origem | Notas |
|-----|--------|-------|
| Assento activo antes de `em_custodia` | info-product anti-leakage | **PR #100** (NEED_HUMAN merge) |
| Regra ida/regresso vs contrato §9 | Contrato | **Decisão 2026-09-07: Opção 1 meia quota** — tick 23 |

## Decisão faltas ida/regresso (2026-09-07)

**Canónica:** `ambas` = 100% do dia; `ida`/`regresso` = 50% (meia quota). Minuta §9 actualizada.

## P2 / residual

- Naming estados adenda (docs vs LOWERCASE código)
- Justa causa sem upload de prova (avaria/segurança = trust)
- Prazo pagamento / suspensão por atraso (contrato 3.4–3.5)
- Métricas GMV / capture rate (admin)

## Fora do MVP

Garantie Retour/táxi, seat-fill automático, ProxyPay, B2B RH, zonas/polígonos, contraposta complexa, KYC/BI.
