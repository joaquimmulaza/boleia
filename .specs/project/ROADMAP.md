# Boleia Certa — Roadmap

## Feito (marketplace MVP)

- Oferta/procura, grupo vivo, propostas A/B, acordo 1:N
- Matching fixa (geo+tempo) e flexível (sem OD/residência)
- Waitlist sem auto-aceitar; faltas; adenda com consentimento; terminate A/B/C
- PWA offline waves 3–4; landing commute; agent loop + Graphlore + Stitch/UI Skills

## Agora — Next (engenharia de produto)

Já em `main` (não reabrir como pacote eng):

- Custódia IBAN semi-manual + Storage comprovativos (ENG#5)
- Perfil IBAN motorista + payout / take-rate / faltas (ENG#11/#13)
- Admin `/admin/pagamentos` + liquidação período (ENG#5/#13) + fix race AdminRoute (#97)

Ordem sugerida para o loop PM → Shipwright (1 pacote por tick):

1. Política desconto ida/regresso (alinhar contrato-exemplo vs meia quota)
2. Polish admin UX (Critiquito) — opcional

Já feito: cânone docs (#98); ENG#8b S22 (#99); **seat-before-custody** soft-hold (#PR); copy «zona» guardada por testes.

## Depois

- ProxyPay / Multicaixa Express (substituir upload por webhook sem mudar lógica de assentos/adendas)
- Take-rate configurável + métricas on-platform capture
- Piloto 60 dias: 1–2 corredores Luanda + âncora B2B (ver memos produto)
- Upsell B2B (dashboard RH / fatura única) quando houver densidade

## Fora do MVP / política permanente

- Zonas/polígonos/raio residencial
- Adenda com contrapostos complexos (mínimo: nova proposta + `cancelada_substituta`; ambos os papéis já iniciam preço)
- Growth/social bots no loop (fase 2 do agent fleet)
- **Merge automático em `main` — proibido permanentemente** (não é “adiável”; ver `.specs/loop/ESCALATION.md`)

## Fontes

- Visão: `PROJECT.md` + `Boleia_Certa_Visao_e_Fluxo_de_Produto.md`
- Decisões biz: `STATE.md` (secção Monetização / GTM)
- Loop: `.specs/loop/` + skills `boleia-product-*` / `boleia-shipwright`
