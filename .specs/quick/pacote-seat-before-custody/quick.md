# seat-before-custody — Soft-hold até em_custodia

**Data:** 2026-09-07  
**Tipo:** eng  
**Origem:** tick 22 · gap anti-leakage info-product / memo GAPS-20260907

## Problema

Hoje `accept_proposal` cria `acordos_passageiros` em `activo` e a vaga desce de imediato, antes de `em_custodia`. O assento «vale» sem dinheiro on-platform.

## Decisão de desenho

**Soft-hold** (sem overbooking):

| Estado passageiro | Ocupa capacidade? | N_activos confirmado? | Pagamento M0 | Faltas/contactos |
|-------------------|-------------------|----------------------|--------------|------------------|
| `reservado` | Sim | Não (ainda) | Criado | Não (gate custódia) |
| `activo` | Sim | Sim | — | Só com `em_custodia` |
| `saiu` | Não | Não | — | — |

- Aceite → `reservado`
- `admin_validate_payment(aprovar)` → `em_custodia` **e** `reservado`→`activo`
- `leave_passenger` permite sair de `reservado` ou `activo`
- TTL automático de reservas: **fora deste slice** (follow-up)

## Requisitos

| ID | Requisito | Verificação |
|----|-----------|-------------|
| S1 | CHECK `acordos_passageiros.estado` inclui `reservado` | SQL |
| S2 | `oferta_ocupacao` conta `reservado` + `activo` | SQL + Vitest |
| S3 | `accept_proposal` insere `reservado`; gate de vagas conta hold | SQL |
| S4 | Trigger pagamento cria M0 em `reservado` | SQL |
| S5 | `admin_validate_payment` aprovar promove `reservado`→`activo` + recount | SQL + serviço |
| S6 | `leave_passenger` aceita `reservado` | SQL |
| S7 | UI `/acordos`: copy «Lugar reservado — aguarda pagamento» | Vitest |
| S8 | Copy humana; sem jargon | UI |

## Fora do slice

- TTL/expire de reservas
- Mudança de política ida/regresso
- ProxyPay

## DoD

- Migração no remoto
- Testes verdes
- PR; merge = humano
