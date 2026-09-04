# Handoff — Marketplace Oferta / Procura

**Date:** 2026-09-04  
**Feature:** Marketplace Oferta / Procura  
**Fase TLC:** Execute  
**Task actual:** **T1–T21 Complete** + Visual QA  
**Branch:** `main`

---

## Visual QA (2026-09-04)

Fluxo E2E no browser (`localhost:5173`), contas QA criadas:

1. Motorista: veículo → publicar oferta Talatona→Miramar → hub
2. Passageiro: procura → match → propor acordo
3. Motorista: aceitar proposta → acordo activo + notificação

**Correcções na sessão QA:**
- RLS: recursão infinita `acordos` ↔ `acordos_passageiros` → funções `is_acordo_driver` / `is_acordo_passenger` (migração `fix_rls_acordos_recursion`)
- Plural «1 oferta compatível»
- Cartão de acordo mostra origem→destino (join `ofertas_capacidade`)

**Pendências visuais (não bloqueantes):** Penpot MCP offline; UI mobile-first em viewport largo (esperado); detalhe de acordo ainda simplificado vs v0.

---

## Progresso

| Fase | Status |
|------|--------|
| T1–T21 | **Done** |

## Contas QA (teste)
- `qa.motorista.mkt+20260904@boleiacerta.test` / `TesteQA123!`
- `qa.passageiro.mkt+20260904@boleiacerta.test` / `TesteQA123!`
