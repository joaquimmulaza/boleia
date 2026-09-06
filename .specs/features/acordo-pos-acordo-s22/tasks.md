# Epic §22 — Ciclo de Vida Pós-Acordo — Tasks

**Spec:** `spec.md` · **Design:** `design.md`
**Estado global:** In Progress — **T0 · T1a/T1b/T1c · T2a/T2b/T2c · T3 Done** · **T4a + T4b Done** (UI Skills + Stitch + `TerminateAgreementModal` + CTAs bilaterais) · T4c / T5 Pending (ui-qa + code-reviewer)

**Decisão A1 (Orquestrador, 2026-09-06):** o pro-rata de quotas é uma **excepção explícita** à regra de quotas congeladas (AGENTS §7) e vale **só** para `justa_causa`. Aviso prévio, consensual, `leave_passenger` e saídas normais **não** recalculam quotas.
**Decisão A2:** não existe helper SQL de dias úteis no remoto — o cálculo vive dentro de `terminate_agreement` (unidade diária = `quota / acordos.dias_uteis_mes`, espelhando `src/utils/faltaDesconto.js`).
**Decisão A5:** uma única confirmação da contraparte (motorista ↔ qualquer passageiro activo) basta para cancelar o consensual dos N.

---

## Ordem XP (inegociável)

```
Spec → Database → Services (TDD) → UI (UI Skills + Stitch) → Verificação
 T0  →   T1a/T2a/T3   →   T1b/T2b   →      T4a/T4b        →      T5
```

**Regras de execução:**

- **Sequencial.** T1, T2 e T4 tocam os mesmos ficheiros (`AgreementService.js`, a migração, `MyAgreements.jsx`) — **não paralelizar escrita**.
- **Sem geração «one-shot».** Cada task entrega um deliverable verificável e pára.
- **Gate de serviços:** proibido começar a UI (T4) com Vitest vermelho em T1b/T2b.
- **Gate de design:** proibido implementar UI sem passar por UI Skills MCP → Stitch (projecto canónico «Boleia Certa») e sem o gate «design pronto».
- **TDD:** o primeiro ficheiro escrito em cada task de serviço é o **teste**.
- **DDL:** exclusivamente Supabase MCP (`apply_migration`) no projecto `boleia` (`fdclrbcgytnuqcrpsevw`), com o ficheiro canónico em `supabase/migrations/`.
- **Sem commit automático.** Preparar mensagem e `git status`; commit só a pedido do utilizador, com testes verdes.

---

## Mapa de dependências

```
T0 (Spec) ──► T1a (SQL adenda) ──► T1b (Service adenda TDD) ──┐
                    │                                          │
                    └──► T2a (SQL terminate) ──► T2b (Service terminate TDD) ──┤
                                    │                                          │
                                    └──► T3 (Trigger vagas) ───────────────────┤
                                                                               ▼
                                                        T4a (Design UI) ──► T4b (Implementar UI)
                                                                               │
                                                                               ▼
                                                                        T5 (Verificação + revisores)
```

---

## T0 — Spec/Arquitectura ✅ Done

**O quê:** especificação completa do Epic §22 com IDs rastreáveis.
**Onde:** `.specs/features/acordo-pos-acordo-s22/`
**Depende de:** nada
**Requisitos:** todos (S22-AD-*, S22-TM-*, S22-CAP-*, S22-OFF-*, S22-UI-*)

**Done when:**

- [x] `spec.md` com problema, stories P1–P3, critérios WHEN/THEN, edge cases, regras de segurança, out of scope
- [x] 33 requisitos com IDs e traceability para G16/G17/G18
- [x] `design.md` com máquinas de estado, contratos de RPC, trigger, reuso e decisões técnicas
- [x] `tasks.md` (este ficheiro) com dependências e critérios de verificação
- [x] `AGENTS.md` e `.specs/project/STATE.md` actualizados (Spec em curso, **não** implementação)

**Verify:** os 3 ficheiros existem em `.specs/features/acordo-pos-acordo-s22/` e o `AGENTS.md` referencia o caminho sem declarar implementação concluída.

**Bloqueio aberto:** **A1 (S22-TM-08 pro-rata)** precisa de decisão do utilizador antes de T2a. Ver §Ambiguidades da spec.

---

## T1 — Adenda bilateral

