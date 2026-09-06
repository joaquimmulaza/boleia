# Epic §22 — Ciclo de Vida Pós-Acordo — Especificação

**Estado:** Approved (Task 0 Done) · **Tamanho:** Large/Complex (tlc-spec-driven)
**Plano aprovado:** `.cursor/plans/§22_rescisão_adenda_4901d05c.plan.md.md`
**Design:** `design.md` · **Tasks:** `tasks.md`
**Domínio:** marketplace Oferta/Procura — `acordos` **1 motorista : N passageiros**

---

## Problem Statement

Depois de um acordo ficar activo, o Boleia Certa só sabe fazer duas coisas: o **motorista** propor uma adenda de preço, e um **passageiro** sair sozinho (`leave_passenger`). Não existe forma de o passageiro propor alteração de preço, nem de qualquer das partes **terminar o contrato** de forma estruturada (aviso prévio, consenso ou justa causa). Além disso, `ofertas_capacidade` aceita `UPDATE` livre do cliente sobre `vagas_disponiveis`, o que permite que o matching mostre capacidade falsa.

Resultado: renegociação assimétrica (só uma parte tem voz), rescisões feitas «por WhatsApp» sem rasto auditável, e risco de overbooking silencioso.

## Goals

- [ ] **Adenda bilateral** — motorista **e** passageiro activo podem propor alteração de preço; só a contraparte aceita/rejeita; divisor congelado em `n_passageiros_contrato`; efeito só no 1.º dia do mês seguinte (Africa/Luanda).
- [ ] **Rescisão estruturada** — RPC `terminate_agreement` com 3 modos (`aviso_previo`, `consensual`, `justa_causa`), com limpeza lazy `apply_due_agreement_terminations` no dia 1.
- [ ] **Hardening de capacidade** — trigger `BEFORE UPDATE` em `ofertas_capacidade` que recalcula `vagas_disponiveis` no servidor; `UPDATE` mentiroso do cliente não persiste.
- [ ] **Paridade offline** — as novas RPCs entram na fila IndexedDB com `p_idempotency_key`, como as Waves 3/4.
- [ ] **UI honesta** — CTAs bilaterais em `/acordos` + `TerminateAgreementModal` com copy PT-PT modeless e CTA destrutivo separado (Fitts).
- [ ] **Cobertura de auditoria** — cenários **G16**, **G17**, **G18** verdes em `MarketplaceAuditScenarios.test.jsx`.

## Out of Scope

| Item | Razão |
| ---- | ----- |
| UI de «editar preço da adenda alheia» (contraproposta inline) | Contraproposta = nova proposta que faz `superseded_at` da anterior; chega para o MVP |
| Tabelas de evidência (fotos de avaria, ocorrências de segurança) | Justa causa MVP é auditável em colunas do próprio acordo |
| pgTAP / suite de integração Postgres multi-JWT | Já deferred na spec `integration-tests`; TDD é Vitest + mock `supabase.rpc` |
| Rescisão parcial de 1 passageiro | Já coberta por `leave_passenger`; §22 rescinde o **acordo inteiro** |
| Redesign do mapa / matching | Task 4b só faz polish `FeedbackAlert role="status"` nos cards |
| Zonas, polígonos, raio residencial | Fora do MVP (decisão 2026-09-05) |
| Commit / push automático | Só a pedido explícito do utilizador |

---

## User Stories

### P1: Passageiro propõe nova mensalidade ⭐ MVP

**User Story**: Como **passageiro activo** de um acordo, quero propor um novo valor mensal ao motorista, para negociar sem sair do acordo nem passar por canais informais.

**Why P1**: hoje a renegociação é unilateral do motorista — o passageiro só tem a opção nuclear (sair). É o gap central do Epic.

**Acceptance Criteria**:

1. WHEN um passageiro com `acordos_passageiros.estado = 'activo'` chama a RPC de proposta de adenda THEN o sistema SHALL criar `acordos_adendas` com `estado = 'pendente_contraparte'` e `created_by = auth.uid()`.
2. WHEN o motorista (`acordos.driver_id`) chama a mesma RPC THEN o sistema SHALL criar a adenda com `estado = 'pendente_passageiro'`.
3. WHEN qualquer parte propõe THEN o sistema SHALL usar `n_passageiros_contrato` do acordo como divisor (nunca `N_activos`) e SHALL rejeitar `p_n_passageiros` divergente com mensagem em português.
4. WHEN a proposta é criada THEN `effective_from` SHALL ser o 1.º dia do mês seguinte em `Africa/Luanda`, e o cabeçalho do acordo e as quotas do mês corrente SHALL permanecer inalterados.
5. WHEN existe adenda pendente ou aceite não aplicada e chega nova proposta THEN o sistema SHALL marcar a anterior com `superseded_at = now()` (contraproposta = supersede).
6. WHEN quem chama não é `driver_id` nem passageiro activo THEN o sistema SHALL falhar com «Sem permissão para renegociar este acordo.».
7. WHEN o acordo não está `activo` (case-insensitive) THEN o sistema SHALL recusar a proposta.

**Independent Test**: mock `supabase.rpc`; chamar `proposeAgreementAdenda` como passageiro e assertar `pendente_contraparte`; como motorista e assertar `pendente_passageiro`.

---

### P1: Contraparte decide a adenda ⭐ MVP

**User Story**: Como **contraparte** de uma adenda pendente, quero aceitar ou rejeitar, para que a alteração só produza efeitos com consentimento das duas partes.

**Why P1**: sem aceitação bilateral, a proposta do passageiro seria decorativa.

**Acceptance Criteria**:

1. WHEN a adenda está `pendente_passageiro` THEN só um **passageiro activo** do acordo SHALL poder aceitar/rejeitar.
2. WHEN a adenda está `pendente_contraparte` THEN só o **`driver_id`** SHALL poder aceitar/rejeitar.
3. WHEN `auth.uid() = acordos_adendas.created_by` THEN o sistema SHALL recusar aceitar e rejeitar («Só a contraparte pode …»).
4. WHEN a adenda é aceite THEN o estado SHALL passar a `aceite` com `aceite_em` / `aceite_por` preenchidos, **sem** alterar preços antes de `effective_from`.
5. WHEN `effective_from <= hoje (Africa/Luanda)` e a adenda está `aceite` THEN `apply_due_agreement_adendas` SHALL aplicar o novo preço e marcar `em_vigor`.
6. WHEN a adenda é rejeitada THEN `estado` SHALL passar a `rejeitada`, o acordo SHALL manter preços e quotas, e o criador SHALL receber notificação.
7. WHEN a mesma `p_idempotency_key` é reenviada (fila offline) THEN a RPC SHALL devolver sucesso sem re-mutar.

**Independent Test**: mock RPC; `respondAgreementAdenda(id, false)` → acordo mantém `valor_mensal_por_passageiro_kz` (é o cenário **G17**).

---

### P1: Rescindir com aviso prévio ⭐ MVP

**User Story**: Como **motorista ou passageiro activo**, quero rescindir o acordo com aviso prévio, para sair no fim do mês sem prejudicar as boleias já pagas.

**Why P1**: é o modo por omissão e o mais frequente; define o contrato de estados que os outros modos reutilizam.

**Acceptance Criteria**:

1. WHEN `terminate_agreement(..., p_modo := 'aviso_previo')` é chamada por parte legítima THEN o acordo SHALL passar a `cancelamento_pendente`, com `rescisao_modo`, `rescisao_solicitada_por` e `rescisao_effective_on` = 1.º dia do mês seguinte (Africa/Luanda).
2. WHEN o acordo está `cancelamento_pendente` THEN membros e `vagas_disponiveis` da oferta SHALL manter-se ocupados até `rescisao_effective_on`.
3. WHEN `apply_due_agreement_terminations` corre com `rescisao_effective_on <= hoje` THEN o acordo SHALL passar a `cancelado` com `cancelado_em`, os `acordos_passageiros` activos SHALL passar a `saiu`, e `vagas_disponiveis` SHALL ser recontada.
4. WHEN o acordo já não está `activo` THEN nova chamada `aviso_previo` SHALL ser recusada (ou devolvida idempotente se for a mesma chave).
5. WHEN quem chama não é `driver_id` nem passageiro activo THEN o sistema SHALL recusar.

