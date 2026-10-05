# Boleia Certa Project Memory & State

## Quick (2026-10-05) — Softs do hub + aviso ao propor

- `cancelado_justificado` é terminal para Apagar grupo, como `cancelado` e `expirado`.
- Capacidade ao editar: 2–8, piso `max(2, membros activos)`.
- `apagarGrupo` exige a linha devolvida pelo DELETE; vazio (RLS) é erro, não «Grupo apagado.».
- Dono que sai deixa de controlar: `leave_grupo_membro` não transfere `owner_id`. O painel do hub continua só na procura do próprio passageiro.
- Separadores Explorar | A minha procura: `aria-controls`, tabpanel e setas.
- «Propor acordo» no Explorar, com procura activa e rota OD incompatível (ou OD incompleto), avisa e só segue se a pessoa confirmar. Spec: `.specs/quick/hub-softs-propor-rota/`.

## Quick (2026-10-05) — Hub passageiro: Explorar + procura

- Início do passageiro: segmented **Explorar | A minha procura** no mesmo `/passageiro`. Com procura activa o tab inicial é Explorar e o cartão da procura fica sticky por cima das ofertas.
- «A minha procura» troca o feed in-place (detalhe, grupo, propostas, ofertas compatíveis). Criar procura já não substitui o Explorar.
- Kebab do grupo: Editar (dono, capacidade ≥ membros, recolha, sem reescrever propostas), Apagar só dono sozinho e sem acordo activo (omitido, não desactivado), Sair quando há outros. Convite e WhatsApp ficam no cartão.
- Shell autenticado: só o logotipo, com link para `/passageiro` ou `/motorista`. Páginas legais e `/explorar` público não mudam.
- Sem migração. Spec: `.specs/quick/hub-passageiro-explorar-procura/`.

## Current Active Milestone
- **Feature**: Marketplace Oferta / Procura
- **Status**: Phase 6 completa · Phase 7 **T32–T35 Done** (uncommitted) · T29+T30 uncommitted · Checkpoint 2026-09-05 ~11:20
- **Produto (2026-09-05):** Motorista flexível + propostas bidireccionais — Phase 7 **completa** (T32–T35)
- **Checkpoint:** [`.specs/features/marketplace-oferta-procura/CHECKPOINT.md`](../features/marketplace-oferta-procura/CHECKPOINT.md)

## Decisão de domínio (2026-09-04) — Grupo vivo
- Grupo = procura colectiva viva (não precisa estar «completo» para negociar)
- Quatro Ns: `N_actual` · `N_proposto` · `N_contrato` · `N_activos`
- Proposta = snapshot; entrada de membro não muta/invalida propostas abertas
- Preço nasce na oferta/proposta do motorista
- RPC `accept_proposal` alinhada a `N_proposto` (LIMIT primeiros membros)
- Waitlist: promoção = notif `waitlist_promoted` (RPC `promote_waitlist`), sem auto-aceitar
- **T31 Done:** `grupos.n_maximo`; pedidos `pendente`/`rejeitado`; descoberta pública; telefone = fallback
- **Ponto de Recolha Opcional (2026-09-06):** No fallback por telefone em `GrupoProcuraPanel`, telefone é obrigatório e ponto de recolha é opcional (`required={false}` em `AddressInput`). Submissão com recolha vazia persiste `null` em todas as camadas (`membros_grupo`, `GrupoService`, RPCs `accept_proposal`/`leave_grupo_membro` e BD).
- **T29 Done:** RPC `renegotiate_agreement_pricing` + UI adenda em `/acordos` (único caminho mutar preços / N_contrato)
- **T30 Done:** mapa N pontos preferenciais (MapLibre) em `PropostaReviewCard` antes do aceite
- **T32 Done:** RPC `accept_proposal` / `reject_proposal` + RLS — `created_by` não aceita/rejeita; migration `marketplace_t32_accept_reject_contraparte`
- **T33 Done:** propostas B (motorista→pax); inbox passageiro; deep links por `metadata.inbox`; trigger `notify_proposta_contraparte`; `findCompatibleProcuras` (fixa)
- **T34 Done:** oferta flexível sem OD; `OfertaService.resolveOdFields`; copy «Oferta flexível»; PublishRoute esconde OD quando flex
- **T35 Done:** matching dual — fixa geo+tempo; flex tempo/dias/capacidade sem OD/residência

## Decisão de produto (2026-09-05) — Motorista flexível + propostas bidireccionais

**Estado:** decisão imutável. **Phase 7 (T32–T35) implementada.**

**Checklist decisão ↔ docs:** OK. Residual: copy «zona» no hub passageiro se ainda existir (cosmético).

