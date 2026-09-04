# Contexto e Regras de Desenvolvimento (Boleia Certa)

## 1. O Projeto (MVP)
Plataforma de *matchmaking* para rotas de transporte diário e acordos de pagamento partilhado.
Stack: React + Vite, Tailwind CSS, Lucide React (Frontend); Supabase (Backend/Auth/DB). Tudo alojado de forma 100% gratuita.

## 2. Princípios de "Vibe Coding" com Disciplina (O Método Akita)
* **TDD Obrigatório (Test-Driven Development):** Todo o código funcional deve ser precedido por testes no Vitest. É estritamente proibido escrever a implementação antes dos testes. O fluxo é: 1. Escrever Testes (e mockar o necessário) -> 2. Executar (vão falhar) -> 3. Escrever Código -> 4. Passar nos Testes.
* **Supabase MCP Exclusivo:** Para quaisquer alterações na base de dados (DDL ou migrações), utilizar exclusivamente o Supabase MCP. Nada de escrever SQL manual solto ou executar lógicas de alteração fora do MCP.
* **Modularidade:** Mantém os ficheiros pequenos e o código altamente modular. Se um ficheiro crescer demasiado, para e sugere uma refatoração.
* **Um Passo de Cada Vez:** Resolve apenas o problema que foi pedido no prompt. Não tentes prever e construir funcionalidades futuras não solicitadas.
* **Segurança Primeiro:** Nunca coloques passwords, chaves de API (como a do Supabase) ou tokens hardcoded no código. Usa sempre variáveis de ambiente (`.env`).
* **Sem Confirmações Cegas:** Se te deparares com uma ambiguidade arquitetónica, para e pergunta. Não tomes o caminho de menor resistência se isso comprometer a qualidade.
* **Refatoração Contínua:** Constantemente procura código morto, duplicações ou lógicas pesadas e sugere melhorias.
* **Integração de Rotas Contínua:** Sempre que criares uma nova página (`.jsx`), tens OBRIGATORIAMENTE de ir ao ficheiro `src/App.jsx` e registar a nova rota correspondente dentro do `react-router-dom`. Além disso, deves verificar se os links de navegação (como os do `MainLayout.jsx`) precisam de ser atualizados para apontar para a nova página.
* **REGRA DE OURO UI:** O **Penpot é a fonte de verdade do design**. É estritamente proibido inventar ou adivinhar layouts/estilos Tailwind para ecrãs novos relevantes. Antes de criar ou alterar UI, o agente deve **consultar no Penpot** componentes, estilos e tokens existentes e **privilegiar reutilização e consistência**. Superdesign é só exploração visual; consolidação e SoT ficam no Penpot. Implementação no `src/` pela arquitectura real do projeto + Visual QA no browser.

## 3. Como a IA deve atuar
Lê este documento antes de iniciares qualquer nova funcionalidade. Se eu te pedir para criar um componente X, a tua primeira resposta DEVE ser o código do teste para esse componente X.

## 4. Design workflow (Penpot + Superdesign + Cursor)

* **Papéis:** Penpot = fonte de verdade do design · Superdesign = exploração visual auxiliar · Cursor = análise UX + implementação + Visual QA.
* **MCP:** `user-penpot` (consultar estrutura, componentes, tokens; `export_shape` para QA). Skills vendor Stitch (`enhance-prompt`, `react-components`, `stitch-loop`, `design-md`, `remotion`) estão **descontinuadas** neste projeto — não as invocar.
* **Contexto Visual Imutável:** A aplicação é estritamente sobre mobilidade urbana, transporte partilhado e boleias diárias (casa-trabalho) em Luanda, Angola. A moeda a utilizar é SEMPRE o Kwanza (Kz). O tom visual deve ser urbano, utilitário, de confiança e focado na rotina, NUNCA focado em turismo ou viagens de férias. Este briefing aplica-se à análise UX e ao Penpot (já não a “prompts Stitch”).
* **Reutilização obrigatória:** Antes de criar ou alterar UI, consultar no Penpot os componentes, estilos e tokens já existentes; não inventar variantes paralelas nem adivinhar o design system a partir do código ou de exploração solta.
* **Fluxo canónico (A–E):**
  1. **A — Product / UX analysis (Cursor):** requisitos, user flow, estados principais (vazio, loading, erro, sucesso e estados de negócio).
  2. **B — UX structure:** mapear ecrãs e componentes; identificar o que já existe no Penpot para reutilizar.
  3. **C — Visual design:** [opcional] exploração no Superdesign → **consolidar no Penpot** (MCP); actualizar tokens/componentes/telas.
  4. **Gate — design pronto para implementação** (só avançar para código quando **todas** forem verdadeiras):
     - user flow definido;
     - estados principais cobertos;
     - componentes identificados (reutilizar os do Penpot; novos só se não existirem);
     - telas consolidadas no Penpot (não só exploração Superdesign / mock solto).
  5. **D — Implementation (Cursor):** TDD → implementar no `src/` alinhado ao Penpot e à arquitectura do repo (não dump de export externo).
  6. **E — Visual QA:** browser / Playwright contra Penpot (`export_shape` / snapshot) + testes existentes a verde.

