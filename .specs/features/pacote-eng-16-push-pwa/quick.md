# PACOTE ENG #16 — Push/PWA eventos domínio + deep-links

## Objetivo

Avisar no sítio certo (proposta, pagamento, adenda, renovação, liquidação) via `notificacoes` + push PWA, com deep-link para o ecrã correcto. WhatsApp permanece auxiliar.

## Acceptance

1. Eventos: proposta (existente); pagamento/`em_custodia`; adenda pendente; renovação disponível; liquidação/repasse (opcional)
2. Só participantes autenticados no objecto; sem spam (skip actor, dedup renovação)
3. Deep-links: `/acordos?openAcordoId=&focus=` (pagamento | adenda | renovacao)
4. Metadata sem OD (sem pickup/dropoff/lat/lng/origem/destino)

## Diff mínimo

- SQL: helper `notify_domain_event`, trigger `pagamentos_acordo`, `_maybe_notify_renewal_available`
- Client: `notificationRouter` + `MyAgreements` focus scroll
- Testes: `PacoteEng16Acceptance.test.js`, `notificationRouter.test.js`

## Fora de scope

Pack B, SMS/email marketing, Growth, testers
