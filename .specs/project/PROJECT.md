# Boleia Certa — Visão de Produto

> Fonte canónica condensada. Detalhe longo: `Boleia_Certa_Visao_e_Fluxo_de_Produto.md` (raiz).  
> Princípio: este documento define o comportamento desejado; a implementação não deve reinterpretar regras de negócio para as “facilitar”.

## Frase de referência

> **O Boleia Certa conecta quem precisa de transporte com quem tem capacidade para oferecer transporte, permitindo que passageiros, grupos e motoristas se encontrem, proponham, negociem e formem acordos de forma flexível e estruturada.**

## Modelo central

Não é 1 motorista ↔ 1 passageiro.

> **Oferta de capacidade ↔ Procura individual/coletiva ↔ Múltiplas propostas ↔ Acordo 1:N**

Marketplace bilateral:

- Passageiro/grupo pode procurar motoristas e iniciar proposta
- Motorista pode procurar passageiros/grupos e iniciar proposta
- Só a **contraparte** aceita ou rejeita
- O criador nunca aceita a própria proposta (UI + serviço + RPC + RLS)

## Utilizadores

### Passageiro

Procura individual; entrar/criar grupo; ofertas fixas e flexíveis; enviar/receber propostas; sair do acordo conforme regras. Telefone/WhatsApp **não** são o fluxo principal.

### Grupo (procura coletiva viva)

Pode negociar incompleto (ex. 2/4). Crescimento de `N_actual` **não** muta propostas antigas. Nova composição → nova proposta com novo `N_proposto`.

### Motorista — oferta fixa

OD obrigatória + horário + dias + capacidade + preço. Matching geográfico usa OD.

### Motorista — oferta flexível

Capacidade + disponibilidade + dias + janela + preço. **Sem** OD obrigatória. Residência **não** limita área de atuação. Pode receber e enviar propostas.

## Quatro N

| N | Significado | Mutável? |
|---|-------------|----------|
| `N_actual` | Membros actuais do grupo | Sim |
| `N_proposto` | Snapshot na proposta | Não (automático) |
| `N_contrato` | Congelado no aceite | Só via adenda/renegociação explícita |
| `N_activos` | Passageiros activos no acordo | Pode baixar na saída |

## Preço

- `POR_PASSAGEIRO` — individual = proposto; total = individual × N
- `TOTAL_ACORDO` — total = proposto; individual = total ÷ N
- Divisor = `N_proposto` (proposta) / `N_contrato` (acordo) — **nunca** capacidade do veículo nem `N_activos`
- Aceite congela preço + N; saída de passageiro **não** recalcula quotas dos restantes
- Copy UI: «Por passageiro» / «Total do acordo» — nunca jargon

## Capacidade e waitlist

`vagas_disponiveis = vagas_totais − passageiros activos`. Sem acordo parcial se `N_proposto > vagas`. Waitlist sem auto-aceitar; promoção = notificação, decisão humana.

## Fluxos principais

1. Passageiro → ofertas compatíveis → proposta → motorista aceita → acordo 1:N  
2. Grupo incompleto negociável → M propostas → 1 aceite → acordo  
3. Motorista flexível → procuras → proposta → pax/grupo aceita → acordo  
4. Grupo cresce após proposta → snapshot antigo intacto → nova proposta se preciso  
5. Capacidade insuficiente → waitlist, sem partial accept  

## Renegociação e rescisão (resumo)

- Adendas: consentimento da contraparte; vigência **próximo mês** (não retroactivo)
- Rescisão: consensual; unilateral fim de ciclo; imediata só com justa causa
- Detalhe de estados/RPCs: ver doc de visão §22 e código/`AGENTS.md`

## Monetização (decisão de negócio 2026-09-07)

Ver `STATE.md` e `ROADMAP.md`. Resumo:

- Take-rate ~10% + custódia (escrow) como modelo alvo
- MVP pagamentos: IBAN + comprovativo (semi-escrow manual) antes de ProxyPay/Multicaixa API
- Foco narrativa: commute casa↔trabalho (não “universidade” no pitch enquanto a landing for só commute)
- Anti-leakage: valor on-platform (faltas, payout, seat fill) > esconder WhatsApp

## Critério de consistência

Uma feature só está “feita” quando a mesma regra vale em:

> **Produto → Spec → BD → RPC/RLS → Serviços → UI → Testes**

## Regra para agentes

- Não inventar regras de negócio; não quebrar invariantes para facilitar código
- Conflito código vs visão → identificar e propor correção; não assumir que o código é a verdade
- Validar contra os quatro N e `.cursor/rules/product-invariants.mdc`
