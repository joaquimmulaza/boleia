# Auditoria de Produto — Boleia Certa vs Visão Oferta↔Procura

**Data:** 2026-09-06  
**Âmbito:** cruzamento de `Boleia_Certa_Visao_e_Fluxo_de_Produto.md` (§27, 20 invariantes + §22 renegociação/rescisão) com código em `src/`, migrações locais e **estado live** do projecto Supabase `boleia` (`fdclrbcgytnuqcrpsevw`).  
**Método:** leitura de serviços/páginas/utils/testes + inspecção SQL remota (`pg_proc`, `pg_policies`, constraints, triggers). **Sem alterações de código.**  
**Princípio:** TDD-first — gaps documentados com o teste a escrever antes de qualquer fix.

---

## 0. Resumo executivo

O núcleo do marketplace **Oferta ↔ Procura ↔ Proposta ↔ Acordo 1:N** está **largamente alinhado** com as 20 invariantes: quatro N, preço congelado, aceite atómico com capacidade, propostas bidireccionais, motorista flexível sem OD/residência, e regras críticas de aceite/rejeição/saída protegidas por RPC `SECURITY DEFINER` (não só UI).

Os maiores desvios face à visão completa são:

| Área | Estado |
|------|--------|
| Aceite / Ns / preço / leave / matching flex | **Implementado** (com nuances) |
| Contraparte em propostas (accept/reject) | **Implementado na RPC** |
| Grupo cresceu > N_proposto | **Parcial** — UI avisa; RPC corta silenciosamente os primeiros N |
| Telefone vs fluxo plataforma | **Parcial** — descoberta existe; telefone ainda é caminho de convite |
| Renegociação bilateral (§22) | **Parcial / em falta** — só motorista propõe; só `pendente_passageiro`\|`aceite`; sem rejeitar/contrapropor |
| Rescisão contratual (`terminate_agreement`) | **Não implementado** |
| Hardening RLS em `ofertas_capacidade` / `membros_grupo` INSERT | **Gaps de bypass** |
| Testes G13–G15 (visão §5) e testes de integração Postgres reais | **Em falta** |

**Score bruto (20 invariantes §27):** ~14 FULLY · ~5 PARTIALLY · ~1 NOT (se contar só §27; a §22 acrescenta NOT adicionais fora da tabela dos 20).

---

## 1. Matriz de conformidade — 20 invariantes

Legenda: **FULLY** · **PARTIALLY** · **NOT** · **CONFLICTING/BUG**