**Independent Test**: **G18** — aviso → `cancelamento_pendente` com vagas ocupadas; após apply do dia 1 → `cancelado` + vagas libertadas.

---

### P1: Rescisão consensual em dois passos ⭐ MVP

**User Story**: Como parte de um acordo, quero pedir fim imediato por consenso, para que o contrato só termine quando a outra parte confirmar.

**Why P1**: é o único caminho de fim imediato sem culpa; sem ele, quem quer sair já usa justa causa indevidamente.

**Acceptance Criteria**:

1. WHEN a 1.ª chamada `p_modo := 'consensual'` ocorre THEN o sistema SHALL registar o pedido (`rescisao_modo = 'consensual'`, `rescisao_solicitada_por = auth.uid()`) **sem** cancelar o acordo.
2. WHEN a 2.ª chamada `consensual` vem da **contraparte** (motorista ↔ qualquer passageiro activo) THEN o acordo SHALL passar a `cancelado` imediatamente, marcar passageiros `saiu` e libertar vagas atomicamente.
3. WHEN a 2.ª chamada vem do **mesmo utilizador** que pediu THEN o sistema SHALL manter o pedido pendente e não cancelar.
4. WHEN não há 2.ª confirmação THEN o acordo SHALL permanecer activo (não há efeito automático no dia 1).

**Independent Test**: mock RPC em dois passos com `auth.uid()` diferente → 2.º passo devolve estado `cancelado`.

---

### P1: Rescisão por justa causa ⭐ MVP

**User Story**: Como parte lesada, quero rescindir imediatamente por justa causa documentada, para não continuar a pagar/transportar numa relação inviável.

**Why P1**: caso de falha real (faltas em série, avaria, segurança) que hoje não tem saída formal.

**Acceptance Criteria**:

1. WHEN `p_modo := 'justa_causa'` THEN `p_justificativa` SHALL ser obrigatória e pertencer ao conjunto `faltas_excessivas` · `avaria_veiculo` · `seguranca`.
2. WHEN a justificativa é `faltas_excessivas` THEN o sistema SHALL validar no servidor que as faltas do passageiro visado excedem 50% dos dias úteis do mês corrente; caso contrário SHALL recusar.
3. WHEN a validação passa THEN o acordo SHALL passar a `cancelado_justificado`, com `rescisao_justificativa` e `cancelado_em` gravados, passageiros activos marcados `saiu` e `vagas_disponiveis` recontada na mesma transacção.
4. WHEN a rescisão por justa causa é aplicada a meio do mês THEN as quotas dos passageiros SHALL ser ajustadas **pro-rata** aos dias úteis já decorridos (Africa/Luanda). *(ver S22-TM-08 — decisão pendente, ver §Ambiguidades)*
5. WHEN a justificativa é livre/desconhecida THEN o sistema SHALL recusar com mensagem em português.

**Independent Test**: mock RPC `justa_causa` sem justificativa → erro; com `faltas_excessivas` acima do limiar → `cancelado_justificado`.

---

### P1: Capacidade não mentirosa ⭐ MVP

**User Story**: Como utilizador do matching, quero que `vagas_disponiveis` reflicta sempre a ocupação real, para não pedir lugar num carro cheio.

**Why P1**: é uma falha de integridade explorável por qualquer cliente autenticado (política `ofertas_update_proprio` permite UPDATE livre).

**Acceptance Criteria**:

1. WHEN qualquer `UPDATE` toca `ofertas_capacidade` THEN um trigger `BEFORE UPDATE` SHALL recalcular `NEW.vagas_disponiveis = NEW.vagas_totais − (passageiros activos em acordos `activo` ou `cancelamento_pendente` ligados à oferta)`.
2. WHEN o cliente envia `vagas_disponiveis = 99` THEN o valor persistido SHALL ser o valor calculado, não o enviado.
3. WHEN o cálculo daria `< 0` THEN a transacção SHALL abortar com excepção em português.
4. WHEN um acordo é rescindido/aplicado THEN a recontagem SHALL ser consistente com o valor que `accept_proposal` já escreve (sem drift entre RPC e trigger).
5. WHEN `vagas_totais` é reduzido abaixo da ocupação actual THEN o sistema SHALL abortar (opcional P2 — ver S22-CAP-05).

