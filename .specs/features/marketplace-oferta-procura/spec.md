# Marketplace Oferta / Procura — Specification

## Problem Statement

O MVP actual modela boleias como **rota → pedido de vaga → acordo 1:1** (`routes` + `requestSeat` + `acordos.passenger_id`). Isso não reflecte o negócio real em Luanda: um motorista oferece **capacidade** (1→N passageiros), passageiros formam **procura** (individual ou grupo), e o preço pode ser negociado como **por passageiro** ou **total do acordo**. Triggers de faltas com divisor hardcoded (`/ 4`) e quotas que “seguem” o N actual distorcem o contrato. Os dados actuais são de teste e podem ser descartados — reconstrução limpa do domínio, preservando auth, push, geo e shell.

## Goals

- [ ] Substituir o domínio `routes` ↔ `requestSeat` ↔ acordo 1:1 por **oferta de capacidade ↔ procura/grupo ↔ proposta ↔ acordo 1:N**.
- [ ] Suportar `modo_preco` dual: `POR_PASSAGEIRO` | `TOTAL_ACORDO`, com preços **congelados** na aceitação (`N_contrato`).
- [ ] Garantir invariante de capacidade: ocupação = soma de passageiros activos; `vagas_disponiveis >= 0`; aceitação atómica.
- [ ] Garantir invariante de quota: saída de passageiro **não** recalcula quotas do mês corrente.
- [ ] Faltas: `desconto_kz = valor_mensal_por_passageiro_kz / dias_uteis_mes` — zero literais `/ 4` e zero `total / N_activos`.
- [ ] Lista de espera quando `N_proposto > vagas_disponiveis` (não fechar anúncio).
- [ ] Preservar auth/`perfis`, push/notificações, Photon/geo, Layout/Theme, paths principais.
- [ ] TDD (Vitest) e UI Penpot-first conforme `AGENTS.md`.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Gateway de pagamento | Fora do MVP marketplace |
| Substituto automático de passageiro | Extensão futura |
| Routing turn-by-turn | Não é matching de capacidade |
| TypeScript / toast libraries | Proibido pelas regras do repo |
| Tabela `rotas_diarias` / Google Maps | Domínio legado / removido |
| Expand-contract, backfill, dual-write | Dados de teste descartáveis — corte limpo |
| Quotas desiguais por passageiro | Extensão pós-MVP |
| Adenda de preço (mês seguinte) UI completa | Serviço pode existir; fluxo UI pode ser P2 |

---

## Domain Rules (obrigatórias — não negociáveis)

### Cardinalidade

| Relação | Cardinalidade | Limite / nota |
|---|---|---|
| Motorista → passageiros **num acordo aceite** | **1 → N** | `N_contrato` ≤ `vagas_disponiveis` no momento da aceitação |
| Procura/grupo → **propostas** de motoristas | **1 → M** | Uma procura/grupo pode receber **múltiplas** propostas em paralelo |
| Proposta aceite → acordo | **1 → 1** | Aceitar uma proposta cria **um** acordo: 1 motorista + N passageiros |
| Acordo | **1 cabeçalho** + **N** `acordos_passageiros` | N = `N_contrato` na aceitação |

- Matching e negociação: **oferta ↔ procura/grupo**, nunca «um negócio = um motorista + um passageiro».
- N = 1 é apenas o caso degenerado (procura individual), **não** a regra de domínio.
- Vários acordos activos do mesmo motorista só se a soma de `N_activos` em todos os seus acordos ≤ `vagas_totais` da oferta.
- Proibido reformular o domínio como fluxo 1:1 (`requestSeat`-style).

### Quatro Ns (nunca misturar)

| Símbolo | Significado | Uso |
|---|---|---|
| `N_actual` | Passageiros **actualmente** no grupo/procura (membros activos). Coluna BD: `procuras.n_candidato` | Necessidade viva; matching vs vagas; UI «Grupo · 2 pessoas»; **não** congela preço |
| `N_proposto` | Passageiros considerados **numa proposta** (`propostas.n_passageiros_propostos`) | Snapshot da negociação; base do preço **nessa** proposta; imutável após criar a versão |
| `N_contrato` | Passageiros efectivamente incluídos **no acordo aceite** (`acordos.n_passageiros_contrato`) | Snapshot imutável sem adenda; base do preço congelado do contrato |
| `N_activos` | `COUNT(acordos_passageiros WHERE estado = 'activo')` **agora** | Só capacidade / `vagas_disponiveis` / UI de lotação — **nunca** divisor de preço nem de faltas |

