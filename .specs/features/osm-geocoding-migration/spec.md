# OpenStreetMap (OSM) Geocoding & Autocomplete Migration Specification

## Problem Statement

Atualmente, o projeto **Boleia Certa** utiliza a API do Google Maps para serviços de geocoding e autocomplete de endereços ([GoogleMapsService.js](file:///c:/boleia-certa/src/services/GoogleMapsService.js)). A API do Google Maps requer cartões de crédito configurados, chaves de API pagas e gera 2 chamadas por consulta de autocomplete. Para manter a premissa de **hospedagem e stack 100% gratuita** do MVP em Luanda, Angola, é necessário migrar toda a camada de geocodificação para **OpenStreetMap (OSM)** através da API Photon (Komoot) e Nominatim.

## Goals

- [ ] Substituir o `GoogleMapsService.js` por um `LocationService.js` genérico baseado em OpenStreetMap (Photon/Nominatim).
- [ ] Garantir enviesamento regional e busca focada em **Luanda, Angola** (`countrycodes=AO`).
- [ ] Eliminar 100% das chamadas externas à API paga do Google Maps e a dependência da chave `VITE_GOOGLE_MAPS_API_KEY`.
- [ ] Manter 100% de compatibilidade com os componentes de UI existentes ([AddressInput.jsx](file:///c:/boleia-certa/src/components/AddressInput.jsx) e [SearchAddressInput.jsx](file:///c:/boleia-certa/src/components/SearchAddressInput.jsx)).
- [ ] Manter cobertura de testes unitários a 100% através do Método Akita (TDD Obrigatório).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Renderização visual de mapas | O projeto já utiliza `maplibre-gl` em [PassengerDashboard.jsx](file:///c:/boleia-certa/src/pages/PassengerDashboard.jsx), que já é compatível com OpenStreetMap. |
| Cálculo de rotas e direções (Routing Engine) | Fora do escopo da tarefa atual; o foco é estritamente Geocoding/Autocomplete de endereços. |

---

## User Stories

### P1: Autocomplete de Endereços com OpenStreetMap ⭐ MVP

**User Story**: Como utilizador (Passageiro ou Motorista), quero pesquisar locais e endereços em Luanda e receber sugestões instantâneas do OpenStreetMap para que possa definir os meus pontos de partida e chegada sem custos de API.

**Why P1**: Requisito essencial para publicar e pesquisar boleias.

**Acceptance Criteria**:

1. WHEN o utilizador introduz pelo menos 3 caracteres no campo de pesquisa THEN o sistema SHALL consultar a API Photon/OSM filtrada para Angola (`countrycode=ao`).
2. WHEN o sistema recebe as sugestões do Photon THEN o sistema SHALL formatar cada item contendo `place_id`, `description`, `lat` e `lng`.
3. WHEN a consulta falhar por perda de conexão THEN o sistema SHALL exibir uma mensagem de erro amigável e não quebrar a interface.

**Independent Test**: Pode ser verificado abrindo o componente [AddressInput.jsx](file:///c:/boleia-certa/src/components/AddressInput.jsx), digitando "Talatona" e verificando as sugestões retornadas da API Photon.

---

### P1: Resolução Directa de Coordenadas (Geocoding Instantâneo) ⭐ MVP

**User Story**: Como utilizador, ao selecionar uma sugestão da lista, quero que as coordenadas (latitude e longitude) sejam associadas ao meu trajeto sem necessidade de fazer uma segunda requisição paga.

**Why P1**: As coordenadas são necessárias para salvar a rota na tabela `routes` do Supabase.

**Acceptance Criteria**:

1. WHEN o utilizador clica numa sugestão THEN o sistema SHALL retornar imediatamente os valores de `{ lat, lng }` contidos no resultado.
2. WHEN o método `getPlaceDetails(placeId)` for chamado THEN o sistema SHALL resolver as coordenadas instantaneamente a partir do cache local ou consulta Nominatim fallback.

**Independent Test**: Selecionar "Luanda" na lista e confirmar que a função `onSelectCoordinates` recebe `{ lat: number, lng: number }`.

---

### P2: Atualização de Marca na Interface e Limpeza de Variáveis de Ambiente

**User Story**: Como programador/manutentor do projeto, quero que a interface indique "Powered by OpenStreetMap" e que o projeto não dependa de chaves de API do Google.

**Why P2**: Alinhamento com licenças OpenSource e segurança/limpeza de código.

**Acceptance Criteria**:

1. WHEN a lista dropdown de autocomplete é renderizada THEN o rodapé SHALL exibir "Powered by OpenStreetMap".
2. WHEN a aplicação é iniciada THEN o sistema SHALL funcionar normalmente sem exigir `VITE_GOOGLE_MAPS_API_KEY`.

---

## Edge Cases

- WHEN o utilizador digita um local inexistente THEN o sistema SHALL retornar um array vazio `[]` sem emitir erros no console.
- WHEN a API do Photon estiver indisponível THEN o sistema SHALL utilizar um fallback elegante ou tratar o erro suavemente.
- WHEN o input tiver menos de 3 caracteres THEN o sistema SHALL limpar as sugestões e não disparar requisições de rede.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| GEO-01 | P1: Autocomplete de Endereços OSM | Specify | Pending |
| GEO-02 | P1: Resolução Direta de Coordenadas | Specify | Pending |
| GEO-03 | P2: Rodapé "Powered by OpenStreetMap" | Specify | Pending |
| GEO-04 | P2: Remoção de VITE_GOOGLE_MAPS_API_KEY | Specify | Pending |
| GEO-05 | Refatoração de Testes (TDD Akita) | Specify | Pending |

---

## Success Criteria

- [ ] 100% dos testes no Vitest passam (`npm run test`).
- [ ] Nenhuma referência a `google.maps` ativada em produção.
- [ ] Pesquisa de locais operacional para endereços de Luanda (ex: "Mutamba", "Talatona", "Kilmamba").
- [ ] Documentação [AGENTS.md](file:///c:/boleia-certa/AGENTS.md) e `CONTEXT.md` atualizadas.
