# Contexto e Regras de Desenvolvimento (Boleia Certa)

## 1. O Projeto (MVP)
Plataforma de *matchmaking* para rotas de transporte diário e acordos de pagamento partilhado.
Stack: React + Vite, Tailwind CSS, Lucide React, shadcn/ui (JSX), Supabase (Backend/Auth/DB), **Graphify** (extracção AST → `graphify-out/`) + **Graphlore** MCP (navegação no Cursor). Tudo alojado de forma 100% gratuita.

### 1.1 Graphify + Graphlore (navegação de código)

* **Graphify** extrai o grafo de conhecimento (AST local, arestas **EXTRACTED**) para `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`). Ignore: `.graphifyignore`. Install: `uv tool install graphifyy` (PyPI, dois y; CLI = `graphify`).
* **Graphlore** é o **único** MCP de grafo no Cursor (`.cursor/mcp.json`, `GRAPHLORE_TOOLSET=lean`) — tools: overview / search / neighbors / subgraph / node_details / communities / freshness / build. **Não** instalar dual `code-review-graph` + `graphify.serve`.
* **Install Graphlore:** não está no PyPI — `uv tool install "graphlore[treesitter]" --from git+https://github.com/yasinyaman/graphlore.git` (recibo local confirma Git URL + extra `treesitter`).
* **Ordem (lean):** `graphlore_overview` / `freshness` (ou `GRAPH_REPORT.md`) → `graphlore_search` → `subgraph` / `neighbors` / `node_details` → Grep/Read só se o mapa estrutural não bastar. Preferir grafo a Grep para arquitectura e blast radius.
* **Arestas INFERRED** = hipóteses (verificar). Princípios: `graph-doc.md`; regra always-on: `.cursor/rules/graphify.mdc`.
* **Freshness:** hooks pós-commit refrescam AST; após docs/specs → `npm run graphify:update` (update semântico).

## 2. Princípios de "Vibe Coding" com Disciplina (O Método Akita)
* **TDD Obrigatório (Test-Driven Development):** Todo o código funcional deve ser precedido por testes no Vitest. É estritamente proibido escrever a implementação antes dos testes. O fluxo é: 1. Escrever Testes (e mockar o necessário) -> 2. Executar (vão falhar) -> 3. Escrever Código -> 4. Passar nos Testes.
* **Spec-Driven obrigatório (tarefa nova):** Ler e seguir `.cursor/skills/tlc-spec-driven` antes de Designer/Implementer. Auto-size (Quick / Spec / Design / Tasks). Artefactos em `.specs/`.
* **Paralelismo:** Com ≥2 tasks independentes, ler `.cursor/skills/subagent-creator` e lançar `Task` em paralelo só com scopes de ficheiros disjuntos.
* **Loop multi-agente:** Orquestrador → papéis em `.cursor/skills/boleia-agent-loop/` (ui-designer, implementer, ui-qa, code-reviewer). Contrato `VERDICT: APPROVE|REJECT`. Máx. 2 ciclos por gate. Ver `.cursor/rules/multi-agent-loop.mdc`.
* **Supabase MCP Exclusivo:** Para quaisquer alterações na base de dados (DDL ou migrações), utilizar exclusivamente o Supabase MCP. Nada de escrever SQL manual solto ou executar lógicas de alteração fora do MCP.
* **Modularidade:** Mantém os ficheiros pequenos e o código altamente modular. Se um ficheiro crescer demasiado, para e sugere uma refatoração.
* **Um Passo de Cada Vez:** Resolve apenas o problema que foi pedido no prompt. Não tentes prever e construir funcionalidades futuras não solicitadas.
* **Segurança Primeiro:** Nunca coloques passwords, chaves de API (como a do Supabase) ou tokens hardcoded no código. Usa sempre variáveis de ambiente (`.env`).
* **Sem Confirmações Cegas:** Se te deparares com uma ambiguidade arquitetónica, para e pergunta. Não tomes o caminho de menor resistência se isso comprometer a qualidade.
* **Refatoração Contínua:** Constantemente procura código morto, duplicações ou lógicas pesadas e sugere melhorias.
* **Integração de Rotas Contínua:** Sempre que criares uma nova página (`.jsx`), tens OBRIGATORIAMENTE de ir ao ficheiro `src/App.jsx` e registar a nova rota correspondente dentro do `react-router-dom`. Além disso, deves verificar se os links de navegação (como os do `Layout.jsx`) precisam de ser atualizados para apontar para a nova página.
* **REGRA DE OURO UI:** Gerador SoT = **Stitch MCP** + sincronia obrigatória com **UI Skills MCP** (antes do prompt e no QA) + tokens em `src/index.css` + primitivos shadcn em `src/components/ui/`. Mobbin free-safe opcional. **v0/One só fallback.** É proibido inventar ecrãs novos sem passar pelo fluxo §4. Penpot/Superdesign **não** são SoT. Ponte: `.cursor/skills/boleia-stitch` + `skills/`.