| # | Invariante | Status | Evidência (ficheiros / BD) | Notas |
|---|------------|--------|----------------------------|-------|
| 1 | Grupo é procura colectiva viva | **FULLY** | `grupos` + `procuras.n_candidato`; `GrupoService.createGrupo` / `syncNCandidato`; UI `GrupoProcuraPanel` | Grupo ligado a procura; `n_candidato` = N_actual |
| 2 | Grupo incompleto pode negociar | **FULLY** | `createProposta` com `n_passageiros_propostos` = membros actuais (`PassengerDashboard` / `DriverDashboard`); testes hub | Não exige `n_actual == n_maximo` |
| 3 | Grupo pode continuar a crescer | **FULLY** | `solicitarEntrada` / `aprovarEntrada` / `addMembroGrupo` + `assertTemVaga` vs `n_maximo` | Crescimento até `n_maximo` |
| 4 | Mudança de N_actual **não** muta proposta antiga | **FULLY** | `GrupoService.syncNCandidato` actualiza só `procuras.n_candidato`; **sem** UPDATE a `propostas.n_passageiros_propostos`; RLS: `propostas` **sem** policy UPDATE | Snapshot imutável no cliente autenticado |
| 5 | N_proposto é snapshot | **FULLY** | Coluna `propostas.n_passageiros_propostos`; `accept_proposal` usa `v_n := v_prop.n_passageiros_propostos` (`20260906010000_rpc_idempotency_wave4.sql` L91–92) | Nome BD ≠ jargon UI (`n_passageiros_propostos`) |
| 6 | N_contrato congelado no aceite | **FULLY** | INSERT `acordos.n_passageiros_contrato = v_n` na mesma RPC | Congelado no cabeçalho |
| 7 | N_activos = estado actual (não reescreve N_contrato) | **FULLY** | `leave_passenger` marca `saiu`; comentário SQL «Não mutar preços / n_passageiros_contrato»; `AgreementsE2E.test.jsx` | Contagem implícita via `acordos_passageiros.estado` |
| 8 | Capacidade = vagas_totais − activos | **FULLY** | `accept_proposal` L84–91; `leave_passenger` reconta e actualiza `vagas_disponiveis` | Fórmula alinhada à visão |
| 9 | Sem acordo parcial se N > capacidade | **FULLY** | `IF v_n > v_disponiveis THEN RAISE … Use lista de espera`; G3/G10 em `MarketplaceAuditScenarios.test.jsx` | Atómico; fallback waitlist **fora** do aceite (enqueue separado) |
| 10 | TOTAL_ACORDO ÷ N_proposto/N_contrato (nunca capacidade) | **FULLY** | `resolveAgreementPricing.js`; RPC aceita com `v_total / v_n`; `propostaReview` usa N da proposta | **Nuance:** adenda MVP divide por **N_activos** (ver §2.3) |
| 11 | Saída não recalcula quotas restantes | **FULLY** | `leave_passenger` BD + serviço; E2E T25 | Confirmado no corpo live da RPC |
| 12 | Flexível não limitado pela residência | **FULLY** | `matchingFilters.evaluateMatch`: flex salta geo; teste «ignora OD/residência» em `matchingFilters.test.js` | Sem filtro por morada de `perfis` |
| 13 | Flexível sem rota fixa no marketplace | **FULLY** | `OfertaService.resolveOdFields` (OD null se flex); `PublishRoute`; `MatchingService.findCompatible*` | Visível e matchável |
| 14 | Fixa usa OD no matching | **FULLY** | `evaluateMatch` exige OD completo + haversine 2500 m | — |
| 15 | Flexível não depende de OD fixo | **FULLY** | Mesmo ramo `isFlex` em filtros + MatchingService | — |
| 16 | Passageiro e motorista podem iniciar propostas | **FULLY** | `PropostaService.createProposta` sentido A/B; hubs `PassengerDashboard` + `DriverDashboard` (+ testes flex B) | RLS INSERT: criador ∈ {driver, owner procura} |
| 17 | Só a contraparte aceita/rejeita | **FULLY** | `accept_proposal` / `reject_proposal`: `IF v_uid = created_by THEN RAISE`; `propostaInbox.js` filtra UI | Camadas UI + serviço + RPC |
| 18 | Criador não aceita a própria | **FULLY** | Idem L69–72 wave4 + `reject_proposal` | Segurança **não** só UI |
| 19 | Telefone não substitui fluxo plataforma | **PARTIALLY** | Descoberta: `listGruposAbertos` / `GrupoDescobertaPanel` / pedido `pendente`; **ainda** `findPassageiroByTelefone` + «Ou convidar por telefone» em `GrupoProcuraPanel` | Telefone = fallback UI; risco de parecer caminho principal |
| 20 | Regras críticas também no backend | **PARTIALLY** | Aceite/preço/leave/contraparte em RPC; `acordos*` só SELECT client. **Gaps:** `ofertas_update_proprio` sem restrição de colunas; INSERT `membros_grupo` sem forçar `pendente`; adenda/rescisão incompletas vs §22 | Ver §2 |

### Mapeamento «quatro N» (auditoria pedida)

| Conceito visão | Artefacto BD / código | Congelado? |
|----------------|----------------------|------------|
| N_actual | `procuras.n_candidato` (+ count `membros_grupo` activos) | Não |
| N_proposto | `propostas.n_passageiros_propostos` | Sim (sem UPDATE RLS) |
| N_contrato | `acordos.n_passageiros_contrato` | Sim no aceite; leave não altera |
| N_activos | COUNT `acordos_passageiros` WHERE `activo` | Dinâmico |

### Cenário grupo maior / menor que proposta (visão §18–20)

| Cenário | Comportamento actual | Status |
|---------|---------------------|--------|
| N_actual < N_proposto no aceite | RPC: `IF i <> v_n THEN RAISE` (G2) | **FULLY** |
| N_actual > N_proposto | RPC: `LIMIT v_n` por `ordem_insercao` — escolha **implícita**; UI `avisoComposicao` explica | **PARTIALLY** — falta confirmação explícita de composição / escolha de membros |
| Crescimento pós-proposta | `syncNCandidato` não toca propostas | **FULLY** |

---

## 2. Análise Supabase — segurança e gaps

### 2.1 RPCs presentes (live)

