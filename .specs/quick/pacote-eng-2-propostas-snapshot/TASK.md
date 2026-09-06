# PACOTE ENG #2 — M propostas + snapshots imutáveis

## Objetivo
M propostas coexistentes; cada uma congela snapshot imutável (N_proposto, preço, modalidade); só a contraparte aceita/rejeita; iniciador ≠ aceitante. Crescimento do grupo → nova versão de proposta, não reescreve antigas. Grupo incompleto continua negociável.

**Fora de scope:** aceite atómico → acordo 1:N (ENG#3).

## Estado auditado (main pós ENG#1)

| Área | Ficheiro / migração | Estado |
|------|----------------------|--------|
| Schema M propostas | `propostas` (T6) | 1 procura : M rows; snapshot em `n_passageiros_propostos`, `modo_preco`, `valor_mensal_ask_kz` |
| Auto-aceite bloqueado | `accept_proposal` / `reject_proposal` (T32) | `created_by` ≠ aceitante |
| RLS sem UPDATE client | P0 hardening | `propostas_update_envolvidos` removida; mutações só RPC |
| Grupo vivo | `PassengerDashboard.resolverPropostaN`, `GrupoProcuraPanel` | N_actual < n_maximo não bloqueia |
| Sync N_actual | `GrupoService.syncNCandidato` | Actualiza `procuras.n_candidato`; **não** muta propostas |
| Inbox A/B | `propostaInbox.js`, hubs | Filtro `created_by !== userId` para contraparte |
| Preço na aceitação | `accept_proposal` SQL | Usa `v_prop.valor_mensal_ask_kz` / `modo_preco` |
| UI revisão | `propostaReview.js`, `PropostaReviewCard` | Preço derivado do snapshot da proposta |

## Diff mínimo desta entrega

1. **Guard UI:** `OfertaMatchCard` — CTAs só quando callback fornecido (auth gate no componente).
2. **Testes:** `PacoteEng2Acceptance.test.js` — 6 critérios de aceitação mapeados.
3. **Sem migração** — reutiliza schema/RPC/RLS existentes.

## Snapshots / versionamento

- **Snapshot:** cada INSERT em `propostas` congela `n_passageiros_propostos`, `modo_preco`, `valor_mensal_ask_kz` no instante da criação.
- **Versão nova:** crescimento do grupo → `syncNCandidato` actualiza `n_candidato`; utilizador cria **nova** proposta (novo row) com N_actual actual; propostas antigas intactas.
- **Imutabilidade:** P0 remove UPDATE RLS em `propostas`; cancel/aceite/rejeitar só via RPC SECURITY DEFINER.

## Verificação

```bash
npm run test:run -- src/services/PacoteEng2Acceptance.test.js \
  src/components/OfertaMatchCard.test.jsx \
  src/services/PropostaService.test.js src/services/GrupoService.test.js
```