**Aliases / legado de naming:** `N_candidato` nos docs antigos = `N_actual`. Preferir `N_actual` daqui em diante. A coluna `n_candidato` mantém-se por estabilidade de schema.

**Regras:**

- `N_actual` pode crescer ou diminuir enquanto o grupo está aberto (até `n_maximo` / capacidade pretendida do criador).
- Uma proposta **não** acompanha alterações posteriores de `N_actual`: mantém o seu `N_proposto`.
- Renegociar com outro N → **nova versão** de proposta (novo `N_proposto`), nunca mutar a proposta aberta antiga.
- Na aceitação: `N_contrato = N_proposto` da proposta aceite. Incluir exactamente `N_proposto` membros (ordem estável `ordem_insercao`); se `N_actual < N_proposto`, a aceitação falha.
- `N_activos` pode cair abaixo de `N_contrato` após saídas — quotas do mês corrente **não** mudam.

### Grupo = procura colectiva viva (obrigatório)

O grupo **não** é um «pacote fechado» que precisa de estar cheio para negociar.

| Premissa **errada** (proibida) | Premissa **correcta** |
|---|---|
| Grupo incompleto ⇒ não pode procurar / enviar / receber proposta | Grupo incompleto ⇒ continua aberto a novos membros **e** pode receber/enviar propostas com `N_proposto = N_actual` |
| Preço nasce no grupo | Preço nasce na **oferta/proposta** do motorista (`POR_PASSAGEIRO` \| `TOTAL_ACORDO`) |
| Entrada só por telefone / conhecer o criador | Grupo **público/descobrível**: ver → pedir entrada → aprovação/entrada → `N_actual` aumenta |
| Entrar membro invalida automaticamente propostas abertas | Propostas abertas **mantêm** o snapshot; renegociação com novo N = nova proposta |

**Necessidade do grupo** (procura colectiva): `N_actual`, `n_maximo` (capacidade pretendida pelo criador), OD, horários, dias, pontos preferenciais, demais condições. **Sem** preço próprio obrigatório.

**Proposta:** captura `N_proposto` (+ modo/ask do motorista) no instante da negociação. Vários motoristas podem ter propostas abertas em paralelo (1:M). Aceitar uma → 1 acordo 1:N; restantes abertas da mesma procura → canceladas/rejeitadas conforme máquina de estados.

**Exemplo canónico:** grupo 2/4 (`N_actual=2`, `n_maximo=4`); motorista propõe `TOTAL_ACORDO` 100.000 Kz com `N_proposto=2` → 50.000 Kz/passageiro. Entra um 3.º membro → proposta existente **inalterada** (ainda N=2 / 50k). Nova negociação a 3 → nova proposta (`N_proposto=3`, resto 33334+33333+33333).

### Preço

```
POR_PASSAGEIRO: individual = ask (inteiro Kz); total = individual × N_contrato
TOTAL_ACORDO:   total = ask (inteiro Kz); quotas individuais = regra de resto (abaixo)
```

Lotação do veículo **nunca** é divisor de preço.

### Arredondamento `TOTAL_ACORDO` (Kz inteiros — obrigatório)

Objectivo: **soma exacta** das quotas individuais = `valor_mensal_total_kz`, mesmo quando `total % N_contrato ≠ 0`.

Regra determinística (método do resto / largest remainder):

