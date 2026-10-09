# P1 encerramento — gap report (main @ edb60e7)

Verificação contra `origin/main` antes de implementação. PR #244 (`20261009170000_cancel_procura_membros_saiu`) e PR #235 (offline queue / idempotency wave) considerados.

## Regra 1 — Segunda «Confirmar» rescisão idempotente

**Estado: parcialmente coberta — falha em cenário QA (400).**

| Evidência | O quê |
|-----------|--------|
| `supabase/migrations/20261009180000_p0_acordo_pagamento_estados.sql` | `terminate_agreement` — bloco L1183–1204 devolve no-op se `rescisao_confirmada_em` preenchido + estados terminais; `rpc_idempotency` com chave estável. |
| `src/utils/terminateIdempotency.js` | `terminateConfirmIdempotencyKey(acordoId)` — UUID v5 fixo por acordo na confirmação consensual. |
| `src/pages/MyAgreements.jsx` L827–944 | `handleTerminate` usa chave estável; catch só trata «Sem permissão para rescindir» (L289–294), **não** «Este acordo já não está activo». |
| `src/services/P0AcordoPagamentoEstadosAcceptance.test.js` | Contrato SQL (regex) — **sem** prova PG de segunda chamada nem teste Vitest de UI/ RPC duplicado. |

**Lacuna:** segunda confirmação com **nova** `p_idempotency_key` (retry/rede) após `estado` ≠ `activo` cai em L1243–1245 (`RAISE EXCEPTION`) → PostgREST 400 → toast de erro. Idempotência antecipada exige `rescisao_confirmada_em IS NOT NULL`; confirmação imediata pode deixar janela ou caminhos sem carimbo antes do cliente refrescar.

**Implementar:** alargar no-op consensual na RPC antes do guard `estado <> activo`; alargar catch em `MyAgreements.jsx` para «já não está activo» em fluxo de confirmação; prova PG `supabase/tests/p1_terminate_confirm_idempotent_pg_proof.sql`.

---

## Regra 2 — Hub passageiro sem «Ver acordo» após cancelamento

**Estado: parcialmente coberta — CTA fantasma possível.**

| Evidência | O quê |
|-----------|--------|
| `src/utils/acordoPorOferta.js` | `isAcordoVivoParaPassageiro` / `buildAcordoIdPorOfertaMap` excluem `cancelado` e linha `saiu`. |
| `src/utils/acordoPorOferta.test.js` L36–55 | Cobre mapa sem acordos cancelados. |
| `src/pages/PassengerDashboard.jsx` L317 | `mergeAcordosPassageiro` — **mantém** entrada `_optimista` se TTL < 30s mesmo quando fetch traz acordo **terminado** na mesma `oferta_id` (só verifica `ofertasComVivo`). |
| `src/pages/PassengerDashboard.jsx` | **Não** subscreve `subscribeMarketplaceHubRefresh` (contraste: `MyAgreements.jsx` L626–628). |
| `MyAgreements.jsx` | **Não** chama `notifyMarketplaceHubRefresh` após rescisão/saída. |
| PR #244 | `cancel_procura` — membos/grupo; **não** sincroniza CTAs do hub passageiro. |

**Lacuna:** após encerrar acordo ou cancelar procura, hub pode continuar a mostrar «Ver acordo» por merge optimista ou lista desactualizada.

**Implementar:** corrigir `mergeAcordosPassageiro`; `PassengerDashboard` subscreve refresh; `MyAgreements` notifica hub após terminate/leave; teste Vitest hub/merge.

---

## Regra 3 — Motorista notificado quando passageiro cancela/sai

**Estado: parcialmente coberta.**

| Evidência | O quê |
|-----------|--------|
| `supabase/migrations/20261008140100_acordo_notifications_skip_rescisao_rpc.sql` | Trigger `handle_acordo_notifications` — motorista recebe «Um acordo foi cancelado.» em `estado → cancelado` (excepto flag skip no consensual imediato). |
| `terminate_agreement` (P0 + 081401) | INSERT `notificacoes` para contraparte no pedido/confirmação consensual e pós-rescisão (`v_mensagem`). |
| `supabase/migrations/20261009180000_p0_acordo_pagamento_estados.sql` `leave_passenger` L880–975 | **Sem** INSERT em `notificacoes` para o motorista. Saída parcial (`activo` mantido) não dispara trigger de cancelamento. |
| PR #235 | Fila offline — irrelevante para notificação motorista. |

**Lacuna:** `leave_passenger` (passageiro «Sair só eu») não avisa motorista enquanto o acordo permanece activo.

**Implementar:** notificar `driver_id` em `leave_passenger` quando saída é do passageiro e cabeçalho continua `activo` (reutilizar tipo/metadata `agreement_update`); prova PG.

**Copy nova (PM):** «Um passageiro saiu do acordo.» — única string nova; rescisão/cancelamento total reutiliza strings existentes do trigger/RPC.

---

## Migração prevista

Sim: `20261009200000_p1_encerramento_gaps.sql` (`leave_passenger` + `terminate_agreement`).
