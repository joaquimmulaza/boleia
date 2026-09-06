# PACOTE ENG #12 — Solicitar entrada → owner aceita/rejeita

## Objetivo
Passageiro pede entrada num grupo público; owner decide; sem auto-aprovação.

## Critérios
1. `pedirEntradaGrupo` → `estado: pendente` (não sync N_actual)
2. Owner `aprovarEntrada` / `rejeitarEntrada`
3. Self-insert `activo` bloqueado (RLS + serviço); `addMembroGrupo` só owner
4. CTAs «Pedir entrada» / Aceitar / Recusar só com auth
5. Propostas/acordos: snapshots imutáveis (sync não muta propostas)
6. Sem OD inventada na descoberta

## Diff mínimo
- `GrupoService.addMembroGrupo` → `assertOwnerDoGrupo`
- `GrupoDescobertaPanel` → guard auth + OD real
- `PacoteEng12Acceptance.test.js`