1. Seja `T` = total acordado (inteiro Kz) e `N` = `N_contrato` (N ≥ 1).
2. `base = floor(T / N)` e `resto = T % N` (inteiros, `0 ≤ resto < N`).
3. Ordenar os N passageiros por chave **estável**: índice de inserção na aceitação `0 … N-1` (ordem do array persistido / RPC). Em empate futuro, `passenger_id` ascendente como desempate.
4. Os primeiros `resto` passageiros nessa ordem recebem `quota_mensal_kz = base + 1`.
5. Os restantes `N - resto` recebem `quota_mensal_kz = base`.
6. Invariante: `sum(quota_mensal_kz) = T` sempre.
7. Cabeçalho: `valor_mensal_total_kz = T`; `valor_mensal_por_passageiro_kz = base` (quota de referência; usada em faltas no MVP quando não se discrimina por pax).
8. Excepção explícita à «quota igual»: quando `resto > 0`, as quotas diferem no máximo **1 Kz** — única diferença permitida entre passageiros do mesmo acordo no MVP.
9. `POR_PASSAGEIRO` não precisa desta regra: `total = individual × N` é exacto em inteiros.

Exemplos:

| T (Kz) | N | base | resto | Quotas |
|--------|---|------|-------|--------|
| 120000 | 4 | 30000 | 0 | 30000×4 |
| 100000 | 3 | 33333 | 1 | 33334, 33333, 33333 |
| 100001 | 3 | 33333 | 2 | 33334, 33334, 33333 |

### Faltas

```
desconto_kz = acordos.valor_mensal_por_passageiro_kz / acordos.dias_uteis_mes
```

(quando a falta cobre ida e regresso, conforme `regra_desconto_falta`)

### Capacidade

```
vagas_ocupadas = COUNT(acordos_passageiros activos JOIN acordos activos WHERE oferta_id = …)
vagas_disponiveis = vagas_totais - vagas_ocupadas
```

Aceitar proposta só se `N_proposto <= vagas_disponiveis` no momento da aceitação (RPC/transacção com lock).

---

## User Stories

### P1: Publicar oferta de capacidade com modo de preço ⭐ MVP

**User Story**: Como motorista, quero publicar uma oferta de capacidade (rota fixa ou flexível) com `POR_PASSAGEIRO` ou `TOTAL_ACORDO` e vagas do veículo, para que passageiros/grupos possam propor acordos multi-passageiro.

**Why P1**: Sem oferta não há marketplace.

**Acceptance Criteria**:

1. WHEN o motorista cria uma oferta com veículo válido THEN o sistema SHALL gravar `vagas_totais` a partir de `vagas_passageiros` do veículo e `vagas_disponiveis = vagas_totais`.
2. WHEN o motorista escolhe `modo_preco = POR_PASSAGEIRO` THEN `valor_mensal_ask_kz` SHALL ser interpretado como ask individual.
3. WHEN o motorista escolhe `modo_preco = TOTAL_ACORDO` THEN `valor_mensal_ask_kz` SHALL ser interpretado como ask total do acordo.
4. WHEN `flexibilidade_rota = false` THEN a oferta SHALL exigir origem/destino (rota fixa); WHEN `true` THEN SHALL aceitar zonas + janelas.
5. WHEN a oferta é criada THEN `estado` SHALL ser `disponivel` (ou `inactiva` se o motorista a desactivar).

**Independent Test**: Criar oferta com modo `TOTAL_ACORDO` e 3 vagas; ler da BD e verificar campos e interpretação do ask.

---

### P1: Criar procura individual ou grupo ⭐ MVP

**User Story**: Como passageiro, quero criar uma procura (só ou em grupo vivo com pontos preferenciais) para matchar com ofertas de capacidade — mesmo que o grupo ainda não tenha atingido a capacidade pretendida.

**Why P1**: Lado da procura do marketplace.

**Acceptance Criteria**:

1. WHEN um passageiro cria procura individual THEN o sistema SHALL criar `procuras` com `N_actual` = 1.
2. WHEN se cria um grupo com M membros THEN `membros_grupo` SHALL ter M linhas e `N_actual` = M; o criador MAY definir `n_maximo` (capacidade pretendida) ≥ M.
3. WHEN `N_actual < n_maximo` THEN o grupo SHALL permanecer aberto a novos membros **e** elegível a propostas com `N_proposto = N_actual` (não bloquear por «incompleto»).
4. WHEN um membro entra/sai **antes** de contrato THEN propostas abertas existentes SHALL **manter** o seu `N_proposto` (snapshot); renegociar com outro N SHALL exigir **nova** proposta/versão — **proibido** mutar `n_passageiros_propostos` de uma proposta aberta.
5. WHEN a procura define teto de preço THEN o matching SHALL poder usar esse teto como filtro suave (não bloqueio rígido no MVP se omitido). O grupo **não** precisa de preço próprio — o preço vem da oferta/proposta do motorista.
6. WHEN existem várias ofertas/motoristas compatíveis THEN a procura/grupo SHALL poder receber **múltiplas** propostas em paralelo (1:M).
7. WHEN um passageiro descobre um grupo público THEN SHALL poder pedir entrada (aprovação/entrada) sem depender de telefone do criador (descoberta pública — MVP produto; convite por telefone é só fallback transitório).

**Independent Test**: Grupo 2/4; proposta TOTAL 100000 com N=2 → 50000/pax; entrar 3.º membro não altera a proposta; nova proposta N=3 usa regra de resto.

---

### P1: Proposta e aceitação atómica → acordo 1:N ⭐ MVP

**User Story**: Como motorista (ou fluxo de aceitação), quero aceitar uma proposta compatível e criar um acordo com N passageiros e preços congelados numa única transacção.

**Why P1**: Objecto final do produto; substitui `requestSeat`.

**Acceptance Criteria**:

1. WHEN se aceita proposta com `N_proposto <= vagas_disponiveis` THEN o sistema SHALL, atomicamente: lock oferta, inserir **um** `acordos` + N `acordos_passageiros`, persistir `n_passageiros_contrato` (= `N_contrato` = `N_proposto`), preços congelados, `modo_preco`, e recalcular `vagas_disponiveis` via `N_activos`.
2. WHEN `modo_preco = POR_PASSAGEIRO` THEN individual SHALL = valor negociado (inteiro) e total SHALL = individual × `N_contrato`.
3. WHEN `modo_preco = TOTAL_ACORDO` THEN total SHALL = valor negociado (inteiro) e as `quota_mensal_kz` SHALL seguir a regra de resto documentada (`base`/`resto`); `valor_mensal_por_passageiro_kz` do cabeçalho SHALL = `base`. N = `N_contrato` (= `N_proposto` aceite), **nunca** vagas do carro nem `N_activos` nem `n_maximo` do grupo.
4. WHEN `resto = 0` THEN todas as `quota_mensal_kz` SHALL ser iguais a `base`; WHEN `resto > 0` THEN exactamente `resto` passageiros (ordem estável) SHALL ter `base + 1` e a soma SHALL = total.
5. WHEN `N_proposto > vagas_disponiveis` THEN o sistema SHALL **não** criar acordo parcial e SHALL oferecer/registar lista de espera.
6. WHEN dois aceites concorrentes excedem vagas THEN no máximo um SHALL ter sucesso; o outro SHALL falhar ou ir para waitlist (sem overbooking).
7. WHEN uma proposta é aceite THEN outras propostas **abertas** da mesma procura/grupo SHALL ser canceladas (default conservador); o acordo criado é sempre 1 motorista + N passageiros — nunca um vínculo 1:1 implícito.
8. WHEN o grupo tem `N_actual > N_proposto` na aceitação THEN o sistema SHALL incluir apenas os primeiros `N_proposto` membros activos por `ordem_insercao` (composição alinhada ao snapshot da proposta). WHEN `N_actual < N_proposto` THEN a aceitação SHALL falhar.
9. WHEN se cria uma proposta THEN `n_passageiros_propostos` SHALL = `N_actual` no instante da criação (não o `n_maximo`).

**Independent Test**: TOTAL 120.000 / N=4 → 30.000×4; TOTAL 100.000 / N=3 → quotas 33334+33333+33333; `vagas_disponiveis` decrementa `N_contrato`.

---

### P1: Invariante de quota na saída ⭐ MVP

**User Story**: Como passageiro activo num acordo, quero poder sair sem que as quotas dos restantes sejam recalculadas no mês corrente.

**Why P1**: Cláusula crítica do contrato; evita bug de negócio.

**Acceptance Criteria**:

