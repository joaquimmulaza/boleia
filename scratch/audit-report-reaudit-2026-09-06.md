# Reauditoria — Visão × Estado actual (2026-09-06, tarde)

**Branch:** `cursor/fix-optional-pickup-flow-24e8` @ `ca6a7d1`  
**Baseline anterior:** `scratch/audit-report.md` (manhã)  
**Método:** diff de evidência (migração `20260906120000_*`, specs quick, serviços/UI, SQL live `boleia`) — sem código novo nesta passagem.

---

## Resposta directa

**Não: já não falta “muito” para a visão do marketplace core.**  
Falta **uma fatia clara de pós-acordo** (rescisão plena + adenda verdadeiramente bilateral + hardening residual), não o produto de matchmaking em si.

| Camada da visão | Cobertura aproximada | Leitura |
|-----------------|----------------------|---------|
| §1–21 + §23–31 (marketplace Oferta↔Procura, 20 invariantes, fluxos 1–5) | **~90%** | MVP utilizável e alinhado |
| §22 renegociação bilateral completa + rescisão | **~45–55%** | Aceitar/rejeitar adenda do motorista existe; falta iniciativa do passageiro, contraproposta, terminate |
| Fora do MVP (zonas/polígonos) | 0% (correcto) | Explicitamente deferido |

---

## Delta desde a auditoria da manhã (fechado)

| Gap anterior | Estado agora | Evidência |
|--------------|--------------|-----------|
| Composição silenciosa `LIMIT v_n` | **Fechado** | RPC `accept_proposal(..., p_member_ids uuid[], …)`; UI picker `PropostaReviewCard`; hubs passam `memberIds` |
| Self-INSERT membro `activo` | **Fechado** | RLS `membros_insert_envolvidos`: self ⇒ `estado='pendente'` |
| Rejeitar adenda | **Fechado** | RPC `reject_agreement_adenda` + `AgreementService.rejectAgreementAdenda` + CTA «Rejeitar Alteração» |
| Estados adenda só 2 valores | **Parcial→melhor** | CHECK: `pendente_passageiro`, `pendente_contraparte`, `rejeitada`, `cancelada_iniciador`, `aceite`, `em_vigor` |
| Divisor adenda = N_activos | **Fechado** | `renegotiate`: `v_n := v_acordo.n_passageiros_contrato` |
| Telefone como fluxo principal | **Fechado (UX)** | `GrupoProcuraPanel`: secção colapsável «Fallback: Convidar por telefone» |
| Pickup obrigatório no convite | **Fechado** (este branch) | Pickup opcional E2E (`null` persistido) |

Specs: `.specs/features/audit-db-security-gaps/quick.md`, `.specs/features/ui-audit-gaps/quick.md`, `.specs/features/grupo-pickup-opcional/quick.md`.

---

## Matriz dos 20 invariantes (§27) — actualizada

| # | Invariante | Manhã | Agora |
|---|------------|-------|-------|
| 1–18 | Grupo vivo, Ns, preço, capacidade, flex, propostas A/B, contraparte | FULLY | **FULLY** |
| 19 | Telefone não substitui plataforma | PARTIAL | **FULLY** (descoberta + pedido; telefone só fallback colapsado) |
| 20 | Regras críticas no backend | PARTIAL | **Quase FULLY** — resto: UPDATE livre de `ofertas.vagas_*` (P2; accept ainda reconta activos) |

Cenário **N_actual > N_proposto**: manhã PARTIAL → agora **FULLY** (lista explícita obrigatória na RPC + picker UI).

---

## O que ainda falta (ordenado por impacto na visão)

### A. Produto pós-acordo (§22) — o buraco real

1. **`terminate_agreement`** e estados `CANCELAMENTO_PENDENTE` / rescisão amigável / justa causa — **não existe** RPC nem UI. Hoje só `leave_passenger` (sai um passageiro imediatamente).
2. **Adenda iniciada pelo passageiro** — estados `pendente_contraparte` existem na BD, mas `renegotiate_agreement_pricing` continua **só motorista** (`IF v_uid <> driver_id`).
3. **Contraproposta** de adenda — não implementada (só aceitar/rejeitar a proposta do motorista).

### B. Hardening / polish (não bloqueia o fluxo feliz)

4. **RLS/`BEFORE UPDATE` em `ofertas_capacidade.vagas_*`** — motorista ainda pode UPDATE directo (matching pode mentir; aceite continua seguro via recontagem).
5. **Waitlist automática** no accept com vagas insuficientes — ainda é erro + enqueue manual (decisão de produto).
6. **Testes de integração Postgres** multi-user — suite continua mock-first (há spec `.specs/features/integration-tests/`).
7. **`CANCELADA_SUBSTITUÍDA`** como estado nomeado — hoje usa-se `superseded_at` (equivalente funcional parcial).

### C. Explicitamente fora do MVP (não contar como “falta”)

- Zonas / polígonos / raio residencial  
- WhatsApp como motor de acordo (só auxiliar)

---

## Fluxos da visão §26 — checklist rápido

| Fluxo | Estado |
|-------|--------|
| 1 Passageiro → ofertas → proposta → aceite → acordo | ✅ |
| 2 Grupo incompleto → M propostas → aceite 1:N | ✅ (+ composição explícita) |
| 3 Motorista flex → procuras → proposta B | ✅ |
| 4 Grupo cresce durante negociação (snapshot intacto) | ✅ |
| 5 Capacidade insuficiente → sem parcial → waitlist | ✅ (waitlist opt-in, não auto no accept) |
| Renegociação bilateral plena | ⚠️ só motorista→pax + reject |
| Rescisão estruturada | ❌ |

---

## Conclusão para planeamento XP

- **Para “atingir a visão do marketplace” (contratar boleias 1:N com as 20 invariantes):** estão **essencialmente lá**. O trabalho restante é hardening e dívida de testes, não reinventar o domínio.
- **Para “atingir o documento de visão *inteiro* incluindo §22”:** falta **1 epic médio** (rescisão + adenda bilateral/contraproposta), tipicamente **várias tasks atómicas TDD**, não um rewrite.

Prioridade sugerida se o objectivo for fechar a visão escrita:

1. Spec + Task `terminate_agreement` (aviso prévio fim-do-mês primeiro)  
2. `propose_agreement_adenda` bilateral (usar `pendente_contraparte`)  
3. Hardening `vagas_*`  
4. Integração Postgres opcional  

*Não gerar fixes nesta passagem — só reauditoria.*