## 5. Master Version Control (Commit Automático)
* Seguimos a regra de "Commit Often, With Clear Messages" do roadmap de Vibe Coding.
* O **Agente Integrador** (ou o último agente a trabalhar numa *feature*) tem a OBRIGAÇÃO de fazer o commit do código SE, E SÓ SE, todos os testes (QA, AST Validator) passarem a 100% (Verde).
* **Fluxo de Git Obrigatório após o Sucesso:**
  1. Executar `git add .`
  2. Executar `git commit -m "[Tipo]: Breve descrição do que foi feito e porquê"`. (Tipos válidos: `feat`, `fix`, `ui`, `refactor`, `test`, `chore`). A mensagem de commit deve ser clara e explicar *o que* mudou e *porquê*.
  3. Executar `git push`.
* Se os testes estiverem a falhar, o agente é ESTRITAMENTE PROIBIDO de fazer commit do código quebrado.

## 6. Débito Técnico / Próximos Passos
* **Marketplace Oferta/Procura é a fonte de verdade do domínio:** `ofertas_capacidade` (motorista) ↔ `procuras`/`grupos` (passageiro) ↔ `propostas` ↔ `acordos` 1:N (+ `acordos_passageiros`). A tabela `routes` e o fluxo `requestSeat` 1:1 foram **descontinuados e removidos**.
* **Geocoding:** `LocationService.js` (Photon API / OpenStreetMap, `countrycode=ao`) — coordenadas OD nas ofertas/procuras. Sem Google Maps / `VITE_GOOGLE_MAPS_API_KEY`.
* Serviços canónicos: `OfertaService`, `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService` (RPC `accept_proposal`), `MatchingService`, `WaitlistService`, `AbsenceService`.
* Testar fluxo de sessão em produção após deploy no Vercel.

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

REGRA ABSOLUTA DE DESIGN E INTERFACE (PENPOT-FIRST):
O **Penpot** é o Design System e a única fonte de verdade visual. Antes de criar/alterar UI, consultar componentes, estilos e tokens no Penpot e privilegiar reutilização. Superdesign só para exploração; aprovação → consolidar no Penpot. Só implementar depois do gate “design pronto” (user flow + estados principais + componentes identificados + telas consolidadas no Penpot). É estritamente proibido inventar designs, estilos Tailwind ou fluxos de UX diretamente no código quando há ecrã novo relevante.

## 9. Manutenção do Contexto (DRY)
**REGRA ABSOLUTA:** Esta secção do documento (`CONTEXT.md` e `AGENTS.md`) tem de ser **obrigatoriamente atualizada** sempre que uma nova funcionalidade for implementada, refatorada ou corrigida. O objetivo central é garantir que qualquer Agente de IA que leia este ficheiro saiba com exatidão o ponto de situação do projeto, evitando redundâncias, reinvenção da roda ou duplicação de lógicas já existentes (DRY - Don't Repeat Yourself). Antes de iniciar qualquer tarefa, o agente deve assumir este relatório como a única fonte de verdade arquitetónica.

🏛️ Relatório de Estado da Arquitetura: Boleia Certa
**Última Atualização:** 4 de Setembro de 2026
**Fase Atual:** Marketplace Oferta/Procura (Execute T1–T21); Geocoding OSM; push; **design SoT = Penpot** (+ Superdesign exploração; Cursor orquestra). Spec: `.specs/features/marketplace-oferta-procura/`.

**O que já está implementado e validado:**
1. **Infraestrutura e Backend (Supabase):**
   * **Domínio marketplace:** `ofertas_capacidade`, `procuras`, `grupos`, `membros_grupo`, `propostas`, `lista_espera`, `acordos` (1:N), `acordos_passageiros`, `faltas`. RPC `accept_proposal` atómica. Sem tabela `routes` / RPCs seats legados.
   * **Veículos:** `capacidade_total` / `vagas_passageiros` (= total − 1). Modo preço: `POR_PASSAGEIRO` | `TOTAL_ACORDO` (copy UI humana: «Por passageiro» / «Total do acordo»).
   * **Matching MVP:** ±15 min, raio OD 2500 m (haversine); `N > vagas` → waitlist. Três Ns: `N_candidato` (matching), `N_contrato` (preço congelado), `N_activos` (só vagas/UI).
   * **Faltas:** `desconto_kz` por dia útil do mês a partir da quota congelada — **sem** divisor `/ 4`.
   * **Auth/Push PRESERVE:** `perfis`, `notificacoes`, `push_subscriptions`, Edge `send-push` (VAPID).
2. **Frontend e Interface (React / Vite):**
   * **Layout & paths:** `/` Landing, `/auth`, `/passageiro` (procura/matches/waitlist), `/motorista` (ofertas + propostas), `/veiculo`, `/publicar-trajeto` («Publicar oferta»), `/acordos` (`MyAgreements` 1:N), `/faltas`, `/perfil`.
   * **Deep linking:** `notificationRouter.js` — tipos `proposal_received`, `waitlist_promoted`, `match_available`, etc.
   * **AuthContext:** `{ session, user, loading, tipoPerfil, profile, refreshProfile }`.
3. **Serviços canónicos (`src/services/`):**
   * `OfertaService`, `ProcuraService`, `GrupoService`, `PropostaService`, `AgreementService`, `MatchingService`, `WaitlistService`, `AbsenceService`, `LocationService` (Photon).
   * **Removido:** `RouteService`, `AgreementsService` (`requestSeat`), cards `Acordo*` acoplados a `routes`.
4. **Utils:** `pricing.js`, `geo.js`, `matchingConfig.js`, `matchingFilters.js`.
5. **Geocoding OSM (mantido):** Photon `countrycode=ao`; Autocomplete «Powered by OpenStreetMap».
6. **UI copy:** nunca expor jargon (`N_candidato`, `POR_PASSAGEIRO`) na interface — só labels humanas.