| RPC | Existe | Papel |
|-----|--------|-------|
| `accept_proposal(uuid, uuid?)` | Sim | Aceite atómico + capacidade + contraparte + congelamento |
| `reject_proposal(uuid)` | Sim | Contraparte; sem idempotency_key |
| `cancel_proposal(uuid, uuid?)` | Sim | Só criador |
| `leave_passenger(...)` | Sim | Saída sem recálculo + promote best-effort |
| `promote_waitlist` | Sim | FIFO → `notificada` (sem auto-aceitar) |
| `renegotiate_agreement_pricing` | Sim | **Só motorista**; estado `pendente_passageiro` |
| `accept_agreement_adenda` | Sim | Passageiro activo; não aplica antes de `effective_from` |
| `apply_due_agreement_adendas` | Sim | Lazy apply |
| `leave_grupo_membro` | Sim | Saída de grupo |
| `propose_agreement_adenda` / `respond_agreement_adenda` / `terminate_agreement` | **Não** | Visão §22 |

### 2.2 RLS — resumo

| Tabela | RLS | Policies client | Risco |
|--------|-----|-----------------|-------|
| `propostas` | ON | INSERT + SELECT only | Bom — mutações via RPC |
| `acordos` / `acordos_passageiros` / `acordos_adendas` | ON | **SELECT only** | Bom — sem UPDATE/INSERT directo |
| `lista_espera` | ON | INSERT (owner procura) + SELECT + DELETE; **sem UPDATE** | Promote só via RPC |
| `ofertas_capacidade` | ON | CRUD próprio motorista | **Gap:** UPDATE pode alterar `vagas_disponiveis` / `vagas_totais` / preço sem passar pela RPC de capacidade |
| `procuras` | ON | CRUD próprio | Aceitável para campos de procura; `n_candidato` mutável pelo owner (esperado via sync) |
| `membros_grupo` | ON | INSERT self/owner **sem** check de `estado`; UPDATE owner livre; self só → `pendente` | **Gap:** cliente autenticado pode `INSERT` com `estado='activo'` e saltar aprovação |
| `rpc_idempotency` | ON | (interno) | Wave 3/4 |

`FORCE ROW LEVEL SECURITY` = **não** activado nas tabelas críticas (aceitável se roles `authenticated`/`anon` não forem owners das tabelas; confirmar em reviews futuros).

### 2.3 Adenda actual vs visão §22

| Visão | Implementação actual | Gap |
|-------|---------------------|-----|
| Estados: `PENDENTE_CONTRAPARTE`, `REJEITADA`, `CANCELADA_*`, `ACEITE_AGENDADA`, `EM_VIGOR` | CHECK só `pendente_passageiro` \| `aceite` + flags `applied_at` / `superseded_at` | Modelo reduzido |
| Qualquer parte propõe | Só `driver_id` em `renegotiate_agreement_pricing` | Passageiro **não** inicia |
| Contraparte rejeita / contrapropõe | Só aceitar; sem RPC reject | Impasse sem caminho de produto |
| `terminate_agreement` (amigável / aviso / justa causa) | Inexistente | Só `leave_passenger` (sai um pax) |
| Divisor preço | Adenda usa **N_activos** (deve == `p_n_passageiros`) | MVP anti-fantasmas; diverge de «sempre N_contrato» se already left |

Vigência «próximo mês» (`effective_from` via `Africa/Luanda`) e não-aplicação imediata no aceite da adenda: **alinhado** com o espírito da visão (testes G7 / AgreementsE2E).

### 2.4 Outros achados BD

- **Faltas:** trigger `handle_falta_desconto` usa `quota / dias_uteis_mes` (e /2 se só ida ou regresso) — **já sem `/4`**. O «próximo» em `AGENTS.md` sobre alinhar `/4` parece **obsoleto** face ao remoto actual.
- **Waitlist no overbooking do aceite:** a RPC **falha**; não enfileira automaticamente. Enfileirar é acção explícita (`enqueueWaitlist`) — coerente com «sem auto-aceitar», ligeiramente diferente da frase «entra no mecanismo de waitlist» na §16 (é opt-in, não fallback automático do accept).

### 2.5 Bypass vulnerabilidades (prioridade)

