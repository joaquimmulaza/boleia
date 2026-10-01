# ENG#35 — Mudar preço do próximo mês (≠ renovar)

**Status:** implementado 2026-10-01 · Figma `OUrBNaukPsXB14x2nwGSJy` · reutiliza `acordos_adendas`

## Regras

1. Mês actual nunca altera; novo preço só dia 1 mês seguinte se aceite.
2. Respostas: Aceitar · Contra-propor · Recusar (≠ encerrar acordo).
3. Proponente Retirar → mês seguinte mantém preço actual.
4. Após Recusar, enquanto válida: Voltar a aceitar.
5. Uma negociação activa de cada vez.
6. Renovar/Não renovar = CTAs e ecrãs separados.
7. Janela até dia 28 (Luanda); fechada → renovar/não renovar com preço actual.

## Implementação

- **BD:** migração `20261001140321_pacote_eng35_preco_proximo_mes.sql` (janela, re-aceitar `rejeitada`, supersede alargado); hotfix auth `20261001150000_pacote_eng35_adenda_auth_hotfix.sql`.
- **Serviços:** `listAdendaHistorico`; `withPendingAdenda` inclui `rejeitada`.
- **Utils:** `precoProximoMes.js`, `adendaNegociacao.js`.
- **UI:** `AcordoPrecoProximoMesPanel` em `MyAgreements`; ecrãs `/acordos/:id/preco/*`, `/renovar`, `/nao-renovar`.
- **Figma nodes:** 9:27, 9:93, 12:2, 9:125, 9:164, 9:197, 9:221, 9:245, 11:3, 12:26, 11:30, 11:90, 12:57.
