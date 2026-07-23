# OpenStreetMap (OSM) Geocoding Migration Tasks

**Design**: `.specs/features/osm-geocoding-migration/design.md`  
**Status**: Ready for Orchestrator Execution  

---

## Execution Plan

### Phase 1: Test-Driven Foundation (Sequential TDD Red Phase)
Tasks that define the failing tests for `LocationService`.

```
T1 (Red Test) ──→ T2 (Implementation Green)
```

### Phase 2: Integration & Hook Refactoring (Sequential)
Updating the hook and component UI.

```
T2 ──→ T3 (useAutocomplete) ──→ T4 (AutocompleteDropdown UI & Test)
```

### Phase 3: Page Test Updates & Cleanup (Parallel OK)
Cleaning up Google Maps references, updating page mocks, and updating project context documentation.

```
      ┌──→ T5 (Page Mocks & Obsolete Files Removal)
T4 ───┼──→ T6 (Environment Variable Cleanup)
      └──→ T7 (Context & Documentation Update - Rule 9)
```

---

## Task Breakdown

### T1: Criar Teste Unitário Red de `LocationService.test.js`

**What**: Escrever o arquivo de testes unitários para a nova abstração de geolocalização `LocationService`.  
**Where**: `src/services/LocationService.test.js`  
**Depends on**: None  
**Requirement**: GEO-01, GEO-02, GEO-05  

**Done when**:
- [ ] Testes cobrem retorno vazio se `input` for < 3 caracteres.
- [ ] Testes cobrem mapeamento bem sucedido da API Photon para o formato `{ place_id, description, lat, lng }`.
- [ ] Testes cobrem falhas de rede e erro 500 da API.
- [ ] Comando `npx vitest run src/services/LocationService.test.js` é executado e falha (Fase Red do TDD).

**Verify**:
```bash
npx vitest run src/services/LocationService.test.js
```
*(Esperado: Falha por arquivo de implementação não existir ainda)*

---

### T2: Criar a Implementação de `LocationService.js` (TDD Green Phase)

**What**: Implementar as funções `getPlacePredictions` e `getPlaceDetails` consumindo a API Photon (OpenStreetMap).  
**Where**: `src/services/LocationService.js`  
**Depends on**: T1  
**Requirement**: GEO-01, GEO-02  

**Done when**:
- [ ] `getPlacePredictions(input)` realiza requisição a `https://photon.komoot.io/api/?q={query}&countrycode=ao&limit=5`.
- [ ] Mapeia o GeoJSON para `{ place_id, description, lat, lng }`.
- [ ] `getPlaceDetails(placeId, cachedSuggestions)` resolve as coordenadas instantaneamente.
- [ ] O teste `LocationService.test.js` passa a VERDE (Pass).

**Verify**:
```bash
npx vitest run src/services/LocationService.test.js
```
*(Esperado: 100% verde)*

---

### T3: Refatorar Hook `useAutocomplete.js`

**What**: Atualizar o hook para utilizar `LocationService.js` em substituição ao `GoogleMapsService.js`.  
**Where**: `src/hooks/useAutocomplete.js`  
**Depends on**: T2  
**Requirement**: GEO-01, GEO-02  

**Done when**:
- [ ] Remove a chamada a `loadGoogleMapsScript` e `window.google.maps.places.AutocompleteSessionToken`.
- [ ] Chama `getPlacePredictions` e `getPlaceDetails` diretamente de `LocationService.js`.
- [ ] Não gera erros de exceção ao buscar sugestões.

**Verify**:
```bash
npx vitest run src/hooks/useAutocomplete.test.js (ou suite geral de vitest)
```

---

### T4: Atualizar Componente `AutocompleteDropdown.jsx` e Seu Teste

**What**: Alterar a marca do rodapé no dropdown para "Powered by OpenStreetMap" e atualizar as asserções de teste.  
**Where**: `src/components/AutocompleteDropdown.jsx` e `src/components/AutocompleteDropdown.test.jsx`  
**Depends on**: T3  
**Requirement**: GEO-03  

**Done when**:
- [ ] O rodapé de `AutocompleteDropdown.jsx` exibe "Powered by OpenStreetMap".
- [ ] `AutocompleteDropdown.test.jsx` verifica a presença de "Powered by OpenStreetMap" em vez de "Powered by Google".
- [ ] O teste de `AutocompleteDropdown.test.jsx` passa 100% a verde.

**Verify**:
```bash
npx vitest run src/components/AutocompleteDropdown.test.jsx
```

---

### T5: Atualizar Mocks em Testes de Página e Eliminar Código Morto [P]

**What**: Atualizar os mocks de `GoogleMapsService` para `LocationService` em `PublishRoute.test.jsx` e `PassengerDashboard.test.jsx`, e remover `GoogleMapsService.js` e `GoogleMapsService.test.js`.  
**Where**: 
- `src/pages/PublishRoute.test.jsx`
- `src/pages/PassengerDashboard.test.jsx`
- Eliminar `src/services/GoogleMapsService.js` e `src/services/GoogleMapsService.test.js`  
**Depends on**: T4  
**Requirement**: GEO-05  

**Done when**:
- [ ] Mocks atualizados de `GoogleMapsService` para `LocationService`.
- [ ] `GoogleMapsService.js` e `GoogleMapsService.test.js` descontinuados e excluídos.
- [ ] Todos os testes das páginas passam sem erros de modulo ausente.

**Verify**:
```bash
npx vitest run
```

---

### T6: Limpeza de Variáveis de Ambiente [P]

**What**: Remover a chave de API obsoleta do Google Maps do arquivo local de ambiente.  
**Where**: `.env.local`  
**Depends on**: T4  
**Requirement**: GEO-04  

**Done when**:
- [ ] `VITE_GOOGLE_MAPS_API_KEY` removida de `.env.local`.

---

### T7: Manutenção de Contexto e Documentação (Regra 9 - AGENTS.md / CONTEXT.md) [P]

**What**: Atualizar a documentação do projeto e as diretrizes arquiteturais para refletir que a geocodificação agora utiliza OpenStreetMap.  
**Where**: `AGENTS.md` e `CONTEXT.md`  
**Depends on**: T5, T6  
**Requirement**: GEO-06  

**Done when**:
- [ ] Seção 6 de `AGENTS.md` reflete OpenStreetMap / Photon API como a fonte de verdade para Geocoding.
- [ ] O relatório de arquitetura em `AGENTS.md` / `CONTEXT.md` é devidamente atualizado (Regra 9).

---

## Final Verification & Git Commit

Após a conclusão de todas as tarefas T1 até T7:
```bash
npm run test
git add .
git commit -m "feat(geo): migrate geocoding & autocomplete from Google Maps to OpenStreetMap (Photon)"
```