1. **P0 — `ofertas_capacidade` UPDATE pelo motorista:** pode inflacionar `vagas_disponiveis` e contornar a guarda de capacidade da RPC (race + fraude). Aceite ainda reconta a partir de `acordos_passageiros`, o que **mitiga** overbooking real no accept; mas o matching client-side (`vagas_disponiveis` na linha da oferta) pode mostrar «direct» indevido.
2. **P1 — `membros_grupo` INSERT self com `activo`:** contorna pedido de entrada / aprovação do owner.
3. **P2 — Adenda só motorista + sem rejeição:** assimetria vs invariante de consentimento bilateral da visão §22 (não está nos 20, mas é produto).

---

## 3. Matriz de cobertura de testes

### 3.1 O que já cobre bem

| Fluxo | Suite | Tipo |
|-------|-------|------|
| Cascata irmãs, N_actual < N, overbooking, leave, waitlist promote, copy adenda, router, smoke RLS serviços, jargon UI | `MarketplaceAuditScenarios.test.jsx` G1–G12 | Contrato cliente + mocks |
| TOTAL_ACORDO + resto; leave sem mutar cabeçalho; adenda não muta live | `AgreementsE2E.test.jsx` | Unit/serviço mock |
| Pricing puro | `resolveAgreementPricing.test.js` | Unit |
| Matching fixa/flex/dias | `MatchingService.test.js`, `matchingFilters.test.js` | Unit/integração mock |
| Proposta review + aviso composição | `propostaReview.test.js` | Unit |
| Hubs A/B + flex B | `PassengerDashboard.test.jsx`, `DriverDashboard.test.jsx` | UI |
| Offline idempotency wave4 | `offlineQueue.test.js`, etc. | Unit |
| Grupo telefone fallback / aprovar | `GrupoProcuraPanel.test.jsx` | UI |

### 3.2 Lacunas (produto × testes)

| Fluxo / regra | Cobertura actual | Lacuna |
|---------------|------------------|--------|
| Criador tenta `accept_proposal` / `reject_proposal` | Só documentado em comentários; mocks de sucesso | **Sem teste que espere RAISE «Só a contraparte…»** (ideal: integração Supabase ou SQL fixture) |
| Grupo cresce após proposta → N_proposto intacto | Implícito em sync + review | Falta teste de serviço dedicado «sync não UPDATE propostas» |
| Aceite com N_actual > N_proposto → primeiros N | UI aviso testado; RPC LIMIT não testada contra BD | Falta assert de quais `passenger_id` entram |
| Overbooking concorrente real (Postgres) | G10 só mock | Sem race test live |
| Bypass `ofertas.vagas_*` UPDATE | — | Sem teste de segurança |
| Bypass INSERT membro `activo` | — | Sem teste de segurança |
| Passageiro inicia adenda | — | Feature ausente → teste vermelho planeado |
| Rejeitar adenda / contraproposta | — | Feature ausente |
| `terminate_agreement` / `CANCELAMENTO_PENDENTE` | — | Feature ausente (G15 visão) |
| G13 / G14 visão §5 | Parcialmente coberto por E2E adenda | Nomes G13–G15 **não** na suite; reject adenda em falta |
| Waitlist como fallback automático do accept | — | Comportamento actual = raise; falta decisão de produto + teste |
| Matching não usa residência do motorista (campo perfil) | Flex ignora OD oferta | Sem teste explícito com `perfis` lat/lng |

---

## 4. Roadmap accionável (TDD primeiro)

Ordem sugerida: **segurança de domínio** → **fechar §18–20 composição** → **§22 renegociação/rescisão** → **UX telefone** → **dívida de testes de integração**.

### Task 0 — Spec rápida dos gaps (sem código de feature)

- **Gap:** divergência visão §22 / §20 vs MVP actual não está formalizada em `.specs/`.
- **Porquê:** agentes e PRs podem «completar» de forma inconsistente.
- **Teste primeiro:** N/A (artefacto spec). Critério: spec com IDs REQ para (a) composição explícita no aceite, (b) adenda bilateral, (c) rescisão, (d) RLS column grants.
- **Ficheiros:** `.specs/features/marketplace-vision-gaps/{spec,tasks}.md` (+ update `AGENTS.md` §6 quando fechar).

### Task 1 — Hardening RLS `ofertas_capacidade` (capacidade)

- **Gap:** motorista pode UPDATE `vagas_disponiveis` / `vagas_totais`.
- **Porquê:** matching enganoso; superfície de fraude.
- **Teste TDD primeiro:** teste de integração/SQL (ou Vitest + client autenticado de teste) — *«driver UPDATE vagas_disponiveis para 99 é rejeitado / coluna imutável; só RPC leave/accept altera»*.
- **Alvo BD:** policy UPDATE com `WITH CHECK` que preserve `vagas_*` **ou** trigger `BEFORE UPDATE` que recalcule/ignore client writes nessas colunas.  
- **Alvo código:** nenhum path client que escreva `vagas_*` excepto via RPC; smoke em `MarketplaceAuditScenarios` G11 alargado.