### T1a — SQL: proposta e decisão bilaterais ✅ Done

**O quê:** generalizar a proposta de adenda e a aceitação para as duas partes.
**Onde:** `supabase/migrations/20260906150000_s22_bilateral_adenda_terminate_vagas.sql` (+ `apply_migration` MCP)
**Depende de:** T0
**Reusa:** `renegotiate_agreement_pricing`, `reject_agreement_adenda`, `apply_due_agreement_adendas` (migração `20260906120000_*`)
**Requisitos:** S22-AD-01 · 02 · 03 · 04 · 05 · 06 · 07 · 08 · 09

**Tools:** Supabase MCP (`list_tables`, `execute_sql`, `apply_migration`)

**Done when:**

- [x] `renegotiate_agreement_pricing` autoriza `driver_id` **ou** passageiro com `estado='activo'`; caller ilegítimo recebe «Sem permissão para renegociar este acordo.»
- [x] Estado inicial derivado do iniciador: motorista → `pendente_passageiro`; passageiro → `pendente_contraparte`
- [x] Divisor continua a ser `n_passageiros_contrato`; `p_n_passageiros` divergente é recusado
- [x] `effective_from` = 1.º dia do mês seguinte em `Africa/Luanda`; cabeçalho e quotas do mês corrente intactos
- [x] Adendas anteriores não aplicadas ficam `superseded_at`
- [x] Notificação dirigida à contraparte correcta com `metadata.adenda_estado`
- [x] `propose_agreement_adenda(...)` criada como alias que delega na mesma lógica
- [x] `accept_agreement_adenda` aceita `pendente_passageiro` (pax activo) **e** `pendente_contraparte` (driver); `created_by` bloqueado em ambos
- [x] `reject_agreement_adenda` ganha `p_idempotency_key uuid DEFAULT NULL` (retrocompatível; versão de 1 argumento removida para evitar ambiguidade)
- [x] `REVOKE ALL … FROM PUBLIC` (+ `REVOKE … FROM anon`) + `GRANT EXECUTE … TO authenticated` em todas as funções tocadas
- [x] **Follow-up grants (2026-09-06):** `s22_rpc_grants_hardening` — `REVOKE ALL … FROM anon` em `renegotiate_agreement_pricing` / `accept_agreement_adenda` / `reject_agreement_adenda` / `apply_due_agreement_adendas`; `GRANT EXECUTE` só a `authenticated`; `apply_due_*` com `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.';`
- [x] Ficheiro local de migração é a fonte canónica e documenta os nomes aplicados via MCP
- [x] **Extra:** `apply_due_agreement_adendas` deixa de aplicar preços a acordo não `activo` (edge case da spec)

**Verify:**

```sql
-- smoke via Supabase MCP execute_sql
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc WHERE proname IN
 ('renegotiate_agreement_pricing','propose_agreement_adenda',
  'accept_agreement_adenda','reject_agreement_adenda');
```

**Resultado (2026-09-06, projecto `boleia`):** as 4 funções existem, todas `SECURITY DEFINER`; `propose_agreement_adenda` com 5 argumentos, `reject_agreement_adenda` com 2 (`p_adenda_id`, `p_idempotency_key`).

Smoke funcional (bloco `DO` com rollback, JWT simulado via `set_config('request.jwt.claims', …)`):

| Cenário | Resultado |
| ------- | --------- |
| Passageiro propõe | `estado=pendente_contraparte`, `created_by=pax`, `effective_from=2026-10-01`, `n_contrato=1`, preço do acordo e quota **intactos** |
| Criador tenta aceitar | «Só a contraparte pode aceitar esta adenda.» |
| Criador tenta rejeitar | «Só a contraparte pode rejeitar esta adenda.» |
| Motorista aceita | `estado=aceite`, `aceite_por=driver`, `applied_at` nulo, preço do acordo intacto |
| Motorista propõe depois | nova adenda `pendente_passageiro`; anterior com `superseded_at` |

---

### T1b — Serviço + TDD da adenda bilateral ✅ Done

**O quê:** expor a adenda bilateral no `AgreementService` com fila offline.
**Onde:** `src/services/AgreementService.test.js` (primeiro) → `src/services/AgreementService.js` → `src/services/offlineQueue.js`
**Depende de:** T1a
**Reusa:** `leavePassenger` como template de `queueX()`, `enqueueRpc`, `isNetworkFailure`, `resolveAgreementPricing`
**Requisitos:** S22-AD-10 · S22-OFF-01 · S22-OFF-02

