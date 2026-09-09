# Editar procura activa — Specification

## Problem Statement

No piloto, a passageira criou uma procura com teto demasiado alto e não encontrou forma de retificar. O hub só mostra «Ver ofertas compatíveis». Sem edição, o único workaround é intervenção manual — inaceitável para um marketplace vivo.

## Goals

- [ ] O dono edita a procura activa (OD, horário, dias, teto) enquanto não houver acordo fechado
- [ ] Snapshots de propostas (`preço`, `N_proposto`, oferta) nunca são mutados pela edição
- [ ] Incompatibilidade de matching invalida explicitamente; teto baixo só mostra «Acima do teto»
- [ ] Confirmação de edição só quando houver impacto (propostas a invalidar)
- [ ] Cancelar/arquivar a procura com notificações claras à contraparte
- [ ] `return_time` preservado (reservado; sem UI nesta feature)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Reabrir procura `fechada` | Um aceite fecha a procura; nova procura é o caminho |
| Editar oferta do motorista | Superfície distinta |
| Teto como filtro de matching | Preferência de UI, não regra de match |
| Campo/matching de `return_time` | Reservado; só preservar no UPDATE |
| Tabela `procuras_historico` | `updated_at` + estados + notifs bastam |
| Alterar `n_candidato`, `n_maximo`, grupo, pickups | Edição da procura não é gestão de grupo |
| Usar edição para corrigir uma proposta enviada | Proposta = snapshot; nova proposta se precisar |

---

## User Stories

### P1: Editar procura activa ⭐ MVP

**User Story**: Como dona da procura, quero corrigir origem, destino, horário, dias e teto na procura activa, para o matching reflectir o que realmente preciso.

**Why P1**: Feedback directo do piloto (retificar teto / dados).

**Acceptance Criteria**:

1. WHEN a procura está `activa` ou `em_negociacao` e não existe acordo `activo`/`cancelamento_pendente` THEN o cartão SHALL mostrar CTA «Editar procura»
2. WHEN o estado é `fechada` ou `cancelada` ou existe acordo activo THEN o sistema SHALL esconder o CTA e a RPC `update_procura` SHALL recusar
3. WHEN o dono grava OD, horário, dias e/ou teto THEN o sistema SHALL actualizar só esses campos (nunca `n_candidato`, `owner_id`, `n_maximo`, grupo)
4. WHEN o cliente omite `return_time` THEN a RPC SHALL preservar o valor existente (não anular com `null`)
5. WHEN a edição conclui THEN o hub SHALL recarregar matches com os novos OD/hora/dias

**Requirement IDs**: EDIT-P-01, EDIT-P-02, EDIT-P-03

---

### P1: Snapshots intactos + invalidação explícita ⭐ MVP

**User Story**: Como passageira ou motorista com proposta aberta, quero que o valor e o N negociados não mudem se a procura for editada.

**Why P1**: Invariante de produto (proposta = snapshot).

**Acceptance Criteria**:

1. WHEN a edição torna uma proposta `aberta` incompatível de matching (hora/dias/OD vs oferta fixa) THEN o sistema SHALL pôr `estado = invalidada` sem alterar preço, `n_passageiros_propostos`, `oferta_id` nem `modo_preco`
2. WHEN a oferta ligada é flexível e só a OD muda THEN a proposta SHALL permanecer `aberta`
3. WHEN só o teto muda THEN todas as propostas abertas SHALL permanecer `aberta`
4. WHEN o teto da procura fica abaixo do valor resolvido da proposta (mesmo modo) THEN a UI SHALL mostrar chip «Acima do teto» e a proposta SHALL continuar `aberta`

**Requirement IDs**: EDIT-P-04, EDIT-P-05

---

### P1: Confirmação por impacto ⭐ MVP

**User Story**: Como dona, quero ser avisada só se a edição invalidar propostas, para não ter fricção ao corrigir só o teto.

**Why P1**: Pedido explícito pós-auditoria.

**Acceptance Criteria**:

1. WHEN o preview (`evaluateMatch`) indica 0 propostas a invalidar THEN o sistema SHALL gravar sem modal de impacto
2. WHEN o preview indica N ≥ 1 THEN o sistema SHALL mostrar `ConfirmationModal` com a contagem e copy de que preço/N não mudam
3. WHEN a dona cancela/arquiva a procura THEN o sistema SHALL mostrar modal sempre (destrutivo) com contagem de propostas abertas e waitlist

**Requirement IDs**: EDIT-P-06

---

### P1: Cancelar/arquivar procura ⭐ MVP

**User Story**: Como dona, quero arquivar a procura activa quando já não preciso dela.

**Why P1**: Complemento necessário à edição (piloto sem escape hatch).

**Acceptance Criteria**:

1. WHEN o dono confirma «Cancelar procura» THEN a RPC `cancel_procura` SHALL pôr a procura em `cancelada`
2. WHEN existem propostas `aberta` THEN o sistema SHALL pô-las em `cancelada` sem mutar snapshots
3. WHEN existem entradas de waitlist activas THEN o sistema SHALL pô-las em `cancelada`

**Requirement IDs**: EDIT-P-07

---

### P1: Notificações claras ⭐ MVP

**User Story**: Como contraparte, quero saber se a proposta ficou incompatível ou se a procura foi cancelada.

**Why P1**: Sem aviso, a inbox fica silenciosa e incorrecta.

**Acceptance Criteria**:

1. WHEN uma proposta é `invalidada` por edição THEN o sistema SHALL notificar a contraparte com tipo `proposal_invalidated` (copy: procura actualizada; valor não alterado)
2. WHEN o dono arquiva a procura THEN o sistema SHALL notificar a contraparte de cada proposta aberta com tipo `proposal_cancelled` (copy: procura cancelada; proposta sem efeito)
3. WHEN a edição não invalida ninguém THEN o sistema SHALL NÃO enviar estas notificações
4. WHEN o utilizador toca na notificação THEN o router SHALL abrir o hub da contraparte (`metadata.inbox`)

**Requirement IDs**: EDIT-P-08

---

## Edge Cases

- WHEN o utilizador não é o `owner_id` THEN a RPC SHALL recusar
- WHEN a procura está `fechada` THEN editar e cancelar SHALL falhar
- WHEN waitlist fica incompatível após edição de OD/hora/dias THEN o sistema SHALL cancelar só essas entradas
- WHEN `n_candidato` muda por sync de grupo (outro fluxo) THEN a edição da procura SHALL não o sobrescrever

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| EDIT-P-01 | P1: Editar procura | Execute | Verified |
| EDIT-P-02 | P1: Gate estado/acordo | Execute | Verified |
| EDIT-P-03 | P1: Preservar return_time / N / grupo | Execute | Verified |
| EDIT-P-04 | P1: Invalidar incompatíveis | Execute | Verified |
| EDIT-P-05 | P1: Teto + chip «Acima do teto» | Execute | Verified |
| EDIT-P-06 | P1: Confirmação por impacto | Execute | Verified |
| EDIT-P-07 | P1: Cancelar procura | Execute | Verified |
| EDIT-P-08 | P1: Notificações | Execute | Verified |

## Success Criteria

- [ ] Maria Elsa (ou equivalente) consegue baixar o teto sem criar procura nova
- [ ] Proposta antiga mantém preço e N após qualquer edição
- [ ] Testes A–H verdes + lint