**Independent Test**: SQL smoke via Supabase MCP — `UPDATE … SET vagas_disponiveis = 99` seguido de `SELECT` mostra o valor recalculado.

---

### P2: Rescindir a partir de `/acordos`

**User Story**: Como utilizador em `/acordos`, quero um modal «Rescindir acordo» com as 3 opções explicadas, para escolher com consciência das consequências.

**Why P2**: sem UI o Epic é invisível; mas depende de DB + serviços verdes primeiro (gate XP).

**Acceptance Criteria**:

1. WHEN o acordo está activo e o utilizador é motorista ou passageiro activo THEN a UI SHALL mostrar o CTA «Rescindir acordo».
2. WHEN o modal abre THEN SHALL apresentar 3 opções com copy PT-PT modeless: aviso prévio («continua activa até ao último dia deste mês…»), consensual («precisa de confirmação da outra parte»), justa causa (select de motivo + campo de texto obrigatório).
3. WHEN a opção escolhida é justa causa e o texto está vazio THEN o CTA de confirmação SHALL ficar desactivado.
4. WHEN a confirmação é submetida offline THEN a UI SHALL mostrar `FeedbackAlert` «Aguardando sincronização…» (`role="status"`) e não bloquear o ecrã.
5. WHEN a acção falha THEN a UI SHALL usar `FeedbackAlert type="error"` (`role="alert"`) com `getFriendlyErrorMessage`.
6. WHEN o CTA destrutivo é renderizado THEN SHALL estar visualmente separado dos CTAs neutros (Fitts) e nunca ser o alvo por omissão.

**Independent Test**: render do modal em Vitest + Testing Library; assertar 3 opções, disabled state e copy.

---

### P2: CTAs de adenda bilaterais em `/acordos`

**User Story**: Como motorista, quero ver «Aceitar / Rejeitar» quando é o passageiro que propõe; como passageiro, quero o CTA «Propor novo preço».

**Acceptance Criteria**:

1. WHEN `tipoPerfil` é Motorista ou o utilizador é passageiro activo, e o acordo está activo THEN `podeRenegociar` SHALL ser verdadeiro.
2. WHEN existe `adenda_pendente` com `estado = 'pendente_contraparte'` e o utilizador é o motorista THEN a UI SHALL mostrar «Aceitar Alteração» / «Rejeitar Alteração».
3. WHEN existe `adenda_pendente` com `estado = 'pendente_passageiro'` e o utilizador é passageiro activo THEN a UI SHALL manter os CTAs actuais.
4. WHEN o utilizador é o criador da adenda THEN a UI SHALL mostrar estado «A aguardar resposta da outra parte» sem CTAs de decisão.
5. WHEN a copy é escrita THEN SHALL usar linguagem humana em Kz («Por passageiro», «Total do acordo») e nunca jargon (`N_contrato`, `POR_PASSAGEIRO`).

**Independent Test**: `MyAgreements.test.jsx` com perfil Motorista + adenda `pendente_contraparte` → CTAs visíveis.

---

### P3: Polish modeless nos cards de matching

**User Story**: Como passageiro a ver matches, quero avisos de capacidade não bloqueantes, para não perder o contexto do ecrã.

**Acceptance Criteria**:

1. WHEN um card de match tem aviso de capacidade THEN SHALL usar `FeedbackAlert role="status"` inline, sem modal bloqueante.

---

## Edge Cases

