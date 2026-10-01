# ENG#32 — Rating piloto (P2) — plano only

**Data:** 2026-10-01 (patch ENG#32b: decisões PM / Critiquito P0+P1)  
**Tipo:** docs / PM handoff  
**Estado:** plano fechado para MVP piloto — **zero** implementação neste pacote

## Goal

Definir **quando**, **quem** e **com que limites** o piloto Boleia pede avaliações mútuo mot↔pax, alinhado ao domínio actual (acordo 1:N, pagamentos mensais, custódia). Este ficheiro é a fonte para um futuro ENG de implementação — **sem** schema, RPC, UI ou código.

## Decisões PM (Critiquito P0+P1 — fechadas)

| Tema | Decisão |
|------|---------|
| **Momentos MVP** | **M1 + M2 apenas.** M3 (renovação) **fora do piloto.** |
| **Canal M1** | Detalhe do acordo em **`/acordos`** (`MyAgreements`) — bloco «Avaliações» no acordo activo. Nudge única in-app (sino / `notificacoes`) com deep link para o **mesmo** ecrã. |
| **Motorista × N pax** | **Um ecrã com lista** (todos os lugares elegíveis no mesmo formulário) — **não** N notificações nem N prompts separados. |
| **Grupo** | **Cada lugar** = uma linha em `acordos_passageiros`; owner e membros avaliam/avaliados **individualmente** por lugar. |
| **CTA canónico** | **«Avaliar»** (PT-PT). |
| **Estados do prompt** | **`pendente`** · **`feito`** · **`expirado`** (janela 7–14 dias após gatilho; sem re-pedido se expirado). |
| **Visibilidade comentário** | Texto livre **só plataforma** (ops/moderação). Contraparte vê no máximo **«avaliado»** (estado discreto) — **não** corpo do comentário nem detalhe de estrelas além do definido para piloto. |

---

## Contexto (vocabulário existente)

| Termo | Uso neste plano |
|-------|-----------------|
| **Acordo** | Relação 1 motorista : N passageiros (`acordos` + `acordos_passageiros`) após aceite de proposta |
| **Proposta** | Negociação pré-acordo — **não** é momento de rating |
| **Período / mês de referência** | Ciclo de pagamento mensal por lugar (`mes_referencia` em `pagamentos_acordo`) |
| **Liquidado** | Pagamento validado e repasse processado (`liquidado`) — alinha com memo «ratings accrue for settled trips» (`info-product.md`) |
| **Reputação / pontuação** | Diferencial de produto a longo prazo; **não** confundir com «avaliação» do contrato digital (ENG#31) |
| **Avaliação (rating)** | Feedback qualitativo/quantitativo **pós-relacionamento**, distinto de proposta, adenda ou contrato |

**Nota:** mockups v0 (ex. «4,9 · 24 viagens» em `.specs/features/marketplace-oferta-procura/v0-reference/`) são referência visual — **não** são comportamento de produção.

## Princípios piloto (confirmados)

1. **Só com dinheiro on-platform liquidado** — coerente com gates de faltas/assiduidade (ENG#11) e anti-leakage.
2. **Mínimo viável** — recolher sinal de confiança; **não** expor score público nem alterar matching no piloto.
3. **Bilateral por par mot↔pax** — cada relação activa no acordo é avaliável em separado (1:N).
4. **Opt-in tardio** — pedir depois de experiência real, não no aceite da proposta.

---

## Momentos — quando pedir avaliação

### MVP piloto = M1 + M2

| ID | Momento | Gatilho | No piloto? |
|----|---------|---------|------------|
| **M1** | Fim do **primeiro período liquidado** | `pagamentos_acordo.estado = liquidado` para `(acordo_passageiro_id, mes_referencia)` | **Sim** |
| **M2** | **Saída** do acordo (passageiro ou motorista) | Após `leave_passenger` ou `terminate_agreement` efectivo, se existiu ≥1 período `liquidado` | **Sim** |
| **M3** | **Renovação** M→M+1 | Após `renew_agreement_period` + liquidação do mês anterior | **Não** — explicitamente **fora do piloto** |
| **M4** | Por **viagem diária** (ida/regresso) | Registo em `faltas` / calendário | **Não** — granularidade alta, sem validação GPS |

**Cadência MVP:** máx. **1 prompt M1** por par mot↔pax por período liquidado + eventual **M2** na saída (se ainda não `feito`).

### Fora de scope (nunca pedir nestes estados)

| Momento | Motivo |
|---------|--------|
| Browse `/explorar`, proposta aberta, negociação | Sem acordo; risco de spam e retalhação prematura |
| Aceite → `reservado` / `pendente_pagamento` / `comprovativo_enviado` | Relação ainda não «activa» com custódia (ENG#5, seat-before-custody) |
| Adenda pendente, rescisão em curso (`cancelamento_pendente`) | Conflito aberto — UX e fairness degradam |
| Waitlist, grupo `pendente` sem acordo | Sem par contractual |
| Renovação mensal (M3) | Fora do piloto — evitar fadiga mensal |

### Janela e estados

- Janela de resposta: **7–14 dias** após gatilho (valor exacto na implementação; default **14**).
- **Sem re-pedido** se ignorado ou expirado (evitar dark patterns).
- Estados por par mot↔pax no prompt:

| Estado | Significado |
|--------|-------------|
| **`pendente`** | Gatilho M1/M2 disparou; utilizador ainda não submeteu |
| **`feito`** | Avaliação submetida (mútua independente — uma parte pode estar `feito` e a outra `pendente`) |
| **`expirado`** | Janela fechou sem submissão; CTA desactivado |

---

## Canal M1 — onde vive o prompt

| Superfície | Papel |
|------------|-------|
| **`/acordos`** (`MyAgreements`) | **Canal primário M1/M2** — bloco «Avaliações» no detalhe do acordo; lista de pares/lugares com estado `pendente` / `feito` / `expirado` e CTA **«Avaliar»**. |
| **Notificação in-app** (`notificacoes` + sino) | **Nudge única** por evento de gatilho (ex. «Primeiro mês liquidado — avalie a sua boleia») com deep link para **`/acordos?acordoId=…`** (ou equivalente). |
| **Motorista com N passageiros** | **Um** nudge + **um** ecrã lista (todos os lugares no mesmo fluxo) — ver secção seguinte. |

**Fora do canal piloto:** WhatsApp, telefone, email transaccional dedicado, N notificações paralelas por passageiro.

---

## Quem avalia quem

### Modelo base: bilateral mot↔pax

```
Acordo (1 motorista : N passageiros)
├── Para cada acordo_passageiro activo (ou que foi activo no período):
│   ├── Passageiro → avalia Motorista
│   └── Motorista → avalia Passageiro
└── Grupo: cada membro com lugar no acordo avalia/é avaliado **individualmente** (cada lugar)
```

| Actor | Avalia | Vê o quê (piloto) |
|-------|--------|-------------------|
| **Passageiro** | Motorista do acordo | Próprias submissões; **não** score agregado público do motorista |
| **Motorista** | Cada passageiro activo no período (**lista num ecrã**) | Próprias submissões; **não** perfil público de passageiro |
| **Grupo (owner/membro)** | Mesmas regras por **lugar** (`acordos_passageiros`) | **Cada lugar** = par mot↔pax independente; owner **não** avalia «pelo grupo inteiro» |
| **Contraparte** | — | No máximo **«avaliado»** — **não** texto livre nem detalhe de estrelas |
| **Admin / plataforma** | — | Texto livre + escala (moderação futura); painel interno mínimo — **fora** deste plano de UI |

### Motorista × N passageiros — UX fechada

- **Um ecrã**, **uma lista**: cada linha = um `acordos_passageiros` elegível (nome/identificador interno + estado + CTA **«Avaliar»** por linha ou fluxo step-through na mesma página).
- **Uma notificação** por gatilho M1/M2 (ex. «Avalie os passageiros do acordo X»), não N pushes.
- Passageiro (lado oposto): prompt **individual** mot↔pax (1 motorista por acordo).

### Regras de elegibilidade (proposta)

| Regra | Detalhe |
|-------|---------|
| E1 | Só quem teve lugar `activo` ou `saiu` **depois** de ≥1 `liquidado` no acordo |
| E2 | Avaliação **mútua independente** — uma parte pode submeter sem a outra |
| E3 | **Sem** avaliação anónima no piloto (identidade interna para moderação futura) |
| E4 | **Sem** avaliação cruzada entre acordos diferentes no mesmo mês (1 prompt por par por período) |
| E5 | Passageiro `expirado` (TTL reserva ENG#18) **não** elegível |

### Conteúdo mínimo (escopo funcional futuro — não implementar aqui)

- Escala simples (ex. 1–5 estrelas) + comentário **opcional** curto.
- Comentário: **plataforma-only**; contraparte ≤ **«avaliado»**.
- Tags opcionais (ex. «pontual», «comunicação») — **open question** PM (Q6+).
- **Sem** texto livre longo nem upload de provas no piloto.

---

## Fora do piloto (non-goals explícitos)

| Área | Fora |
|------|------|
| **Descoberta / matching** | Score visível em cards, `/explorar`, ranking de motoristas, SEO |
| **Algoritmo** | Peso de rating em `MatchingService`, boost/penalização, «motoristas top» |
| **Reputação pública** | Perfil com média, nº viagens, badges, partilha externa |
| **Disputas** | Medição/arbitragem de conflitos, integração com rescisão «justa causa» |
| **Reviews** | Anónimas, multi-idioma, edição ilimitada, respostas públicas estilo marketplace |
| **B2B / institucional** | Avaliação de empresas, polos, frotas |
| **Granularidade viagem** | Rating por ida/regresso/dia (`faltas`) |
| **Renovação mensal (M3)** | Prompt recorrente a cada M→M+1 |
| **Incentivos monetários** | Desconto/crédito por rating |
| **Integrações** | WhatsApp/telefone como canal de review |
| **Pack B / ENG#35 / softs** | Qualquer feature listada nesses pacotes — **hard out** |

### Dependências (leitura only — não alterar)

- **ENG#31** contrato digital — snapshot de preço/N; **sem** overlap com rating.
- **ENG#34 / #150** contra-proposta CTA — **sem** alteração de runtime.
- Pagamentos **ENG#5/#11/#13/#14** definem quando existe «período liquidado» (gatilho M1).

---

## Open questions (PM)

### Fechadas (ENG#32b)

| # | Pergunta | Resolução |
|---|----------|-----------|
| **1** | Granularidade M1 vs M2 vs ambos — qual MVP? | **M1 + M2** no piloto. |
| **2** | Grupo: uma vez ou por membro/lugar? | **Cada lugar** (`acordos_passageiros`); owner não avalia pelo grupo agregado. |
| **3** | Motorista N pax: um formulário ou N prompts? | **Um ecrã com lista**; **uma** notificação por gatilho. |
| **4** | Renovação (M3): todos os meses ou só 1.º + saída? | **M3 fora do piloto** — só 1.º período liquidado (M1) + saída (M2). |
| **5** | Contraparte vê comentário? | **Não** — texto **plataforma-only**; contraparte ≤ **«avaliado»**. |
| **9** | Copy PT-PT canónico? | CTA **«Avaliar»**; evitar «Classificação»/«Reputação» na UI piloto (reservados a fase pública futura). |

### Abertas

| # | Pergunta |
|---|----------|
| **6** | Moderação: auto-publicar vs fila admin — quem actua em texto ofensivo? |
| **7** | Retaliação: bloquear rating se rescisão «justa causa» pendente/disputada? |
| **8** | Matching futuro: rating entra em matching só pós-piloto — confirmar horizonte? |
| **10** | Métrica de sucesso piloto: taxa de resposta alvo (% pares com ≥1 rating)? |

---

## Próximo ENG (stub)

Com decisões P0+P1 fechadas:

1. Spec de implementação (schema `avaliacoes` ou equivalente, RLS, RPC idempotente).
2. UI: bloco «Avaliações» em `/acordos` + nudge única + deep link; lista mot×N; estados `pendente`/`feito`/`expirado`; CTA **«Avaliar»** (Stitch + UI Skills).
3. TDD: elegibilidade E1–E5, bilateralidade, visibilidade platform-only, sem leak para browse público.
4. Admin: export/listagem interna (sem Critiquito polish neste slice).

**Estimativa de complexidade:** média — sobretudo 1:N + gates de pagamento + ecrã lista mot; UI simples se piloto for in-app only.

---

## DoD deste pacote (docs only)

- [x] Momentos documentados com gatilhos de domínio
- [x] **MVP M1+M2 fechado; M3 fora do piloto**
- [x] Mot↔pax bilateral; **grupo = cada lugar**
- [x] **Canal M1 nomeado** (`/acordos` + nudge única)
- [x] **Mot×N = um ecrã lista** (não N notifs)
- [x] **Estados** `pendente` / `feito` / `expirado`; CTA **«Avaliar»**
- [x] **Visibilidade** comentário platform-only; contraparte ≤ «avaliado»
- [x] Open questions **1–5 e 9 fechadas**; 6–8 e 10 abertas
- [x] Non-goals explícitos (piloto mínimo; softs/#35/Pack B out)
- [x] Zero diff em `src/`, `supabase/`, runtime #31/#34/#150