**Tools:** Vitest (`vi.mock('../lib/supabase')`)

**Done when:**

- [x] **Testes escritos primeiro e a falhar**, mensagens em português (29 vermelhos antes da implementação)
- [x] `proposeAgreementAdenda(acordoId, input, options)` exportada (alias explícito do caminho bilateral, RPC `propose_agreement_adenda`)
- [x] `respondAgreementAdenda(adendaId, accept, options)` delega em accept/reject
- [x] Default de `n_passageiros` passa a vir de `acordos.n_passageiros_contrato` (não do count de activos) — teste prova a diferença quando `N_activos ≠ N_contrato` e assere que `acordos_passageiros` **não** é consultado
- [x] `rejectAgreementAdenda` passa `p_idempotency_key` à RPC (contrato de 2 argumentos)
- [x] Falha de rede → `enqueueRpc` com `p_idempotency_key`; retorno `{ offlineQueued: true, … }`
- [x] União JSDoc de `offlineQueue.rpc` inclui `propose_agreement_adenda`, `reject_agreement_adenda`, `terminate_agreement`
- [x] JSDoc completo; **zero** TypeScript

**Verify:** `npx vitest run src/services/AgreementService.test.js` — verde. `npm run lint` limpo.

**Resultado (2026-09-06):** suites tocadas 86/86 verdes; `npm run test:run` 534/534; ESLint limpo. `submitAgreementAdenda` privado partilha o caminho entre `renegotiate_agreement_pricing` e `propose_agreement_adenda`.

---

### T1c — Auditoria G16 + G17 ✅ Done

**O quê:** cenários de auditoria da adenda bilateral.
**Onde:** `src/pages/MarketplaceAuditScenarios.test.jsx`
**Depende de:** T1b
**Requisitos:** S22-AD-01…08

**Done when:**

- [x] **G16** — proposta do passageiro fica `pendente_contraparte`; preço activo do acordo intacto até `effective_from` (data calculada como 1.º dia do mês seguinte e comparada com `Date.now()`); adenda anterior supersedida não é devolvida como pendente
- [x] **G17** — rejeição pela contraparte → `rejeitada`; valores por passageiro / total e quotas inalterados; criador não pode rejeitar («Só a contraparte pode rejeitar esta adenda.»)
- [x] Numeração G16/G17 (G13 já está ocupado por «pickup opcional»)

**Verify:** `npx vitest run src/pages/MarketplaceAuditScenarios.test.jsx` — G1–G18 verdes (2026-09-06).

---

## T2 — Rescisão de acordo

> **Pré-requisito:** decisão A1 (pro-rata S22-TM-08) — **resolvida** (excepção explícita só em `justa_causa`).

### T2a — SQL: `terminate_agreement` + lazy cleanup ✅ Done

**O quê:** colunas de rescisão, RPC de 3 modos e aplicação diferida.
**Onde:** mesma migração `20260906150000_*.sql` (+ `apply_migration` MCP)
**Depende de:** T1a, decisão A1
**Reusa:** `leave_passenger` (marcar `saiu` + recontar vagas), `apply_due_agreement_adendas` (estrutura do lazy)
**Requisitos:** S22-TM-01…09

**Done when:**

