# Boleia Certa — Plano de Ação de Engenharia e Auditoria UI/UX

Este documento formaliza as decisões de arquitetura para fechar os gaps identificados no `@audit-report.md` [292], detalha os prompts para os nossos subagentes de IA e apresenta uma auditoria de UI/UX baseada em princípios consagrados de design de interação [74].

---

## 1. Decisões do Arquiteto Sénior (Respostas aos Gaps)

Para alinhar plenamente a implementação técnica com a **Visão e Fluxo de Produto** [301], adotei as seguintes decisões estruturais:

### A. Composição Explícita no Aceite (Task 4) [296, 693]
*   **Decisão:** Rejeitar totalmente o aceite implícito por `LIMIT` na transação Postgres [293, 296]. Se o grupo cresceu após a proposta e $N_{actual} > N_{proposto}$, a RPC `accept_proposal` deve exigir um array explícito de IDs de passageiros (`p_member_ids uuid[]`) [296].
*   **Comportamento:** A transação falha atomicamente se o número de IDs não coincidir exatamente com $N_{proposto}$ [293, 296].
*   **Impacto na UI:** No card de revisão da proposta, o condutor visualizará um ecrã modal interativo para selecionar quais os passageiros do grupo preencherão as vagas oferecidas antes de confirmar o acordo [296].

### B. Proteção contra Bypass de Segurança (Task 2 & 20) [692]
*   **Decisão:** Impedir que passageiros forcem o estado `'activo'` ao inserir-se numa tabela de membros por RLS direto [692]. 
*   **Regra técnica:** Adicionar uma política RLS `WITH CHECK` na tabela `membros_grupo` garantindo que, para utilizadores comuns, o estado do registo inserido seja exclusivamente `'pendente'` [692]. A ativação do membro só pode ser feita pelo administrador do grupo (owner) ou por uma RPC de sistema autorizada.

### C. Fluxo de Renegociação e Divisores (Task 6) [688]
*   **Decisão:** Estender o suporte da tabela `acordos_adendas` e expor RPCs bilaterais [688]. Ambas as partes (passageiro e motorista) podem propor adendas [688].
*   **Idempotência e Impasses:** Implementar a RPC `reject_agreement_adenda` para mudar o estado para `'REJEITADA'` e resolver impasses [694].
*   **Preço e Divisor:** Corrigir a lógica de cálculo na adenda do acordo para usar **sempre** o divisor de congelamento contratual ($N_{contrato}$) [305, 306], mesmo que passageiros saiam ($N_{activos}$ menor) [305, 306, 688]. É estritamente proibido recalcular retroativamente a quota dos restantes passageiros [306, 688].

### D. Redesign do Telefone Fallback (Task 19) [292]
*   **Decisão:** troca telefone por WhatsApp pode existir como mecanismo auxiliar de partilha e convite para criar ou entrar no grupo[292]


---

## 2. Prompts Estruturados para Orquestração de Subagentes

Abaixo encontram-se os prompts precisos para orquestrar os subagentes no teu workspace (ex: Cursor Composer / Subagentes Claude) de forma paralela e de acordo com as regras de **TDD Obrigatório** [291].

### Prompt 1: Subagente de Base de Dados e Segurança (Supabase Specialist)
**Atuação:** Arquiteto de Base de Dados Supabase (Postgres & RLS)

```markdown
Act as a Senior Database Engineer and Supabase Security Expert. 
Your goal is to implement and harden the database layer for "Boleia Certa" to resolve critical product gaps.

We enforce Spec-Driven Development and strict domain invariants at the Postgres level (RLS, constraints, and RPC definers). Do NOT write frontend code. Focus solely on supabase/migrations/ files.

### REQUIREMENTS TO IMPLEMENT:

1. Task 2 — Hardening Group Joins:
   - Modify the RLS insert policy for the table `membros_grupo` (or create a trigger/check).
   - Ensure that when a passenger inserts themselves (self-join request), the column `estado` is strictly forced to 'pendente'. Bypassing to 'activo' directly from the client must be impossible.

2. Task 3 & 4 — Explicit Proposal Acceptance with Capacity Verification:
   - Alter the secure RPC function `accept_proposal(p_proposal_id uuid, p_member_ids uuid[])`.
   - The RPC must verify if the proposal's frozen passenger capacity (N_proposto) matches the count of p_member_ids. If count(p_member_ids) != proposal.n_passageiros_propostos, fail atomically with RAISE EXCEPTION 'Capacidade inconsistente com proposta'.
   - Ensure the proposal creator is NOT the one accepting/rejecting (Contraparte enforcement). Raise an error if auth.uid() == created_by.
   - Insert selected p_member_ids into `acordos_passageiros` under 'activo' state.

3. Task 6 — Bilateral Amendment & Rejection (Visão §22):
   - Modify the `acordos_adendas` table to support check constraints for states: 'PENDENTE_CONTRAPARTE', 'REJEITADA', 'CANCELADA_INICIADOR', 'ACEITE_AGENDADA', 'EM_VIGOR'.
   - Create a new secure remote procedure call: `reject_agreement_adenda(p_adenda_id uuid)` which validates the counterparty is the current auth.uid(), sets the state to 'REJEITADA', and keeps the original pricing model unchanged.

### TDD GUIDELINES:
Identify existing migrations in `supabase/migrations/` and write clean, incremental SQL. Write your test assertions as a pgTAP test file or documented integration scenarios matching vitest database harnesses. Just output the clean SQL migration script.
```

