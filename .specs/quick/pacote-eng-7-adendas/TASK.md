# PACOTE ENG #7 — Adendas effective_from dia 1 mês seguinte

## Goal
Renegociação bilateral sem mutar acordo no mês corrente; adenda versionada; só contraparte responde.

## Acceptance
1. Estados: pendente_contraparte / pendente_passageiro (PENDENTE_CONTRAPARTE) | rejeitada | cancelada_substituta | aceite_agendada | em_vigor
2. Aceite → effective_from = 1.º dia mês seguinte (Africa/Luanda); live intacto no mês corrente
3. Rejeição mantém acordo activo
4. Nova adenda marca anterior cancelada_substituta
5. Valores sempre do acordo/adenda — sem defaults plataforma
6. RPCs bloqueiam auto-aceite (created_by ≠ aceitante)

## Ship
- Migração: `respond_agreement_adenda`, aceite_agendada, cancelada_substituta
- Client: `respondAgreementAdenda`, util `adendaEffectiveFrom`
- Testes G13/G14 (month boundary)
- Soft: browse exclui cheia + limit

## Out of scope
- #8 cancelamento, ProxyPay, Critiquito