- [x] Colunas `rescisao_modo`, `rescisao_solicitada_por`, `rescisao_justificativa`, `rescisao_effective_on`, `cancelado_em` adicionadas a `acordos` (nullable)
- [x] CHECK de `acordos.estado` aceita `activo`, `suspenso`, `cancelamento_pendente`, `cancelado`, `cancelado_justificado`, `expirado` (legado `suspenso`/`expirado` preservado; 0 linhas afectadas — só existiam `activo`)
- [x] CHECK novo `acordos_rescisao_modo_check` + FK `rescisao_solicitada_por → auth.users(id) ON DELETE SET NULL` + índice parcial `idx_acordos_rescisao_pendente`
- [x] `terminate_agreement(p_acordo_id, p_modo, p_justificativa DEFAULT NULL, p_idempotency_key DEFAULT NULL)` criada, `SECURITY DEFINER` + `SET search_path TO 'public'`
- [x] Autorização: `driver_id` **ou** passageiro activo; caso contrário «Sem permissão para rescindir este acordo.»
- [x] `aviso_previo` → `cancelamento_pendente` + `rescisao_effective_on` no dia 1 do mês seguinte; vagas e membros **inalterados**
- [x] `consensual` → 1.º passo grava pedido sem cancelar; 2.º passo pela **contraparte** (cross-side motorista ↔ pax activo) cancela já, marca `saiu` e liberta vagas na mesma transacção; 2.ª chamada do mesmo utilizador não cancela e preserva `rescisao_solicitada_por`
- [x] `justa_causa` → justificativa obrigatória ∈ `{faltas_excessivas, avaria_veiculo, seguranca}`; `faltas_excessivas` validada no servidor (>50% de `dias_uteis_mes`; motorista verifica faltas `tipo='Passageiro'`, passageiro verifica `tipo='Motorista'`); estado `cancelado_justificado`
- [x] **A1 — quotas na justa causa:** pro-rata aplicado **só** neste modo. Unidade diária = `quota / acordos.dias_uteis_mes`; dias úteis decorridos = Seg–Sex de `date_trunc('month')` até hoje (Africa/Luanda), com `LEAST/GREATEST` a limitar o resultado ao intervalo `[0, quota]`
- [x] Notificação à contraparte dentro de bloco `EXCEPTION WHEN OTHERS THEN RAISE WARNING`
- [x] Registo em `rpc_idempotency`; chave repetida devolve `p_acordo_id` sem re-mutar
- [x] `apply_due_agreement_terminations(p_acordo_id DEFAULT NULL) RETURNS integer` criada; aplica só `rescisao_effective_on <= hoje (Africa/Luanda)` e faz `promote_waitlist` best-effort
- [x] `REVOKE`/`GRANT` nas funções novas (`authenticated` apenas — `anon` revogado)

**Verify:**

```sql
SELECT proname, prosecdef FROM pg_proc
WHERE proname IN ('terminate_agreement','apply_due_agreement_terminations');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'acordos' AND column_name LIKE 'rescisao%';
```

**Resultado (2026-09-06):** 2 funções `SECURITY DEFINER`; colunas presentes — `cancelado_em`, `rescisao_effective_on`, `rescisao_justificativa`, `rescisao_modo`, `rescisao_solicitada_por`.

Smoke funcional (blocos `DO` com rollback, JWT simulado):

| Cenário | Resultado |
| ------- | --------- |
| Terceiro sem relação com o acordo | «Sem permissão para rescindir este acordo.» |
| `aviso_previo` (motorista) | `estado=cancelamento_pendente`, `rescisao_effective_on=2026-10-01`, `vagas_disponiveis=3` com `ocupadas=1` (**vagas ainda ocupadas**) |
| `apply_due_agreement_terminations` após backdate | `applied=1`, `estado=cancelado`, `cancelado_em` preenchido, `vagas_disponiveis=4`, `ocupadas=0`, passageiros `saiu` |
| `aviso_previo` repetido em acordo já cancelado | «Este acordo já não está activo.» |
| `consensual` 1.º passo | `estado=activo`, `rescisao_modo=consensual`, solicitante = motorista |
| `consensual` 2.ª chamada do **mesmo** utilizador | `estado=activo` (não cancela), solicitante preservado |
| `consensual` confirmado pelo passageiro activo | `estado=cancelado`, `cancelado_em` preenchido, vagas libertadas, **quota congelada** (40 000 → 40 000) |
| `justa_causa` sem justificativa | «A justa causa exige uma justificativa.» |
| `justa_causa` `avaria_veiculo` | `estado=cancelado_justificado`, vagas libertadas, **pro-rata** 40 000 → 7 273 (4 dias úteis decorridos ÷ 22) |

---

### T2b — Serviço + TDD da rescisão ✅ Done

**O quê:** `terminateAgreement` + lazy de terminações nas listagens.
**Onde:** `src/services/AgreementService.test.js` (primeiro) → `src/services/AgreementService.js`
**Depende de:** T2a
**Reusa:** template `leavePassenger`, `applyDueAdendasBestEffort`
**Requisitos:** S22-TM-10 · S22-TM-11 · S22-OFF-01 · S22-OFF-02

**Done when:**

