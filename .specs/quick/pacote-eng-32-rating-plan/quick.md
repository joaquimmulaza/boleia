# ENG#32 — Rating piloto (P2) — plano only

**Data:** 2026-10-01  
**Tipo:** docs / PM handoff  
**Estado:** plano — **zero** implementação neste pacote

## Goal

Definir **quando**, **quem** e **com que limites** o piloto Boleia pede avaliações mútuo mot↔pax, alinhado ao domínio actual (acordo 1:N, pagamentos mensais, custódia). Este ficheiro é a fonte para um futuro ENG de implementação — **sem** schema, RPC, UI ou código.

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

## Princípios piloto (proposta — PM confirma)

1. **Só com dinheiro on-platform liquidado** — coerente com gates de faltas/assiduidade (ENG#11) e anti-leakage.
2. **Mínimo viável** — recolher sinal de confiança; **não** expor score público nem alterar matching no piloto.
3. **Bilateral por par mot↔pax** — cada relação activa no acordo é avaliável em separado (1:N).
4. **Opt-in tardio** — pedir depois de experiência real, não no aceite da proposta.

---

## Momentos — quando pedir avaliação

### Fora de scope (nunca pedir nestes estados)

| Momento | Motivo |
|---------|--------|
| Browse `/explorar`, proposta aberta, negociação | Sem acordo; risco de spam e retalhação prematura |
| Aceite → `reservado` / `pendente_pagamento` / `comprovativo_enviado` | Relação ainda não «activa» com custódia (ENG#5, seat-before-custody) |
| Adenda pendente, rescisão em curso (`cancelamento_pendente`) | Conflito aberto — UX e fairness degradam |
| Waitlist, grupo `pendente` sem acordo | Sem par contractual |

### Candidatos piloto (ordenados por preferência assumida)

| ID | Momento | Gatilho sugerido | Notas |
|----|---------|------------------|-------|
| **M1** | Fim do **primeiro período liquidado** | `pagamentos_acordo.estado = liquidado` para `(acordo_passageiro_id, mes_referencia)` | Default recomendado: utilizador já viveu ~1 mês; alinha «settled trips» |
| **M2** | **Saída** do acordo (passageiro ou motorista) | Após `leave_passenger` ou `terminate_agreement` efectivo, se existiu ≥1 período `liquidado` | Captura feedback de quem terminou cedo |
| **M3** | **Renovação** M→M+1 | Opcional: prompt leve após `renew_agreement_period` + liquidação do mês anterior | Risco de fadiga — ver open questions |
| **M4** | Por **viagem diária** (ida/regresso) | Registo em `faltas` / calendário | **Fora do piloto** — granularidade alta, sem validação de presença GPS |

### Janela e cadência (hipótese)

- **Pedido único por par mot↔pax por período liquidado** (máx. 1 prompt M1 + eventual M2).
- Janela de resposta: **7–14 dias** após gatilho (valor exacto → PM).
- **Sem re-pedido** se ignorado no piloto (evitar dark patterns).

---

## Quem avalia quem

### Modelo base: bilateral mot↔pax

```
Acordo (1 motorista : N passageiros)
├── Para cada acordo_passageiro activo (ou que foi activo no período):
│   ├── Passageiro → avalia Motorista
│   └── Motorista → avalia Passageiro
└── Grupo: cada membro com lugar no acordo avalia/é avaliado **individualmente**
```

| Actor | Avalia | Vê o quê (piloto) |
|-------|--------|-------------------|
| **Passageiro** | Motorista do acordo | Próprias submissões; **não** score agregado público do motorista |
| **Motorista** | Cada passageiro activo no período | Próprias submissões; **não** perfil público de passageiro |
| **Grupo (owner/membro)** | Mesmas regras por **lugar** (`acordos_passageiros`), não «grupo» como entidade | Owner não avalia «pelo grupo inteiro» unless PM decide otherwise |
| **Admin** | — | Painel interno mínimo (futuro); **fora** deste plano de piloto UI |

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
- Tags opcionais (ex. «pontual», «comunicação») — **open question** PM.
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
| **Incentivos monetários** | Desconto/crédito por rating (Pack B / softs) |
| **Integrações** | WhatsApp/telefone como canal de review |
| **Pack B / ENG#35 / softs** | Qualquer feature listada nesses pacotes |

### Dependências (leitura only — não alterar)

- **ENG#31** contrato digital — snapshot de preço/N; **sem** overlap com rating.
- **ENG#34 / #150** contra-proposta CTA — **sem** alteração de runtime.
- Pagamentos **ENG#5/#11/#13/#14** definem quando existe «período liquidado» (gatilho M1).

---

## Open questions (PM)

1. **Granularidade:** M1 (por período liquidado) vs M2 (só na saída) vs ambos — qual é o MVP?
2. **Grupo:** passageiro avalia motorista uma vez ou owner + cada membro com lugar avalia separadamente?
3. **Motorista com N pax:** um formulário com lista ou N prompts separados?
4. **Renovação (M3):** pedir rating todos os meses ou só 1.º período + saída?
5. **Visibilidade contraparte:** no piloto, a outra parte vê o comentário ou só a plataforma?
6. **Moderação:** auto-publicar vs fila admin — quem actua em texto ofensivo?
7. **Retaliação:** bloquear rating se rescisão «justa causa» pendente/disputada?
8. **Matching futuro:** rating entra em matching só pós-piloto — confirmar horizonte?
9. **Copy PT-PT:** «Avaliar», «Classificação», «Reputação» — termo canónico na UI?
10. **Métrica de sucesso piloto:** taxa de resposta alvo (% pares com ≥1 rating)?

---

## Próximo ENG (stub)

Quando PM fechar open questions:

1. Spec de implementação (schema `avaliacoes` ou equivalente, RLS, RPC idempotente).
2. UI: prompt pós-M1/M2 em `/acordos` ou notificação + deep link (Stitch + UI Skills).
3. TDD: elegibilidade E1–E5, bilateralidade, sem leak para browse público.
4. Admin: export/listagem interna (sem Critiquito polish neste slice).

**Estimativa de complexidade:** média — sobretudo 1:N + gates de pagamento; UI simples se piloto for in-app only.

---

## DoD deste pacote (docs only)

- [x] Momentos documentados com gatilhos de domínio
- [x] Mot↔pax bilateral e papel do grupo esboçados
- [x] Non-goals explícitos (piloto mínimo)
- [x] Open questions para PM — sem inventar lei de produto rígida
- [x] Zero diff em `src/`, `supabase/`, runtime #31/#34/#150
