# Boleia Certa Project Memory & State

## Current Active Milestone
- **Active Feature**: OpenStreetMap Geocoding & Autocomplete Migration (`.specs/features/osm-geocoding-migration/`)
- **Status**: Specification & Design Complete, Ready for TDD Execution (Tasks T1 to T7 defined)

## Key Architecture Decisions (ADRs)
1. **Geocoding Provider**: Migrado de Google Maps Places API para OpenStreetMap via API Photon (Komoot) com filtro para Angola (`countrycode=ao`), garantindo custo zero e maior velocidade (coordenadas inclusas no autocompletar).
2. **Map Rendering**: `maplibre-gl` mantido como renderizador vetorial em [PassengerDashboard.jsx](file:///c:/boleia-certa/src/pages/PassengerDashboard.jsx).
3. **Database Schema**: A tabela `routes` do Supabase é a fonte de verdade contendo `origin_lat`, `origin_lng`, `destination_lat`, `destination_lng`.

## Active Blockers
- Nenhum.

## Next Steps for Orchestrator Agent
1. Executar a tarefa **T1** de `.specs/features/osm-geocoding-migration/tasks.md` (Escrever testes de `LocationService.test.js` e rodar Vitest para ver falhar).
2. Executar **T2** (Criar `LocationService.js` até passar no Vitest).
3. Executar **T3**, **T4**, **T5**, **T6**, **T7** sequencialmente respeitando o fluxo TDD / Método Akita.