- [x] **Testes escritos primeiro e a falhar**
- [x] `terminateAgreement(acordoId, { modo, justificativa }, options)` exportada; valida `modo` e justificativa no cliente (espelho, não substituto da RPC) via `RESCISAO_MODOS` / `RESCISAO_JUSTIFICATIVAS`
- [x] `justa_causa` sem justificativa → erro em português antes da chamada
- [x] Consensual: como a RPC devolve sempre o mesmo `acordo_id`, o serviço relê o acordo e deriva `rescisao_aguarda_confirmacao` / `rescisao_concluida`
- [x] Falha de rede / `forceQueue` / `navigator.onLine === false` → `enqueueRpc('terminate_agreement')` com `p_idempotency_key` e retorno `{ offlineQueued: true, … }`
- [x] **Anti-confirmação acidental:** repetição offline do mesmo `(acordo, modo)` reutiliza o item já em fila em vez de enfileirar uma 2.ª chamada (que no consensual poderia ser lida como confirmação da contraparte)
- [x] `applyDueTerminationsBestEffort` chamada por `getAgreementsForDriver` e `getAgreementsForPassenger` via `applyDueLifecycleBestEffort` (best-effort, `console.warn` em falha, nunca bloqueia a listagem)
- [x] JSDoc completo; sem TypeScript; `npm run lint` limpo

**Verify:** `npx vitest run src/services/AgreementService.test.js` — verde, incluindo os testes novos de rescisão.

---

### T2c — Auditoria G18 ✅ Done

**O quê:** cenário de aviso prévio ponta a ponta.
**Onde:** `src/pages/MarketplaceAuditScenarios.test.jsx`
**Depende de:** T2b
**Requisitos:** S22-TM-02 · 03 · 04 · S22-CAP-04

**Done when:**

- [x] **G18** — aviso prévio → `cancelamento_pendente` com vagas ainda ocupadas (helper espelha a fórmula do trigger: `activo` + `cancelamento_pendente` contam como ocupados); a listagem dispara `apply_due_agreement_terminations` e o acordo fica `cancelado` com a vaga libertada
- [x] G1–G17 sem regressão

**Verify:** `npx vitest run src/pages/MarketplaceAuditScenarios.test.jsx` — G1–G18 verdes (2026-09-06).

---

## T3 — Hardening de `vagas_disponiveis` ✅ Done

**O quê:** trigger que impede o cliente de mentir sobre capacidade.
**Onde:** mesma migração `20260906150000_*.sql` (+ `apply_migration` MCP)
**Depende de:** T2a (o cálculo tem de conhecer `cancelamento_pendente`)
**Requisitos:** S22-CAP-01 · 02 · 03 · 04 · 05

**Done when:**

- [x] Função `public.recalc_vagas_disponiveis()` + trigger `trg_ofertas_recalc_vagas BEFORE UPDATE ON public.ofertas_capacidade FOR EACH ROW`
- [x] Cálculo centralizado em `public.oferta_ocupacao(uuid)`: `NEW.vagas_totais − COUNT(passageiros 'activo' em acordos 'activo' ou 'cancelamento_pendente')`, comparação `lower()`
- [x] `UPDATE … SET vagas_disponiveis = 99` do cliente **não** persiste o valor falso
- [x] Resultado `< 0` aborta a transacção com «Capacidade inconsistente: a oferta já tem mais passageiros (%) do que lugares (%).»
- [x] `estado` da oferta (`disponivel`/`parcial`/`cheia`) derivado do mesmo cálculo — `inactiva` é preservado (decisão do motorista, não deriva da ocupação)
- [x] (P2, S22-CAP-05) redução de `vagas_totais` abaixo da ocupação é recusada pelo mesmo guard
- [x] **Anti-regressão A6:** fórmula do trigger idêntica à de `accept_proposal` (que insere `acordos_passageiros` **antes** do `UPDATE` da oferta) — verificado com 0 ofertas em drift no remoto
- [x] Helper `public.recount_oferta_vagas(uuid)` para as RPCs forçarem a recontagem via trigger
- [x] **Follow-up grants (2026-09-06):** `recount_oferta_vagas` sem `EXECUTE` para `authenticated` / `anon` / `PUBLIC` (só owner + `SECURITY DEFINER` internas) — migração `20260906160000_s22_rpc_grants_hardening.sql` / MCP `s22_rpc_grants_hardening`

