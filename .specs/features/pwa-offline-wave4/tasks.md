# PWA Offline Wave 4 — Tasks

## T0 Spec
- [x] `.specs/features/pwa-offline-wave4/spec.md` + este ficheiro

## T1 EPSILON — Idempotência SQL + serviços
- [x] Migração `*_rpc_idempotency_wave4.sql` + **apply remoto** (boleia / Supabase MCP)
- [x] Wire `AgreementService` / `GrupoService` / `offlineQueue` + TDD

## T2 GAMMA — Procura UI (1C P1)
- [x] `PassengerDashboard`: dias_semana chips + teto_mensal_kz + testes
- [x] Display teto no hub quando presente

## T3 GAMMA — Acordos UI (1C P2 + Saída Pendente)
- [x] Reforço visual quota em MyAgreements
- [x] Optimistic Saída Pendente + testes

## T4 ALPHA — Audit (2C)
- [x] Helper `computeFaltaDesconto` + G9
- [x] G3/G4/G10 mocks; G5/G7/G8/G11/G12 live (RLS smoke + copy + router + jargon)

## T5 Gates
- [x] `npm run lint` + `npm run test:run`
- [x] AGENTS.md actualizado; handoff commit (sem commit automático)