- WHEN o acordo tem 1 passageiro activo e este rescinde por aviso prévio THEN o acordo (não só a linha) SHALL ir para `cancelamento_pendente` — `leave_passenger` continua a ser o caminho para sair de um lugar sem matar o contrato.
- WHEN existe adenda `aceite` não aplicada e o acordo é cancelado antes de `effective_from` THEN `apply_due_agreement_adendas` **não** SHALL aplicar preços a acordo cancelado.
- WHEN há pedido `consensual` pendente e chega `aviso_previo` da mesma parte THEN o último modo pedido SHALL sobrepor-se, mantendo `rescisao_solicitada_por` actualizado (auditável).
- WHEN a fila offline sincroniza uma rescisão já aplicada online THEN a idempotência SHALL devolver sucesso sem segundo efeito.
- WHEN o utilizador perde a sessão antes de enfileirar THEN o serviço SHALL lançar «Sessão necessária para guardar … offline.» (padrão do repo).
- WHEN `n_passageiros_contrato < 1` THEN qualquer proposta de adenda SHALL falhar («N_contrato inválido neste acordo.»).
- WHEN a oferta é flexível (sem OD) THEN a recontagem de vagas SHALL funcionar na mesma (a capacidade não depende de OD).
- WHEN dois passageiros aceitam a mesma adenda em paralelo THEN o `FOR UPDATE` + idempotência SHALL garantir um único efeito.

---

## Regras de segurança (não negociáveis)

| Regra | Onde vive |
| ----- | --------- |
| Nenhuma validação crítica só no frontend | Toda a autorização em RPC `SECURITY DEFINER` com `SET search_path TO 'public'` |
| Criador nunca decide a própria adenda | `accept_agreement_adenda` / `reject_agreement_adenda` comparam `auth.uid() = created_by` |
| Rescisão só por parte do acordo | `terminate_agreement` valida `driver_id` **ou** `acordos_passageiros.estado = 'activo'` |
| Sem `UPDATE` do cliente em tabelas críticas | `acordos`, `acordos_passageiros`, `acordos_adendas`, `propostas`, `lista_espera` — só RPC (G11) |
| Capacidade calculada no servidor | Trigger `BEFORE UPDATE` em `ofertas_capacidade`; RLS `ofertas_update_proprio` deixa de ser suficiente por si só |
| `GRANT` mínimo | `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated` em todas as RPCs novas |
| Idempotência auditável | `rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)` em todas as mutações novas |
| Sem segredos no código | `VITE_*` em `.env`, como já é a norma |

---

## Requirement Traceability