1. WHEN um passageiro marca `estado = saiu` THEN o sistema SHALL libertar 1 vaga (`N_activos` e `vagas_disponiveis`) e **não** alterar `acordos.valor_mensal_por_passageiro_kz`, `valor_mensal_total_kz`, nem `quota_mensal_kz` dos restantes.
2. WHEN se tenta mutar preços do cabeçalho fora de `createAgreementFromProposal` / adenda explícita THEN o sistema SHALL rejeitar ou o teste de regressão SHALL falhar.
3. WHEN um passageiro sai THEN o sistema MAY notificar promoção de lista de espera (sem auto-aceitar).

**Independent Test**: Acordo 120k / 4 × 30k; um sai → quotas dos 3 ficam 30k; total cabeçalho inalterado.

---

### P1: Faltas sem divisor hardcoded ⭐ MVP

**User Story**: Como passageiro/motorista num acordo activo, quero registar faltas com desconto baseado na quota congelada do acordo.

**Why P1**: Módulo de faltas já existe; fórmula antiga `/4/22` é incorrecta.

**Acceptance Criteria**:

1. WHEN se regista falta (ida+regresso conforme regra) THEN `desconto_kz` SHALL = `valor_mensal_por_passageiro_kz / dias_uteis_mes` do acordo.
2. WHEN o trigger/serviço calcula desconto THEN NÃO SHALL aparecer literal `/ 4`, `/ 2`, nem divisão por `capacidade_total` / `vagas_totais` / `N_activos`.
3. WHEN a falta é registada THEN MAY associar `passenger_id` (quem faltou) além de `acordo_id`.
4. Paths `/faltas` e `/faltas/:acordoId` SHALL continuar a funcionar com acordos 1:N.

**Independent Test**: Acordo com 30.000 Kz e `dias_uteis_mes = 22` → desconto ≈ 1363.64 Kz; zero `/ 4` no SQL/JS.

---

### P1: Lista de espera ⭐ MVP

**User Story**: Como passageiro/grupo, quando a oferta não tem vagas suficientes para o meu N, quero entrar na lista de espera e ser notificado quando houver capacidade.

**Why P1**: Decisão de produto: vagas a 0 → waitlist, não fechar anúncio.

**Acceptance Criteria**:

1. WHEN `N_proposto > vagas_disponiveis` THEN o sistema SHALL permitir registo em `lista_espera` sem consumir vaga.
2. WHEN vagas são libertadas THEN o sistema SHALL poder notificar candidatos em espera (promoção = notificação, **não** auto-aceitar).
3. WHEN a oferta está `cheia` THEN o anúncio SHALL permanecer visível para waitlist.

**Independent Test**: Oferta com 1 vaga; grupo de 3 → waitlist; sem acordo criado.

---

### P1: Matching oferta ↔ procura/grupo ⭐ MVP

**User Story**: Como passageiro, quero ver ofertas compatíveis com a minha procura/grupo (horário, geo, capacidade ≥ `N_actual`).

**Why P1**: Substitui listagem de `routes` no dashboard.

**Acceptance Criteria**:

1. WHEN se lista matches THEN uma oferta SHALL ser compatível só se **todas** as condições MVP forem verdadeiras:
   - **Horário:** diferença absoluta entre horário da oferta e da procura ≤ tolerância configurável (default **±15 minutos**);
   - **Geo origem:** distância haversine entre origem da oferta e origem da procura ≤ raio configurável (default a fixar em design/config, ex. km);
   - **Geo destino:** idem para destino (mesmo parâmetro de raio ou parâmetros separados origem/destino — ambos configuráveis);
   - **Capacidade para aceite directo:** `N_actual` ≤ `vagas_disponiveis` (usa `N_actual`, não `N_contrato` nem `N_activos` de outro acordo).
2. WHEN `N_actual > vagas_disponiveis` THEN a oferta SHALL ser elegível para waitlist, não para aceitação directa.
3. WHEN o motorista revê uma proposta de grupo THEN a UI/dados SHALL expor os pontos preferenciais dos membros cobertos por essa proposta (`N_proposto` / snapshot).
4. WHEN se avalia matching no MVP THEN o sistema SHALL **não** calcular routing por estrada, ETA, nem matriz de distâncias rodoviárias.

