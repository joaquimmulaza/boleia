# PWA Offline-First — Tasks

## T1 Spec
Artefactos `.specs/features/pwa-offline-first/` — Done neste Execute.

## T2 ALPHA — Testes a vermelho
- `src/services/db.test.js`, `offlineQueue.test.js`, `OfflineSyncEngine.test.js`
- `src/hooks/useNetworkStatus.test.js`
- Extensões `AgreementService.test.js` / `PropostaService.test.js`

## T3 EPSILON — IDB + fila + serviços
- `src/services/db.js`, `offlineQueue.js`
- Wire `leavePassenger` / `cancelProposta`

## T4 EPSILON — Migração RPC
- `supabase/migrations/*_rpc_idempotency_leave_cancel.sql`
- Aplicar no projecto Supabase quando possível

## T5 DELTA — UI rede
- `useNetworkStatus.js` + banner em `App.jsx`

## T6 SW merge
- SWR + `sync` em `src/sw.js`

## T7 Verde + AGENTS.md + handoff