**Verify:**

```sql
UPDATE public.ofertas_capacidade SET vagas_disponiveis = 99 WHERE id = '<oferta>';
SELECT vagas_disponiveis, estado FROM public.ofertas_capacidade WHERE id = '<oferta>';
```

**Resultado (2026-09-06, oferta `24d3303f-…`):** enviado `vagas_disponiveis = 99` → persistiu `3` com `vagas_totais=3`, `ocupadas=0`, `estado=disponivel`. A mesma escrita corrigiu drift pré-existente (estava `1`).

Guard negativo (bloco `DO` com rollback: +1 passageiro activo → `ocupadas=2`, `vagas_totais=1`): «Capacidade inconsistente: a oferta já tem mais passageiros (2) do que lugares (1).»

Parity check final: `SELECT count(*) FROM ofertas_capacidade o WHERE o.vagas_disponiveis <> o.vagas_totais - oferta_ocupacao(o.id)` → **0**.

**Follow-up grants (2026-09-06, MCP `s22_rpc_grants_hardening`):** `routine_privileges` sem `anon` em `renegotiate_agreement_pricing` / `accept_agreement_adenda` / `reject_agreement_adenda` / `apply_due_agreement_adendas`; `recount_oferta_vagas` só `postgres` + `service_role` (sem `authenticated`); `apply_due_*` com `IF auth.uid() IS NULL`.

---

## T4 — UI da rescisão e da adenda bilateral

### T4a — Design (gate obrigatório)

**O quê:** desenho do modal de rescisão e dos CTAs bilaterais.
**Onde:** artefactos em `.stitch/` + notas no handoff
**Depende de:** T1b, T2b, T3 **verdes**
**Requisitos:** S22-UI-03 · 04 · 06

**Tools:** UI Skills MCP (`list_skills` → `get_skill`, mín. `ibelick/baseline-ui`) · Stitch MCP (Project Resolution → projecto canónico «Boleia Certa») · shadcn MCP · Mobbin free-safe opcional (`mode: standard`, `limit ≤ 5`)

**Done when:**

- [x] UI Skills consultadas **antes** do prompt Stitch; constraints registadas
- [x] Project Resolution: `.stitch/metadata.json` → `list_projects` → se vazio, `create_project("Boleia Certa")` sem confirmação e persistir `projectId`
- [x] Ecrã/modal gerado no Stitch com as 3 opções e copy PT-PT modeless
- [x] Mapeamento para primitivos `src/components/ui/` + tokens de `src/index.css` (sem dump cego de HTML/TypeScript do vendor)
- [x] Gate «design pronto»: flow + estados (vazio/loading/erro/sucesso/offline) + componentes + artefacto Stitch + notas UI Skills

**Resultado (2026-09-06):** projecto `8575463146283895778` · ecrãs `a0ecae8f2e4b49188c3014bd4f4a2f39` (modal rescisão) e `f809c7c038f346f295c7dd1db36c5aab` (detalhe + CTAs). Mobbin degradado (plano pago). Notas no `design.md`.

**Verify:** artefacto Stitch referenciado no handoff e `.stitch/metadata.json` com o `projectId` canónico.

---

### T4b — Implementar UI

**O quê:** modal de rescisão + CTAs bilaterais em `/acordos`.
**Onde:** `src/components/TerminateAgreementModal.jsx` (novo, com teste), `src/pages/MyAgreements.jsx` (+ `MyAgreements.test.jsx`)
**Depende de:** T4a (gate aprovado)
**Reusa:** `FeedbackAlert`, `ConfirmationModal` (prop `busy`), primitivos shadcn, `getFriendlyErrorMessage`
**Requisitos:** S22-UI-01 · 02 · 03 · 04 · 05 · 06

**Done when:**