| ID | Story | Fase | Estado |
| -- | ----- | ---- | ------ |
| S22-AD-01 | P1 Passageiro propõe | Task 1 (DB) | Done |
| S22-AD-02 | P1 Passageiro propõe — estado por iniciador (`pendente_passageiro` / `pendente_contraparte`) | Task 1 (DB) | Done |
| S22-AD-03 | P1 Passageiro propõe — divisor congelado `n_passageiros_contrato` | Task 1 (DB) | Done |
| S22-AD-04 | P1 Passageiro propõe — `effective_from` = 1.º dia mês seguinte (Africa/Luanda) | Task 1 (DB) | Done |
| S22-AD-05 | P1 Passageiro propõe — supersede da adenda anterior | Task 1 (DB) | Done |
| S22-AD-06 | P1 Contraparte decide — accept bilateral | Task 1 (DB) | Done |
| S22-AD-07 | P1 Contraparte decide — criador nunca decide | Task 1 (DB) | Done |
| S22-AD-08 | P1 Contraparte decide — reject mantém preços + `p_idempotency_key` | Task 1 (DB) | Done |
| S22-AD-09 | P1 — alias SQL `propose_agreement_adenda` delega na mesma lógica | Task 1 (DB) | Done |
| S22-AD-10 | P1 — serviços `proposeAgreementAdenda` / `respondAgreementAdenda` (JSDoc, sem TS) | Task 1 (Service) | Done |
| S22-TM-01 | P1 Aviso prévio — colunas de rescisão em `acordos` | Task 2 (DB) | Done |
| S22-TM-02 | P1 Aviso prévio — `cancelamento_pendente` + `rescisao_effective_on` | Task 2 (DB) | Done |
| S22-TM-03 | P1 Aviso prévio — vagas mantidas até ao dia 1 | Task 2 (DB) | Done |
| S22-TM-04 | P1 Aviso prévio — `apply_due_agreement_terminations` (lazy dia 1) | Task 2 (DB) | Done |
| S22-TM-05 | P1 Consensual — 1.º passo grava pedido | Task 2 (DB) | Done |
| S22-TM-06 | P1 Consensual — 2.º passo da contraparte cancela e liberta vagas | Task 2 (DB) | Done |
| S22-TM-07 | P1 Justa causa — enum de motivo + validação `faltas_excessivas` no servidor | Task 2 (DB) | Done |
| S22-TM-08 | P1 Justa causa — pro-rata das quotas por dias úteis decorridos | Task 2 (DB) | Done (decisão A1: só `justa_causa`) |
| S22-TM-09 | P1 — autorização (driver ou pax activo) + idempotência | Task 2 (DB) | Done |
| S22-TM-10 | P1 — serviço `terminateAgreement(acordoId, { modo, justificativa }, options)` | Task 2 (Service) | Done |
| S22-TM-11 | P1 — lazy apply de terminações nas listagens de acordos | Task 2 (Service) | Done |
| S22-CAP-01 | P1 Capacidade — trigger `BEFORE UPDATE` recalcula `vagas_disponiveis` | Task 3 (DB) | Done |
| S22-CAP-02 | P1 Capacidade — `UPDATE` do cliente não persiste valor falso | Task 3 (DB) | Done |
| S22-CAP-03 | P1 Capacidade — aborta se resultado `< 0` | Task 3 (DB) | Done |
| S22-CAP-04 | P1 Capacidade — `cancelamento_pendente` conta como ocupado | Task 3 (DB) | Done |
| S22-CAP-05 | P2 Capacidade — impedir `vagas_totais` abaixo da ocupação | Task 3 (DB) | Done |
| S22-OFF-01 | P1 Offline — novas RPCs na união de `enqueueRpc` com `p_idempotency_key` | Task 1–2 (Service) | Done |
| S22-OFF-02 | P1 Offline — chamada duplicada da fila não duplica efeito | Task 1–2 (Service) | Done |
| S22-UI-01 | P2 — `podeRenegociar` bilateral em `MyAgreements` | Task 4 (UI) | Done |
| S22-UI-02 | P2 — CTAs Aceitar/Rejeitar para o motorista em `pendente_contraparte` | Task 4 (UI) | Done |
| S22-UI-03 | P2 — `TerminateAgreementModal` com 3 modos + copy modeless PT-PT | Task 4 (UI) | Done |
| S22-UI-04 | P2 — CTA destrutivo separado (Fitts) e nunca alvo por omissão | Task 4 (UI) | Done |
| S22-UI-05 | P2 — `FeedbackAlert` offline/erro (`role="status"` / `role="alert"`) | Task 4 (UI) | Done |
| S22-UI-06 | P2 — copy humana em Kz, sem jargon `N_*` / `POR_PASSAGEIRO` | Task 4 (UI) | Done |
| S22-UI-07 | P3 — polish modeless nos cards de matching | Task 4c (UI) | Pending |

**Cobertura:** 33 requisitos · 33 mapeados a tasks · 0 sem task. **Bloqueio S22-TM-08 resolvido** (decisão A1: pro-rata só em `justa_causa`). **Estado 2026-09-06:** DB + serviços + **UI T4a/T4b Done** (S22-UI-01…06). Falta T4c (S22-UI-07) e T5 (ui-qa + code-reviewer).

---

## Rastreabilidade para cenários de auditoria

Ficheiro: `src/pages/MarketplaceAuditScenarios.test.jsx` (G13 já ocupado por «pickup opcional» — os cenários da visão G13–G15 passam a **G16–G18**).

| Cenário | Cobre | Critério verde |
| ------- | ----- | -------------- |
| **G16** | S22-AD-01…05 | Adenda proposta por passageiro fica `pendente_contraparte`; preço activo do acordo **intacto** até `effective_from`; supersede da anterior registada |
| **G17** | S22-AD-06…08 | Rejeição pela contraparte → `rejeitada`; `valor_mensal_por_passageiro_kz` e `quota_mensal_kz` inalterados; criador não pode rejeitar |
| **G18** | S22-TM-02…04, S22-CAP-04 | Aviso prévio → `cancelamento_pendente` com vagas ainda ocupadas; após `apply_due_agreement_terminations` no dia 1 → `cancelado` + vagas libertadas |