### Task 2 — Hardening INSERT `membros_grupo` (pedido de entrada)

- **Gap:** self-INSERT pode criar `estado='activo'`.
- **Porquê:** viola «solicitar → owner aprova»; auto-entrada.
- **Teste TDD primeiro:** *«passageiro INSERT membro com estado activo falha; só pendente permitido para self; activo só via owner/RPC»*.
- **Alvo BD:** `WITH CHECK` na policy INSERT (self ⇒ `estado = 'pendente'`) e/ou RPC `request_grupo_join`.  
- **Alvo:** `GrupoService.solicitarEntrada`, testes `GrupoService.test.js`.

### Task 3 — Contraparte: testes de segurança RPC (accept/reject)

- **Gap:** regra existe na BD; suite G1–G12 não falha se a cláusula `created_by` for removida.
- **Porquê:** regressão silenciosa de invariantes 17–18.
- **Teste TDD primeiro:** *«G16: utilizador = created_by chama accept_proposal → erro contraparte; reject_proposal idem; contraparte sucede»* (integração preferível; no mínimo contrato documentado + mock de erro tipado).
- **Alvo:** `MarketplaceAuditScenarios.test.jsx` (+ opcional script SQL em CI).

### Task 4 — Composição explícita quando N_actual > N_proposto

- **Gap:** RPC `LIMIT v_n` escolhe membros sem confirmação de produto.
- **Porquê:** visão §20 — nunca escolher silenciosamente.
- **Teste TDD primeiro:** *«aceite com 4 activos e N_proposto=2: ou falha pedindo nova proposta, ou exige lista explícita de passenger_ids; nunca surpresa»*.
- **Alvo BD:** alterar `accept_proposal` (rejeitar se count ≠ N **ou** aceitar `p_member_ids uuid[]`).  
- **Alvo UI:** `PropostaReviewCard` / hubs — CTA «nova proposta N=actual» vs confirmar subset.  
- **Alvo testes:** `propostaReview` + audit G2-bis.

### Task 5 — Snapshot N_proposto: teste de não-mutação no sync

- **Gap:** comportamento correcto, teste frágil/implícito.
- **Porquê:** regressão se alguém «sincronizar propostas» no sync.
- **Teste TDD primeiro:** *«após addMembro + syncNCandidato, propostas abertas mantêm n_passageiros_propostos original»*.
- **Alvo:** `GrupoService.test.js` (+ spy em `propostas` update nunca chamado).

### Task 6 — Adenda: rejeição pela contraparte (mínimo §22)

- **Gap:** sem estado `REJEITADA` / RPC reject.
- **Porquê:** impasse; motorista não tem feedback estruturado.
- **Teste TDD primeiro (G14 visão):** *«após reject, estado=rejeitada (ou superseded), acordo mantém preço; sem apply»*.
- **Alvo BD:** alargar CHECK `acordos_adendas.estado`; RPC `reject_agreement_adenda`.  
- **Alvo:** `AgreementService`, `MyAgreements` CTA.

### Task 7 — Adenda bilateral (passageiro também propõe)

- **Gap:** só motorista chama `renegotiate_agreement_pricing`.
- **Porquê:** visão: consentimento e iniciativa simétricos.
- **Teste TDD primeiro:** *«passageiro activo propõe adenda → estado pendente_contraparte (motorista); motorista não pode accept da própria; motorista aceita/rejeita»*.
- **Alvo BD:** generalizar iniciador/contraparte (como no DDL da visão) ou nova RPC `propose_agreement_adenda`.  
- **Alvo UI:** `MyAgreements` para ambos os papéis.

### Task 8 — Rescisão (`terminate_agreement`) — aviso prévio

- **Gap:** feature ausente; só leave imediato de um passageiro.
- **Porquê:** visão §3 modalidades A/B/C; previsibilidade mensal.
- **Teste TDD primeiro (G15):** *«cancelamento sem justa causa → CANCELAMENTO_PENDENTE até fim do mês; vaga ocupada; dia 1 → CANCELADO»*.
- **Alvo BD:** estados em `acordos` + RPC + job/lazy apply.  
- **Alvo:** `AgreementService`, `MyAgreements`, notificações.