## 3. Como a IA deve atuar
Lê este documento antes de iniciares qualquer nova funcionalidade. Tarefa nova → `tlc-spec-driven` primeiro. Se eu te pedir para criar um componente X, após o Spec/Quick a primeira entrega de código DEVE ser o ficheiro de teste para esse componente X (TDD).

## 4. Design workflow (Stitch + UI Skills + shadcn + Mobbin + Cursor)

* **Papéis:** Stitch = gerador SoT de ecrãs · UI Skills = constraints + polish (obrigatório sync) · Mobbin = referências free-safe opcionais · shadcn = primitivos no repo · Cursor = Spec, orquestração, implementação, Visual QA · v0/One = **fallback** apenas.
* **MCP:** `user-stitch` (generate/edit/get screens); `user-UI Skills MCP` (`list_skills` / `get_skill`); `plugin-shadcn-shadcn`; `plugin-mobbin-mobbin` (só free-safe). Skills vendor em `skills/` (`stitch-loop`, `design-md`, `enhance-prompt`, `react-components`, `shadcn-ui`) via ponte `.cursor/skills/boleia-stitch` (**JSX only**, sem TypeScript). **Não** usar `user-penpot` como gate.
* **Mobbin free-safe:** `mode: "standard"` (nunca `deep`), `limit` ≤ 5, `platform: "web"`. Se MCP falhar por plano free → degradar sem bloquear (UI Skills + Stitch + tokens locais).
* **Stitch:** `list_projects` / `create_project` → `generate_screen_from_text` / `edit_screens` → `get_screen` / `list_screens`. Artefactos: `.stitch/DESIGN.md`, `.stitch/SITE.md`, `.stitch/metadata.json`, `.stitch/designs/`. Confirmar com o utilizador antes de criar projectos Stitch órfãos em massa.
* **v0 fallback:** só se Stitch down ou pedido explícito; anti-plano-só se usado. Confirmar antes de create/deploy Vercel.
* **Contexto Visual Imutável:** mobilidade urbana, boleias diárias casa-trabalho em Luanda, Angola. Moeda SEMPRE Kz. Tom urbano, utilitário, de confiança — nunca turismo/férias.
* **Reutilização:** privilegiar componentes em `src/components/ui/` e padrões já no `src/`; novos só via shadcn registry + adaptação JSX. **Proibido** dump cego do HTML Stitch.
* **Fluxo canónico (A–F):**
  1. **0 — Spec:** `tlc-spec-driven` (artefacto `.specs/` ou `quick/`).
  2. **A — UX:** requisitos, user flow, estados (vazio, loading, erro, sucesso).
  3. **B — UI Skills (+ Mobbin opcional):** `list_skills` / `get_skill` (ex. `ibelick/baseline-ui`); constraints no prompt.
  4. **C — Design Stitch:** `enhance-prompt` + `DESIGN.md` → generate/edit via `user-stitch`; opcional `design-md`.
  5. **D — shadcn:** search → add command → instalar JSX; mapear tokens `--color-primary`, etc.
  6. **Gate — design pronto:** flow + estados + componentes shadcn + ecrã/artefacto Stitch + notas UI Skills.
  7. **E — Implementation:** TDD → `src/` alinhado à arquitectura (react-components **adaptado JSX**).
  8. **F — QA:** UI QA (browser + UI Skills + fidelidade Stitch) + Code Reviewer; `VERDICT` APPROVE/REJECT (máx. 2 ciclos).
## 5. Master Version Control (Commit)
* Seguimos "Commit Often, With Clear Messages".
* O orquestrador **não** faz commit automático: prepara mensagem + `git status` e só faz commit quando o utilizador pedir explicitamente (e testes verdes).
* Tipos válidos: `feat`, `fix`, `ui`, `refactor`, `test`, `chore`.
* Proibido commit com testes a vermelho.