- [x] **Testes escritos primeiro e a falhar** (Testing Library, mensagens em português)
- [x] `TerminateAgreementModal.jsx` — props `{ isOpen, acordo, busy, onConfirm, onCancel }`; 3 opções; select `RESCISAO_JUSTIFICATIVAS` em `justa_causa` (sem textarea — o serviço só aceita enum; sem preview pro-rata); CTA desactivado enquanto inválido
- [x] Acessibilidade: `role="dialog"`, `aria-modal`, `aria-labelledby`; CTA destrutivo separado dos neutros e nunca alvo por omissão (Fitts)
- [x] `podeRenegociar = activo && (isMotorista || isPassageiroActivo)` em `MyAgreements`
- [x] Banner de adenda trata `pendente_contraparte` (CTAs para o motorista) e mostra «a aguardar resposta» ao criador
- [x] CTA «Rescindir acordo» visível para motorista e passageiro activo em acordo activo
- [x] `offlineQueued` → `FeedbackAlert` «Alteração agendada offline. Será sincronizada assim que recuperar rede.» (`role="status"`); rescisão offline «Aguardando sincronização…»; erro → `role="alert"`
- [x] Copy humana em Kz («Por passageiro», «Total do acordo»); **zero** jargon `N_contrato` / `N_proposto` / `POR_PASSAGEIRO` na interface
- [x] Nenhuma rota nova (o modal vive em `/acordos`) — nada a registar em `App.jsx`/`Layout.jsx`

**Verify:** `npx vitest run src/components/TerminateAgreementModal.test.jsx src/pages/MyAgreements.test.jsx` — **48/48 verde** (2026-09-06, follow-up UI QA 53f7f528).

**Follow-up UI QA (53f7f528, 2026-09-06):** erro de rescisão no `FeedbackAlert` **dentro** do modal; sucesso/offline no detalhe (overlay); banners `cancelamento_pendente` / consensual pendente com `type="success"` (sem sr-label de rede). Pronto para re-review `ui-qa`.

---

### T4c — Polish modeless no matching (P3, escopo mínimo)

**O quê:** avisos de capacidade não bloqueantes nos cards de match.
**Onde:** componentes de match existentes
**Depende de:** T4b
**Requisitos:** S22-UI-07

**Done when:**

- [ ] Avisos usam `FeedbackAlert role="status"` inline; **nenhum** modal bloqueante novo
- [ ] Sem redesign do mapa

**Verify:** testes existentes de matching verdes; inspecção visual no UI QA.

---

## T5 — Verificação e revisores

**O quê:** fechar o Epic com gates verdes e veredictos.
**Onde:** repositório completo
**Depende de:** T4b (T4c opcional)
**Requisitos:** todos

**Done when:**

- [ ] `npm run lint` limpo
- [ ] `npm run test:run` limpo (G1–G18 incluídos)
- [ ] Regressão PWA/offline (Waves 3–4) e matching sem falhas
- [ ] `ui-qa` via `Task` → `VERDICT: APPROVE` (UI Skills + browser + fidelidade Stitch)
- [x] Follow-up P0/P1 grants (REJECT a41e4d9e): `s22_rpc_grants_hardening` aplicado no remoto `boleia` — pronto para re-review
- [ ] `code-reviewer` via `Task` → `VERDICT: APPROVE` (ESLint, TDD, JSDoc, sem TS, sem segredos)
- [ ] Máx. 2 ciclos por gate; escalar ao utilizador se persistir `REJECT`
- [ ] `AGENTS.md` + `.specs/project/STATE.md` actualizados com o estado real (Done só quando estiver mesmo Done)
- [ ] Mensagem de commit preparada (`feat(acordos): …`) + `git status` — **sem** commit automático

**Verify:** ambos os revisores devolvem `VERDICT: APPROVE` e as duas suites correm limpas.

---

## Checklist de granularidade

| Task | Âmbito | Estado |
| ---- | ------ | ------ |
| T0 | 3 ficheiros de spec | ✅ Granular |
| T1a | 4 funções SQL numa migração | ✅ Coeso |
| T1b | 1 serviço + 1 ficheiro de teste | ✅ Granular |
| T1c | 2 cenários de auditoria | ✅ Granular |
| T2a | 5 colunas + 2 funções SQL | ✅ Coeso |
| T2b | 1 serviço + 1 ficheiro de teste | ✅ Granular |
| T2c | 1 cenário de auditoria | ✅ Granular |
| T3 | 1 função + 1 trigger | ✅ Granular |
| T4a | Artefacto de design | ✅ Granular |
| T4b | 1 componente novo + 1 página | ⚠️ 2 ficheiros — coeso (mesmo fluxo), manter junto |
| T4c | Polish inline | ✅ Granular |
| T5 | Gates e revisores | ✅ Granular |