### Task 9 — Telefone como complementar (invariante 19)

- **Gap:** UI ainda destaca convite por telefone.
- **Porquê:** risco de telefone parecer fluxo principal.
- **Teste TDD primeiro:** *«fluxo principal de adicionar = descoberta/pedido; telefone só secção colapsada / copy «opcional»; sem telefone obrigatório para acordo»*.
- **Alvo:** `GrupoProcuraPanel`, copy; manter `ProfileService` como auxiliar.

### Task 10 — Integração Postgres opcional (CI)

- **Gap:** G3/G10/capacidade/contraparte só mocks.
- **Porquê:** XP — confiança real nas invariantes 8–9, 17–18.
- **Teste TDD primeiro:** harness mínimo (service role + 2 JWTs) para accept concorrente e contraparte.
- **Alvo:** `*.integration.test.js` + secrets CI (fora do MVP se custo alto — explicitamente deferred).

---

## 5. Intersecção visão × «o que ainda falta» (fora da matriz dos 20)

Funcionalidades da visão **ainda em falta ou incompletas** para o fluxo completo:

1. **Máquina de estados de adenda** completa (rejeitar, cancelar iniciador, contraproposta, `EM_VIGOR` explícito).  
2. **Rescisão bilateral / unilateral com aviso / justa causa.**  
3. **Composição explícita** no aceite quando o grupo cresceu.  
4. **Waitlist como destino automático** do accept com capacidade insuficiente (hoje: erro + enqueue manual).  
5. **Hardening RLS** (ofertas vagas, membros INSERT).  
6. **Testes G13–G15** e provas de segurança contraparte/capacidade em BD.  
7. **Copy/UX:** telefone claramente auxiliar; estados de proposta/adenda todos distintos na UI (maioria já existe para propostas; adenda rejeitada não).

O que **já fecha** o fluxo MVP feliz (criar procura/grupo → match fixa/flex → proposta A/B → aceite atómico → acordo 1:N → leave sem recalcular → waitlist promote sem auto-aceitar → adenda motorista→passageiro para o mês seguinte) está implementado e coberto por G1–G12 + E2E pricing/leave.

---

## 6. Causas possíveis dos gaps (sem «fix cego»)

| Sintoma | Causas possíveis (hipóteses) |
|---------|------------------------------|
| Visão §22 ≠ código | MVP deliberado (R3 consentimento passageiro) entregue antes da máquina completa; DDL da visão é target, não estado actual |
| LIMIT primeiros N | Atalho de engenharia no `accept_proposal` alinhado à ordem de inserção; UI avisou depois (`avisoComposicao`) sem mudar RPC |
| Telefone ainda visível | Path legado de convite; descoberta pública chegou depois (T31) |
| UPDATE ofertas livre | RLS genérica «próprio driver» sem column privilege / trigger de invariante |
| Testes só mock | Custo de multi-user JWT em Vitest; auditoria alpha privilegiou contrato de serviço |

---

## 7. Critério de «feito» (visão §29)

Uma invariante só fecha quando for verdadeira em:

> **Produto → Spec → BD/RPC/RLS → Serviços → UI → Testes**

Estado actual aproximado:

| Camada | Mercado core (1–18, parcial 19–20) | §22 renegociação plena | Rescisão |
|--------|-----------------------------------|------------------------|----------|
| Produto/visão | Definido | Definido | Definido |
| Spec `.specs` | Wave 4 / marketplace parcial | Em falta para máquina plena | Em falta |
| BD/RPC/RLS | Forte no aceite/leave | Parcial | Ausente |
| Serviços/UI | Forte | Parcial (só motorista→pax accept) | Ausente |
| Testes | G1–G12 + E2E | Parcial (sem G14 reject) | Ausente |

---

## 8. Decisão pedida ao produto (antes de Task 4 / 6–8)

1. Quando `N_actual > N_proposto`: **rejeitar aceite** até nova proposta, ou **permitir subset** com lista explícita de IDs?  
2. Accept com vagas insuficientes: **só erro**, ou **auto-enqueue waitlist**?  
3. Adenda: priorizar **reject** (Task 6) ou **iniciativa do passageiro** (Task 7) primeiro?  
4. Rescisão: MVP só **aviso prévio fim-do-mês**, ou incluir justa causa imediata já no primeiro slice?

---

*Fim do relatório. Nenhuma alteração funcional foi aplicada neste passo.*