## 6. Débito Técnico / Próximos Passos
* **Marketplace Oferta/Procura é a fonte de verdade do domínio:** `ofertas_capacidade` (motorista) ↔ `procuras`/`grupos` (passageiro) ↔ `propostas` ↔ `acordos` 1:N (+ `acordos_passageiros`). A tabela `routes` e o fluxo `requestSeat` 1:1 foram **descontinuados e removidos**.
* **Geocoding:** `LocationService.js` (Photon API / OpenStreetMap, `countrycode=ao`) — coordenadas OD nas ofertas/procuras. Sem Google Maps / `VITE_GOOGLE_MAPS_API_KEY`.
* Serviços canónicos: `OfertaService`, `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService` (RPC `accept_proposal`), `MatchingService`, `WaitlistService`, `AbsenceService`.
* Testar fluxo de sessão em produção após deploy no Vercel.
* **Agent loop:** regras em `.cursor/rules/` (incl. `graphify.mdc`), skills em `.cursor/skills/boleia-agent-loop/`, hooks em `.cursor/hooks.json`.
* **Grafo:** consultar Graphlore **antes** de Grep em massa (ver §1.1).

## 7. Acordos (Agreements)
Um Acordo (`acordos`) é **1 motorista : N passageiros** (`acordos_passageiros`). Estados do cabeçalho: `'activo' | 'cancelado'` (e afins); na UI comparar **case-insensitive**. Preços congelados na aceitação (`N_contrato`, `valor_mensal_por_passageiro_kz` / total). Saída de passageiro **não** recalcula quotas do mês. Gestão: **exclusivamente** `MyAgreements.jsx` (`/acordos`). Proibido reintroduzir `requestSeat` / acordo 1:1 com `passenger_id` no cabeçalho.

## 8. Rotas e Navegação (Estrutura de Componentes)
A aplicação usa um componente `<Layout>` global que envolve todas as páginas autenticadas e inclui a `BottomBar` de navegação inferior. A árvore de navegação é:

```
<App>
  <BrowserRouter>
    ├── /                 → <LandingPage />   (redireciona por perfil se autenticado)
    ├── /auth             → <Auth />          (pública)
    └── <Layout>          (global, contém <BottomBar>)
        ├── /passageiro   → <PassengerDashboard />
        ├── /motorista    → <DriverDashboard />
        ├── /veiculo      → <VehicleSetup />
        ├── /publicar-trajeto → <PublishRoute />
        ├── /acordos      → <MyAgreements />  ← PADRÃO (único componente de acordos)
        ├── /faltas       → <AbsenceTracker /> (inclui /faltas/:acordoId)
        └── /perfil       → <Profile />
```

**BottomBar** liga as 4 secções principais: **Início**, **Acordos/Rotas**, **Faltas** e **Perfil**.

## Diretrizes de Desenvolvimento e UI/UX

REGRA ABSOLUTA DE DESIGN (STITCH + UI SKILLS SYNC):
Gerador SoT = **Stitch MCP** + **UI Skills MCP** (sync obrigatório) + shadcn JSX + tokens `src/index.css`. v0/One só fallback. Só implementar depois do gate “design pronto”. Não inventar ecrãs novos sem o fluxo §4. Penpot não é SoT. Ver `.cursor/rules/ui-stack.mdc` e `.cursor/skills/boleia-stitch`.