**Independent Test**: Procura com `N_actual`=3 só aceita directamente ofertas com ≥3 vagas; oferta a 20 min de diferença com tolerância 15 min é excluída; sem chamadas a motor de rotas.

---

### P1: Reconstrução limpa sem perder infra ⭐ MVP

**User Story**: Como mantenedor, quero dropar o domínio legado e criar o novo schema numa migração limpa, sem partir auth/push/geo.

**Why P1**: Estratégia aprovada no mapa de impacto.

**Acceptance Criteria**:

1. WHEN a migração corre THEN `routes`, RPCs `decrement/increment_available_seats`, índice 1:1, e triggers legados de seats/faltas `/4` SHALL ser removidos.
2. WHEN a migração corre THEN `perfis`, `handle_new_user`, RLS de `perfis`/`notificacoes`/`push_subscriptions`, Edge `send-push`, e tabelas push SHALL permanecer intactos.
3. WHEN `veiculos` é alterado THEN SHALL existir `capacidade_total` e `vagas_passageiros`; UNIQUE `id_motorista` preservado.
4. WHEN notificações de acordo disparam THEN o pipeline push SHALL continuar a funcionar com metadata actualizada (`notificationRouter` / `sw.js` alinhados).

**Independent Test**: Signup cria `perfis`; push subscription ok; queries a `routes` falham; novas tabelas existem com RLS.

---

### P2: Adenda / renegociação de preço (mês seguinte)

**User Story**: Como partes do acordo, quero renegociar preços / N só via adenda explícita para o mês seguinte.

**Why P2**: Único caminho legal para mutar preços; UI pode ser mínima no MVP.

**Acceptance Criteria**:

1. WHEN se chama `renegotiateAgreementPricing` THEN prices e opcionalmente `n_passageiros_contrato` SHALL actualizar **só** por esse caminho.
2. WHEN não há adenda THEN saída de passageiro NÃO SHALL mutar preços.

**Independent Test**: Após saída, chamar adenda → novos valores; sem adenda → valores antigos.

---

### P2: Adaptar shell de navegação e deep links

**User Story**: Como utilizador autenticado, quero que BottomBar, paths e deep links de notificações abram os ecrãs novos do marketplace.

**Why P2**: Paths mantêm-se; páginas substituem-se.

**Acceptance Criteria**:

1. WHEN há notificação de acordo THEN deep link `/acordos?openAcordoId=` (ou equivalente) SHALL abrir o acordo multi-passageiro.
2. WHEN se navega para `/passageiro`, `/motorista`, `/publicar-trajeto`, `/acordos` THEN as páginas novas do domínio SHALL renderizar (não dashboards `routes`).

---

### P3: Mapa com N pontos na revisão da proposta

**User Story**: Como motorista, quero ver no mapa todos os pontos de recolha/desembarque do grupo antes de aceitar.

**Why P3**: Melhora decisão; matching textual pode bastar no P1.

**Acceptance Criteria**:

1. WHEN a proposta tem N membros com coordenadas THEN o mapa SHALL mostrar os N pontos.

---

## Edge Cases