Regressão obrigatória: **G1–G15** continuam verdes (cascata, overbooking, leave→waitlist FIFO, copy adenda, deep links, fórmula de faltas, RLS smoke, ausência de jargon, pickup opcional).

---

## Stack e restrições

- **JavaScript + JSDoc** — proibido TypeScript, `.ts`/`.tsx`, `tsconfig`.
- **DDL exclusivamente via Supabase MCP** (`apply_migration`) no projecto `boleia` (`fdclrbcgytnuqcrpsevw`), com o ficheiro canónico em `supabase/migrations/20260906150000_s22_bilateral_adenda_terminate_vagas.sql`.
- **TDD Vitest** com `vi.mock('../lib/supabase')`; mensagens de `describe`/`it` em português.
- **Sem biblioteca de toast** — `FeedbackAlert` / `setMessage` / `useNotifications`.
- **UI SoT** — UI Skills MCP + Stitch (projecto canónico «Boleia Certa») + primitivos shadcn em `src/components/ui/`.
- **Ordem XP inegociável**: Spec → Database → Services (TDD) → UI (Stitch) → Verificação. Sem geração de código «one-shot»; sem avançar para UI com serviços vermelhos.

---

## Success Criteria

- [ ] Passageiro activo consegue propor adenda e o motorista consegue aceitá-la ponta a ponta (RPC + serviço + UI).
- [ ] Os 3 modos de rescisão funcionam com autorização validada no servidor e rasto auditável nas colunas de `acordos`.
- [ ] `UPDATE` directo de `vagas_disponiveis` a partir do cliente é neutralizado (smoke SQL prova).
- [ ] G16, G17 e G18 verdes; G1–G15 sem regressão.
- [ ] `npm run lint` e `npm run test:run` limpos.
- [ ] `ui-qa` e `code-reviewer` devolvem `VERDICT: APPROVE`.

---

## Ambiguidades / decisões pendentes

| # | Questão | Impacto | Proposta |
| - | ------- | ------- | -------- |
| A1 | **S22-TM-08 pro-rata na justa causa** — AGENTS §7 diz que preços/quotas ficam congelados na aceitação e que saídas não recalculam quotas. O pro-rata contradiz essa regra. | Bloqueia o agente DB na Task 2 | Manter quota congelada e registar só `cancelado_em` (o acerto financeiro fica fora da app), **ou** aceitar excepção explícita documentada em AGENTS §7. **Precisa de decisão do utilizador.** |
| A2 | **Validação de `faltas_excessivas` em SQL** — o cálculo de dias úteis existe só no cliente (`src/utils/faltaDesconto.js`). Não confirmei função equivalente no remoto. | Task 2 | Agente DB verifica no projecto remoto; se não existir, implementa o cálculo dentro de `terminate_agreement` (sem nova função pública). |
| A3 | **`getUserAgreements` não existe** — o serviço expõe `getAgreementsForDriver` / `getAgreementsForPassenger` e o hook lazy é `applyDueAdendasBestEffort`. | Task 2 (Service) | O lazy de terminações entra nas duas funções, ao lado do lazy de adendas (nome sugerido: `applyDueTerminationsBestEffort`). |
| A4 | **`reject_agreement_adenda` muda de assinatura** ao ganhar `p_idempotency_key`; o cliente actual chama só com `p_adenda_id`. | Ordem Task 1 | DB primeiro (parâmetro com `DEFAULT NULL`, retrocompatível), cliente a seguir. |
| A5 | **Consensual com N passageiros** — basta **um** passageiro activo confirmar para cancelar o acordo de todos. | Produto | Assumido conforme plano (decisão 6). Sinalizar ao utilizador que é uma escolha com impacto em terceiros. |
| A6 | **Drift trigger ↔ `accept_proposal`** — `accept_proposal` escreve `vagas_disponiveis` explicitamente; o trigger vai recalcular por cima. | Task 3 | O cálculo do trigger tem de dar exactamente o mesmo resultado (passageiros activos em acordos `activo` **ou** `cancelamento_pendente`); validar com smoke SQL antes de fechar a Task 3. |