## 9. Manutenção do Contexto (DRY)
**REGRA ABSOLUTA:** Esta secção do documento (`CONTEXT.md` e `AGENTS.md`) tem de ser **obrigatoriamente atualizada** sempre que uma nova funcionalidade for implementada, refatorada ou corrigida. O objetivo central é garantir que qualquer Agente de IA que leia este ficheiro saiba com exatidão o ponto de situação do projeto, evitando redundâncias, reinvenção da roda ou duplicação de lógicas já existentes (DRY - Don't Repeat Yourself). Antes de iniciar qualquer tarefa, o agente deve assumir este relatório como a única fonte de verdade arquitetónica.

🏛️ Relatório de Estado da Arquitetura: Boleia Certa
**Última Atualização:** 5 de Setembro de 2026  
**Fase Atual:** Marketplace Oferta/Procura (Phase 6: **T22–T31 Done**; T29+T30 uncommitted) + **Phase 7 completa** (**T32–T35 Done** uncommitted) + **Landing refresh** + **Agent loop Cursor** + **Gamma Done** (R2 hub motorista waitlist CTA + R4 copy sem zona) + **Graphify/Graphlore governance** + **Stitch + UI Skills sync** (SoT UI). Spec: `.specs/features/marketplace-oferta-procura/`. Checkpoint: `CHECKPOINT.md`.

**O que já está implementado e validado:**
1. **Infraestrutura e Backend (Supabase):**
 * **Domínio marketplace:** `ofertas_capacidade`, `procuras`, `grupos`, `membros_grupo`, `propostas`, `lista_espera`, `acordos` (1:N), `acordos_passageiros`, `faltas`. RPC `accept_proposal` atómica. Sem tabela `routes` / RPCs seats legados.
 * **Veículos:** `capacidade_total` / `vagas_passageiros` (= total − 1). Modo preço: `POR_PASSAGEIRO` | `TOTAL_ACORDO` (copy UI humana: «Por passageiro» / «Total do acordo»).
 * **Matching MVP:** ±15 min, raio OD 2500 m (haversine); `N_actual > vagas` → waitlist. Quatro Ns: `N_actual` · `N_proposto` · `N_contrato` · `N_activos`. Dias: intersecção real (`dias_semana` em oferta **e** procura); vazio/ausente → incompatível.
 * **Grupo vivo:** pode estar abaixo de `n_maximo` e continuar negociável; propostas capturam `N_proposto` snapshot; preço na oferta/proposta do motorista (não no grupo).
 * **Faltas:** `desconto_kz` por dia útil do mês a partir da quota congelada — **sem** divisor `/ 4`.
 * **Adenda (T29 + R3):** RPC `renegotiate_agreement_pricing` agenda adenda `pendente_passageiro`; passageiro activo confirma via `accept_agreement_adenda` → `aceite`; `apply_due_agreement_adendas` só aplica `aceite` após `effective_from`. Auth renegociar = motorista; leave **não** recalcula.
 * **P0 hardening (2026-09-05):** RPC `leave_passenger` (saiu + vagas + waitlist); sem UPDATE client em `propostas`/`acordos`/`acordos_passageiros`/`lista_espera`; membros: owner gere; self só reabre `pendente`.
 * **Auth/Push PRESERVE:** `perfis`, `notificacoes`, `push_subscriptions`, Edge `send-push` (VAPID).
2. **Frontend e Interface (React / Vite):**
 * **Layout & paths:** `/` Landing (refresh: `src/components/landing/*` — hero CSS sem stock, menu mobile `createPortal`, copy marketplace), `/auth`, `/passageiro` (procura/matches/waitlist + **grupo** via `GrupoProcuraPanel`), `/motorista` (ofertas + propostas), `/veiculo`, `/publicar-trajeto` («Publicar oferta»), `/acordos` (`MyAgreements` 1:N + **adenda**), `/faltas`, `/perfil`.
 * **Landing refresh (LP-01…07):** `LandingHeader` / `LandingHero` / HowItWorks / Benefits / Security / Cta / Footer; âncoras `#como-funciona` `#vantagens` `#seguranca`; v0 chat `faoKylQkkKB` (UI gerada); Mobbin degradado (plano free). Spec: `.specs/features/landing-refresh/`.
 * **Hub motorista mapa (T30):** `PreferentialPointsMap` (MapLibre + OSM) em `PropostaReviewCard` — pins 1-based dos pontos preferenciais do snapshot antes do aceite; v0 `jIH3o5n1EM1`.
 * **Grupo (T22–T23 + T31):** criar grupo com `n_maximo`; membros activos; descoberta pública + pedir entrada / aprovação; telefone = fallback; pickup opcional; sync `N_actual`; `createProposta` com `grupo_id` + `N_proposto = N_actual`; **não** bloquear por «grupo incompleto»; sync **não** invalida propostas abertas.
 * **Hub motorista (T24):** `PropostaReviewCard` + `enrichPropostasForReview` / `propostaReview` — lista snapshot + pickup + preço resolvido (copy humana); Aceitar → RPC `accept_proposal`.
 * **E2E quotas (T25):** TOTAL_ACORDO N=3/4 + resto; `leavePassenger` não altera cabeçalho nem `quota_mensal_kz` dos restantes (`AgreementsE2E.test.jsx`).
 * **Waitlist promoção (T26):** `promoteWaitlist` → RPC `promote_waitlist` (1º FIFO → `notificada` + notif `waitlist_promoted`); hook em `leavePassenger` (best-effort); UI hub com estados activa/notificada; **sem** auto-aceitar.
 * **Publicar oferta (T27+T34):** `PublishRoute` — dias + «Oferta flexível»; flexível **sem** OD (campos OD escondidos); fixa exige OD; `OfertaService.resolveOdFields`.
 * **Detalhe acordo (T28):** `MyAgreements` — bloco «Preço combinado»/congelado; lista N pax; destaque quota passageiro; falta só se activo; `ConfirmationModal` `busy`.
 * **Adenda (T29 + R3):** motorista → «Renegociar preço»; passageiro → CTA «Aceitar adenda» quando `pendente_passageiro`; após aceite, banner «Novo preço a partir de …».
 * **Deep linking:** `notificationRouter.js` — `proposal_received` → hub da **contraparte** (`metadata.inbox`: `passageiro`|`motorista`); `waitlist_promoted`, `match_available`, etc.
 * **AuthContext:** `{ session, user, loading, tipoPerfil, profile, refreshProfile }`.
 * **Design SoT:** Stitch MCP + UI Skills sync + shadcn (`src/components/ui/`) + Mobbin free-safe; v0/One só fallback. Ponte `.cursor/skills/boleia-stitch` + `skills/`. Penpot não é SoT.
 * **Agent loop:** `.cursor/skills/boleia-agent-loop/`, `.cursor/rules/ui-stack.mdc`, `.cursor/rules/multi-agent-loop.mdc`, `.cursor/rules/graphify.mdc` (grafo antes de Grep), hooks `subagentStop`.
 * **Produto (2026-09-05):** oferta fixa vs flexível (sem OD/zona no flex); propostas A/B; aceite só contraparte; Procura→M propostas→1 acordo 1:N. **T32–T35 Done** (Phase 7 completa).
3. **Serviços canónicos (`src/services/`):**
 * `OfertaService`, `ProcuraService` (`dias_semana` default Seg–Sex), `GrupoService` (`createGrupo`, `getGrupoByProcura`, `listMembrosGrupo`, `addMembroGrupo`, `syncNCandidato`), `PropostaService`, `AgreementService` (`createAgreementFromProposal`, `leavePassenger`, **`renegotiateAgreementPricing`**, **`acceptAgreementAdenda`**), `MatchingService` (`findCompatibleOfertas`, **`findCompatibleProcuras`** dual fixa/flex), `WaitlistService` (`enqueueWaitlist`, `promoteWaitlist`, listagens), `AbsenceService`, `LocationService` (Photon), `ProfileService.findPassageiroByTelefone`.
 * **Removido:** `RouteService`, `AgreementsService` (`requestSeat`), cards `Acordo*` acoplados a `routes`.
4. **Utils:** `pricing.js`, `geo.js`, `matchingConfig.js`, `matchingFilters.js`, `resolveAgreementPricing.js`, `propostaInbox.js`, `notificationRouter.js`.
5. **Geocoding OSM (mantido):** Photon `countrycode=ao`; Autocomplete «Powered by OpenStreetMap».
6. **UI copy:** nunca expor jargon (`N_actual`, `N_proposto`, `N_candidato`, `POR_PASSAGEIRO`) — só labels humanas («Grupo · 2 pessoas», «Por passageiro», «Total do acordo»).

 * **Alpha audit G1–G4 Done:** `src/pages/MarketplaceAuditScenarios.test.jsx` — contrato `createAgreementFromProposal` / `leavePassenger` (cascata irmãs via RPC, N_actual < N_proposto, overbooking, leave sem recálculo cliente).

 * **Beta Done (R1 + R3):** matching por `dias_semana` em `procuras` + intersecção obrigatória; consentimento de adenda (`acordos_adendas.estado` `pendente_passageiro`|`aceite`, RPC `accept_agreement_adenda`, CTA em `/acordos`). Migrações MCP: `procuras_dias_semana`, `adenda_consentimento_passageiro`.

**Próximo:** Phase 7 **completa** (T32–T35). **Fora do MVP:** zonas/polígonos/raio residencial. Commits T29/T30/T32–T35 / Beta só se o utilizador pedir.
