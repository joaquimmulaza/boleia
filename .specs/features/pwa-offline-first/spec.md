# PWA Offline-First Wave 3 — Specification

## Problem Statement

Em Luanda a conectividade móvel é volátil. O Boleia Certa já tem VitePWA + precache do app shell, mas falta stale-while-revalidate para listagens, fila de escritas offline com idempotência e feedback visual de rede.

## Goals

- [ ] SWR no Service Worker para GET JSON de `acordos` e `grupos` (PostgREST)
- [ ] Fila IndexedDB `offline_write_queue` com `idempotency_key` (UUID)
- [ ] RPCs MVP `leave_passenger` e `cancel_proposal` com `p_idempotency_key` (dedupe no servidor)
- [ ] Background Sync tag `sync-offline-actions` + fallback `online` no cliente
- [ ] Hook `useNetworkStatus` + banner offline em `App.jsx`
- [ ] TDD Vitest com falhas de rede físicas simuladas

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Idempotência em `accept_proposal` / adendas / `leave_grupo_membro` | Wave seguinte |
| Optimistic UI completa «Saída Pendente» | Feedback mínimo nesta wave |
| `public/sw.js` / `registerServiceWorker.js` | Stack = VitePWA `src/sw.js` |
| Pasta `src/__tests__/` | Testes colocados ao lado do código |

## Requirements

| ID | Requirement |
| -- | ----------- |
| PWA-01 | App shell continua cache-first via VitePWA precache |
| PWA-02 | GET listagens `acordos`/`grupos` usam stale-while-revalidate no SW |
| PWA-03 | `leavePassenger` / `cancelProposta` enviam `p_idempotency_key` |
| PWA-04 | Falha de rede → payload na fila IndexedDB + registo sync |
| PWA-05 | Sync / drain remove item só após 2xx; chave duplicada no servidor = sucesso |
| PWA-06 | Banner offline com copy Luanda quando `isOffline` |
| PWA-07 | Testes cobrem offline enqueue, dedupe e reconciliação |

## Stack constraints

- JS + JSDoc; Vitest; VitePWA injectManifest
- DDL via migração em `supabase/migrations/` (+ aplicar no projecto remoto quando MCP/CLI disponível)
- Sem TypeScript / Prettier / toast library