| Regra | MVP |
|---|---|
| Oferta **fixa** | OD + horário + dias + capacidade + preço → matching geo normal |
| Oferta **flexível** | Capacidade + disponibilidade + dias + janela + preço — **sem** OD obrigatório |
| Residência do motorista | **Não** define área de atuação; **não** exclui procuras por distância residência↔recolha |
| Zonas / polígonos / raio residencial | **Fora do MVP** |
| Flex ≠ «rota OD + flag» | Correcto: flexível **sem** rota fixa obrigatória; coluna BD `flexibilidade_rota` = flag legado |
| Propostas | **A** pax/grupo→motorista · **B** motorista→pax/grupo |
| Aceite | Só a **contraparte** (`created_by` não pode aceitar/rejeitar) |
| Cadeia | Procura → **M** propostas → 1 aceite → 1 acordo **1:N** (não Procura→Motorista 1:1) |
| `N_proposto` | Imutável se `N_actual` mudar |

## Regra de ouro
- Visual = v0 (One) + shadcn + UI Skills (+ Mobbin free-safe quando disponível)
- Negócio = spec/planos (1:N; quatro Ns; preço dual congelado; grupo vivo; flexível sem zona; propostas bidireccionais)

## Monetização / GTM (2026-09-07)

- Take-rate ~10% + custódia (escrow) = modelo alvo MVP (ENG#5/#11/#13/#14 no código)
- Admin valida comprovativo → `em_custodia` → liquidação; hard-gate contacto pós-custódia
- ProxyPay / Multicaixa = **depois** do piloto (não bloquear MVP)
- Detalhe roadmap: `ROADMAP.md`; memos: `memos/`

## Soft-hold anti-leakage (2026-09-07)
- **Done (tick 22):** assento após aceite = `reservado` (ocupa capacidade); só passa a `activo` quando pagamento → `em_custodia`.
- `oferta_ocupacao` conta `reservado` + `activo` (sem overbooking).
- UI `/acordos`: «Lugar reservado — aguarda pagamento»; TTL de reservas: deferred.
- Migração git: `20260907190000_seat_before_custody_reservado.sql` (versão remota vazia) + splits `20260907190441` / `449` / `530` / `551`.
- **Preview reconcile #2 (2026-09-10):** 61 ficheiros = 61 `schema_migrations` produção. Spec: `.specs/quick/supabase-preview-reconcile-2/`.

## Faltas ida/regresso (2026-09-07) — decisão produto
- **Opção 1 — Meia quota (canónica MVP):**
  - `ambas` → 100% do dia (`quota / dias_uteis`)
  - `ida` ou `regresso` → 50% (`quota / dias_uteis / 2`)
- Minuta contrato §9 alinhada (local gitignore) + `.specs/quick/pacote-falta-ida-regresso/clausula-9-minuta.md`
- Trigger `handle_falta_desconto` + `computeFaltaDesconto` + UI `/faltas`

## Editar procura activa (2026-09-08)
- Dono edita OD/hora/dias/teto enquanto `activa`/`em_negociacao` e sem acordo activo
- RPC `update_procura` / `cancel_procura`; propostas incompatíveis → `invalidada` (snapshot intacto)
- Teto não invalida; UI «Acima do teto»; confirmação só se houver impacto
- `return_time` reservado (não anular); `n_candidato` / grupo / `n_maximo` intocados
- Spec: `.specs/features/editar-procura/`

## Esqueceu a palavra-passe (2026-10-01) — Done
- Modos `/auth?mode=forgot` e `/auth?mode=update-password`
- `resetPasswordForEmail` + `PASSWORD_RECOVERY` → `passwordRecoveryPending` (`bc_password_recovery`)
- Guards hub; `updateUser` + clear pending → hub
- Spec: `.specs/features/esqueceu-palavra-passe/`
- **Ops pendente:** Redirect URLs no Supabase Dashboard

## Decisão (2026-10-03) — Apple Sign-In fora da UI
- Sem conta Apple Developer: `/auth` e «Associar» no perfil não oferecem Apple.
- Google, Facebook e LinkedIn (OIDC) mantêm-se.
- `supabase/config.toml`, `.env.example` e o Dashboard Supabase não foram alterados.
- Spec: `.specs/quick/remove-apple-sign-in/`

## Decisão (2026-10-04) — Apagar a própria conta

- Quem está autenticado apaga a própria conta em `/perfil`, com confirmação, na hora.
- A app chama a RPC `delete_own_account()` já em produção (`20261004072610`). Sem id. Sem migração neste PR.
- «Terminar sessão» continua a ser só `signOut`.
- Sem prazo, sem email de suporte, sem rota pública de eliminação neste trabalho.
- Spec: `.specs/quick/apagar-conta-autenticada/`.

## Next Steps
1. Redirect URLs recovery (Supabase Auth URL Configuration)
2. TTL reservas (opcional) + polish admin Critiquito
3. **Não** zonas/polígonos; **não** merge automático em `main`

## Quick (2026-10-04) — Título do estado de custódia em Faltas
- A frase já existente «Registo de faltas disponível após pagamento validado em custódia.» é o título desse estado.
- O detalhe com pagamento em custódia continua «Registo de Faltas». Hub, sheets e Explorar não mudam.
- Spec: `.specs/quick/faltas-custodia-titulo/`.

## Quick (2026-10-03) — Hub motorista: cartões Procuras e grupos
- A lista reusa `OpportunityCard` + `RouteIndicator`. Sem segundo cartão.
- OD real → rota. Sem OD: sem «Origem»/«Destino» e sem rota inventada. Oferta flexível continua «Disponível para acordos» no modelo do cartão.
- «Sem compatibilidade com esta oferta» desliga o CTA. Preço da oferta seleccionada no rodapé.
- Spec: `.specs/quick/hub-procuras-opportunity-card/`.

## Quick (2026-10-03) — Explorar autenticado: detalhe no corpo
- O feed Explorar do passageiro reusa `OpportunityDetailSheet` (PR #182) no `onOpen` do `OpportunityCard`.
- O CTA «Propor acordo» continua a abrir `OpportunityProposalSheet`. O CTA dentro do detalhe faz a mesma acção.
- `/explorar` anónimo não muda: corpo abre o detalhe; CTA «Propor acordo» vai para `/auth`.
- Spec: `.specs/quick/explorar-passageiro-detalhe/`.

## Quick (2026-10-03) — Explorar: cartão e proposta do passageiro
- O feed Explorar sem procura (`PassengerDashboard`) usa `OpportunityCard`, o mesmo de `/explorar`.
- O CTA autenticado abre `OpportunityProposalSheet`. Anónimo em `/explorar` continua para `/auth`.
- Total do acordo do passageiro: um preço, sem stepper. Por passageiro: o stepper multiplica só o total.
- N acima de 1 neste feed, sem grupo, não cria procura: a folha fica aberta com o erro já usado em `createProposta`.
- Cabeçalho dos dois: só o ícone `boleia-logo.png` (`BrandLockup`), sem a palavra ao lado. Spec: `.specs/quick/explorar-logo-sem-wordmark/`.
- Spec: `.specs/quick/explorar-proposta-passageiro/`.

## Quick (2026-10-03) — Detalhe da oportunidade
- Sheet de detalhe em `/explorar` reusa `resolveOpportunityCard`, `RouteIndicator` e `OverlayShell`.
- Flexível `TOTAL_ACORDO`: «Disponível para acordos» + horário real, um preço, sem rota inventada e sem × N.
- Sheet de proposta do motorista (grupo e passageiro): «Este número fica fixo nesta proposta.» N = snapshot. Stepper do passageiro sem essa frase.
- **Hub motorista (2026-10-03):** procura e grupo com preço na oferta abrem `OpportunityProposalSheet`. Spec: `.specs/quick/driver-hub-proposal-sheet/`.

## Decisão (2026-10-01) — Marketplace browse público
- Anónimo vê ofertas e procuras em `/explorar` (só leitura; CTAs → `/auth`)
- Motorista autenticado: browse procuras sem oferta activa; propor cria oferta flexível mínima
- Passageiro browse sem procura: já coberto (ENG#4/#23)
- RLS: GRANT SELECT anon + policies por estado activo

## Decisão (2026-10-04) — SELECT de perfis
- Versão já em produção: `20261004073111`. O ficheiro SQL entra noutro PR.
- O cliente não pede `telefone`, `iban` nem `is_admin` em `perfis`.
- Convite: `lookup_perfil_por_telefone` (`id`, `nome_completo`). Dono: `get_own_perfil_contacto`. Admin: `is_platform_admin()` e `admin_motoristas_tem_iban`.
- Spec: `.specs/quick/perfis-colunas-sensiveis/`.
## Quick (2026-10-05) — Grupos abertos: pedido pendente sobrevive ao refresh
- `enviados` em `GrupoDescobertaPanel` era só memória local. Com `passengerId`, `listGruposAbertos` lê `membros_grupo.estado = pendente` e marca `pedido_pendente`. O grupo continua na lista; o CTA passa a «Pedido enviado».
- Sem `passengerId` não há essa leitura. Sem schema.
- Spec: `.specs/quick/grupos-abertos-pedido-pendente/`.

## Quick (2026-10-04) — Login e criar conta: cabeçalho para `/`
- Login e criar conta (`Auth`, `isLogin` / `isRegister`) ligam o ícone existente a `/`.
- Os outros modos de `/auth` e o `BrandLockup` do shell autenticado ficam sem esse link.
- Spec: `.specs/quick/auth-header-home-link/`.

## Key links
- Plan: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Spec · Design · Tasks · Checkpoint sob `.specs/features/marketplace-oferta-procura/`
- v0 T31: https://v0.app/chat/jo0mXnLQf42
- v0 T29: https://v0.app/chat/hT2KzrQr0Bt
- v0 T30: https://v0.app/chat/jIH3o5n1EM1
