# PACOTE ENG #1 — Matching oferta flexível

## Objetivo
Oferta flexível entra no matching por horário/dias/capacidade **sem** OD obrigatório. UI/API **nunca** fabricam origem, destino nem zona de residência.

## Estado auditado (main)
| Área | Ficheiro | Estado |
|------|----------|--------|
| Classificação match | `matchingFilters.evaluateMatch` | Flex salta geo; fixa exige OD+dias |
| Serviço bidireccional | `MatchingService.findCompatible*` | Dual fixa/flex |
| Publicar oferta | `OfertaService.resolveOdFields`, `PublishRoute` | Flex grava OD null |
| Hub motorista | `DriverDashboard` | Lista procuras compatíveis; label sem OD fictício |
| Hub passageiro | `PassengerDashboard` | **Gap:** `dias_semana` não passava ao matching |
| Acordos | `MyAgreements` | **Gap:** placeholders «Origem»/«Destino» em oferta flex |
| Residência perfil | — | **Não usada** em matching (confirmado grep) |

## Diff mínimo desta entrega
1. `PassengerDashboard`: passar `dias_semana` em `findCompatibleOfertas`
2. `MyAgreements`: `labelRotaOferta` para ofertas flexíveis (sem fabricar OD)
3. `OfertaService.updateOferta`: guard — flex nunca persiste OD
4. Testes consolidados `FlexMatchingRegression.test.js` + asserts UI

## Sem migração
Reutiliza coluna existente `flexibilidade_rota` e lógica T34/T35.

## Verificação
```bash
npm run test:run -- src/services/FlexMatchingRegression.test.js \
  src/utils/matchingFilters.test.js src/services/MatchingService.test.js \
  src/pages/PassengerDashboard.test.jsx src/pages/MyAgreements.test.jsx
```