- WHEN `N_actual = 1` (procura individual) THEN acordo 1:N degenera para 1 linha em `acordos_passageiros` e preço resolve normalmente (`N_contrato = 1`).
- WHEN `TOTAL_ACORDO` e `T % N_contrato ≠ 0` THEN o sistema SHALL aplicar a regra de resto; NÃO SHALL alterar `T` nem usar decimais de Kz.
- WHEN `N_actual` muda após proposta aberta mas antes do aceite THEN a proposta aberta SHALL **manter** `N_proposto`; na aceitação `N_contrato = N_proposto`. Se o grupo quiser negociar o novo N → **nova** proposta.
- WHEN um passageiro sai após contrato THEN `N_activos` diminui e `N_contrato` / preços do cabeçalho permanecem; vagas libertam-se pela fórmula de capacidade.
- WHEN todos os passageiros saem THEN o acordo SHALL poder passar a cancelado/expirado e libertar todas as vagas; preços históricos permanecem para auditoria.
- WHEN `vagas_disponiveis = 0` THEN estado oferta `cheia`; waitlist activa; anúncio não desaparece.
- WHEN proposta está aberta e um membro entra no grupo THEN a proposta **não** se invalida automaticamente; continua válida para o seu `N_proposto`.
- WHEN proposta está aberta e membros saem de forma que `N_actual < N_proposto` THEN a aceitação dessa proposta SHALL falhar até haver membros suficientes ou nova proposta com N menor.
- WHEN `N_actual < n_maximo` THEN o grupo SHALL continuar público/negociável (nunca bloquear por «incompleto»).
- WHEN sessão inválida THEN mutações (criar oferta/procura/aceitar) SHALL falhar com erro amigável (sem fallback de teste `passenger-123`).
- WHEN falta só ida (se regra permitir) THEN desconto SHALL seguir `regra_desconto_falta` (não assumir sempre ida+regresso).
- WHEN duas ofertas estão dentro do raio e da tolerância horária THEN ambas SHALL poder gerar propostas para a mesma procura (cardinalidade 1:M na negociação).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| MKT-01 | P1: Publicar oferta + modo_preco | Design | Pending |
| MKT-02 | P1: Procura / grupo | Design | Pending |
| MKT-03 | P1: Proposta + aceitação atómica 1:N | Design | Pending |
| MKT-04 | P1: resolveAgreementPricing dual + resto TOTAL_ACORDO | Design | Pending |
| MKT-05 | P1: Invariante quota na saída | Design | Pending |
| MKT-06 | P1: Capacidade = soma pax activos | Design | Pending |
| MKT-07 | P1: Faltas sem /4 | Design | Pending |
| MKT-08 | P1: Lista de espera | Design | Pending |
| MKT-09 | P1: Matching ±15min + raio + N_actual (sem routing) | Design | Pending |
| MKT-17 | P1: Quatro Ns (actual/proposto/contrato/activos) + grupo vivo | Design | Pending |
| MKT-18 | P1: Procura 1:M propostas; aceite → 1 acordo 1:N | Design | Pending |
| MKT-10 | P1: Migração limpa + preservar infra | Design | Pending |
| MKT-11 | P1: RLS tabelas novas | Design | Pending |
| MKT-12 | P1: Notificações/push alinhados | Design | Pending |
| MKT-13 | P2: Adenda renegociação | - | Pending |
| MKT-14 | P2: Shell / deep links | - | Pending |
| MKT-15 | P3: Mapa N pontos | - | Pending |
| MKT-16 | P1: Actualizar AGENTS.md (fonte de verdade) | - | Pending |

**Coverage:** 18 total, 0 mapped to tasks, 18 unmapped ⚠️ (mapeamento na fase Tasks)

---

## Success Criteria

- [ ] Zero referências operacionais a `routes` / `requestSeat` no caminho feliz do produto
- [ ] Aceitar proposta N=4 com `TOTAL_ACORDO` 120.000 Kz persiste 30.000×4 e decrementa 4 vagas; caso 100.000/3 soma exacta com resto
- [ ] Sair 1 passageiro: quotas restantes inalteradas; `N_contrato` intacto; teste de regressão verde
- [ ] Matching usa ±15 min + raio + `N_candidato`; sem routing/ETA
- [ ] `logAbsence` / trigger: desconto = mensal_pax / dias_uteis; grep sem `/ 4` no caminho de faltas
- [ ] Signup + push continuam a funcionar após migração
- [ ] Suite Vitest verde; UI alinhada a Penpot (gate design cumprido antes de ecrãs novos)
- [ ] `AGENTS.md` deixa de afirmar `routes` como fonte de verdade

---

## Referências

- Produto: `.cursor/plans/marketplace_oferta_procura_74cbb52a.plan.md`
- Impacto / corte limpo: `.cursor/plans/mapa_impacto_marketplace_e95dd649.plan.md`
- Contrato: `CONTRATO_PARTICULAR_DE_PRESTACAO_DE_SERVICO_DE_TRANSPORTE.md`
- Regras repo: `AGENTS.md`, `.cursorrules`