### Prompt 2: Subagente de Serviços e Testes (Vitest & TDD Expert)
**Atuação:** Especialista em QA e Testes Unitários/Integração (TDD)

```markdown
Act as an SDET and Vitest Test Specialist. 
Our methodology requires Test-Driven Development (TDD) first. We do NOT write production code without having tests capturing the rules.

Your task is to write automated test suites in our Vitest suites (MarketplaceAuditScenarios.test.jsx, AgreementsE2E.test.jsx, GrupoService.test.js) to capture regression and cover the gaps.

### TEST CASES TO WRITE (TDD FIRST):

1. For Task 2 (Hardening Joins):
   - Write a test in `GrupoService.test.js`: "fails to insert group member with state 'activo' from passenger client role; forces state 'pendente' or rejects insert".

2. For Task 3 & 4 (Contraparte & Explicit Composition):
   - Write tests in `MarketplaceAuditScenarios.test.jsx`:
     - Test: "user = created_by calls accept_proposal -> fails with Counterparty error".
     - Test: "accept_proposal with N_proposto=2 but p_member_ids array has 3 elements -> fails with Capacity Inconsistency".
     - Test: "accept_proposal with correct explicit passenger ids list -> successfully creates agreement and maps correct passenger ids".

3. For Task 5 (Proposal Snapshot non-mutation):
   - Test in `GrupoService.test.js`: "after syncNCandidato runs due to group growth, existing proposals' n_passageiros_propostos remain completely unmodified".

4. For Task 6 (Adenda Rejection):
   - Test in `AgreementsE2E.test.jsx`: "after reject_agreement_adenda, adenda state becomes 'rejeitada' and active pricing is preserved without retroactive changes".

Ensure all test files compile. Execute the Vitest runner. Mock Supabase responses cleanly if running as a unit suite, representing true database schemas and tiped errors.
```

### Prompt 3: Subagente UI/UX (Stitch MCP Workflow & React Specialist)
**Atuação:** Especialista Frontend, Design de Interação e Integração Stitch

```markdown
Act as a Senior React Frontend Developer and Stitch UI Specialist. 
Your goal is to align the React client interface with our software architecture and product vision.

We are updating the user interfaces: PassengerDashboard, DriverDashboard, MyAgreements, and PropostaReviewCard.

### UI IMPLEMENTATIONS:

1. Task 4 — Explicit Group Member Picker:
   - In `PropostaReviewCard` and proposal review screens, if N_actual (active members in the group) is greater than N_proposto, render an elegant, modeless selection interface (checkboxes) showing the names of group members.
   - Force the driver/passenger to explicitly choose which N_proposto passengers will be included in the contract before the "Aceitar Proposta" CTA becomes active.
   - Pass this array of passenger IDs to `PropostaService.acceptProposal(proposalId, selectedMemberIds)`.

2. Task 6 — Bilateral Amendment & Rejection UI:
   - On the `MyAgreements` page, render proposed amendments (adendas) with counterparty actions.
   - Add a "Rejeitar Alteração" button alongside "Aceitar Alteração". When clicked, call `AgreementService.rejectAdenda(adendaId)`, showing non-intrusive modeless notifications.
   - Ensure the total agreement price divides strictly by N_contrato on screen calculations.

3. Task 19 — Phone Fallback Redesign:
   - In `GrupoProcuraPanel`, move the prominent phone-search input and the "Ou convidar por telefone" trigger to a secondary, collapsible section titled "Fallback: Convidar por telefone". Prioritize public search, discovery, and marketplace matches in the main viewport. Via WhatsApp can serve as an auxiliary mechanism for sharing and inviting people to create or join groups within the product, instead phone.

Maintain clean Material Design 3 guidelines. Ensure tests in `PassengerDashboard.test.jsx` and `propostaReview.test.js` pass cleanly.
```

---

## 3. Auditoria Heurística Profunda de UI & UX

Esta auditoria baseia-se nos princípios de **About Face (Design Dirigido a Metas)** [73, 74], nas **Leis de UX** [186] e no **Emotional Design** [1] para elevar a qualidade do Boleia Certa.

