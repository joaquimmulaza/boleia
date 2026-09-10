# PACOTE #24 — Motorista: feed procuras + grupos + enviar proposta

## Objetivo
Motorista (incl. oferta flexível) vê procuras/grupos compatíveis no hub `/motorista` e envia proposta (sentido B). Passageiro/grupo aceita — não inverter.

## Acceptance
- ENG-24-1: Feed match por oferta via `findCompatibleProcuras`; flexível **sem** OD na oferta
- ENG-24-2: CTA «Enviar proposta» → `createProposta`; aceite só contraparte (`propostaInbox`)
- ENG-24-3: Grupo incompleto negociável; snapshot `n_passageiros_propostos` = `n_candidato` + `grupo_id`
- ENG-24-4: Hub motorista em rota protegida; `createProposta` exige auth
- ENG-24-5: Sem wa.me no path crítico do feed motorista

## Diff mínimo (reutiliza existente)
- `MatchingService.findCompatibleProcuras` — matching dual fixa/flex (ENG#1)
- `DriverDashboard` — **tab «Procuras e grupos»** sempre visível + feed in-app + `handleProporB` (ENG#2/#3)
- `PropostaService.createProposta`, `GrupoService.getGrupoByProcura`
- Testes: `PacoteEng24Acceptance.test.js` + extensão `DriverDashboard.test.jsx`
- **Sem migração**

## Follow-up Critiquito (PR #114)
- Tab/secção «Procuras e grupos» no hub — não escondida atrás de só «Publicar»
- Empty state sem oferta: copy «precisa oferta activa»
- Feed + «Enviar proposta» in-app na tab com oferta activa

## Verificação

```bash
npm run test:run -- src/services/PacoteEng24Acceptance.test.js src/pages/DriverDashboard.test.jsx src/services/MatchingService.test.js
```