### Heurística 1: Postura da Plataforma (Platform Posture) [209]
*   **Princípio de Cooper:** Os dashboards do passageiro e motorista são aplicações de **Postura Soberana (Sovereign Posture)** [209]. Os utilizadores passam períodos de foco concentrado gerindo os seus trajetos diários e acordos mensais [209, 307].
*   **Recomendação de UX:** Devem ser ricas em dados, mas limpas, reduzindo o trabalho administrativo (excise) [78]. Devemos evitar pop-ups intrusivos e **privilegiar o feedback rico e modeless** [82], como painéis colaterais informativos de estado ou avisos que não interrompam a navegação [82].

### Heurística 2: Lei de Fitts e Mitigação de Erros Sob Stress [187]
*   **Princípio de Fitts (Aviation Study):** Pilotos em situações de emergência confundiam as alavancas do trem de aterragem e dos flaps porque eram idênticas e estavam muito próximas [187].
*   **Impacto no Boleia Certa:** No trânsito caótico de Luanda, condutores e passageiros sob stress não podem cometer o erro de aceitar/rejeitar propostas acidentalmente.
*   **Recomendação de UX:** Os botões críticos de ação contraditória (como *"Aceitar"* e *"Rejeitar"*) devem possuir **tamanhos, formas e cores radicalmente diferentes** [187], com espaçamento generoso de toque (mínimo $48\times48\,\text{px}$) para evitar o toque acidental (fat-finger errors) [187]. Nunca usar botões primários idênticos lado a lado.

### Heurística 3: Auditoria, Não Edição (Audit, Don't Edit) [85, 86, 424, 425]
*   **Princípio de Usabilidade:** *"A aplicação deve aceitar o que o utilizador introduz de forma imune, reportando avisos modeless indevidos em tempo real em vez de bloquear com pop-ups de erro paranoicos"* [85, 424, 425].
*   **Aplicação no Boleia Certa:** No ecrã de matching de rotas, se a geolocalização do passageiro divergir ligeiramente do trajeto clássico do motorista, a UI não deve mostrar um ecrã bloqueante de erro [82, 85].
*   **Recomendação de UX:** Usar linhas onduladas ou indicadores discretos (como o corretor ortográfico do MS Word [86, 425]) para sinalizar a discrepância geo, sugerindo desvios alternativos de forma passiva e amigável [85, 86, 425].

### Heurística 4: Design Emocional e Construção de Confiança (Emotional Design) [1, 188]
*   **Princípios de Don Norman e Spool (Aesthetic-Usability Effect):** Elementos esteticamente agradáveis e que transmitem previsibilidade criam laços de confiança [1, 27].
*   **Google Trust-Time Pattern:** Acelerar instantaneamente uma pesquisa com uma resposta vazia gera ceticismo [188]. Estender ligeiramente o tempo de processamento com animações detalhadas gera a sensação de que um trabalho de matching complexo foi feito de forma rigorosa [188].
*   **Recomendação de UX:** Ao carregar rotas compatíveis, exibir uma animação elegante de *"Boleia Certa está a calcular a rota ideal e a otimizar as vagas..."* [188]. O uso do logotipo oficial (`boleia-logo.png`) e um esquema de cores estudado (evitar vermelho genérico que sinaliza "perda financeira" [95]) reforçam a credibilidade do produto.

### Heurística 5: Robustez Offline PWA e Resiliência Técnica [17, 18, 46]
*   **Unstable Connections:** No contexto de Luanda, as falhas de rede móvel são constantes [46]. A robustez técnica determina o sucesso da adoção.
*   **Recomendações técnicas de PWA:**
    *   **Indicador Modeless de Rede:** Um banner persistente, mas discreto, na barra superior mostrando *"Estás offline. As tuas propostas serão enviadas assim que a ligação regressar."* [46, 88].
    *   **Fila Idempotente em Segundo Plano:** Utilizar service workers para enfileirar as ações do utilizador localmente em IndexedDB [18, 46]. As ações como licitação de propostas devem usar `idempotency_key` (já estruturada na nossa RPC `accept_proposal` [292, 704]) para evitar transações duplicadas em reenvios automáticos sob sinal instável [292, 704].

---

### 4. Checklist de Critério de "Feito" (Definition of Done) [309, 310]

Para que qualquer Gap/Task deste plano seja considerado **concluído**, ele deve passar pelo crivo de consistência de 6 níveis [309]:
1.  [ ] **Produto:** Funcionalidade plenamente descrita no fluxo de negócio.
2.  [ ] **Spec:** Registada no diretório `.specs/features/`.
3.  [ ] **Banco de Dados:** Tabelas, RLS e RPCs migrados de forma segura.
4.  [ ] **Serviços:** Cobertura do ciclo de vida nos scripts JS de domínio.
5.  [ ] **UI:** Interface interativa integrada na dashboard.
6.  [ ] **Testes:** Suite Vitest local a passar e validada pelo subagente Verificador [683].

---
