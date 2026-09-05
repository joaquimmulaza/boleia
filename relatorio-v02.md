Relatório de revisão — o que ainda falta (só leitura)
Data: 2026-09-05 · Base docs: AUDIT_GAPS_WAVE.md + WAVE_PARALLEL_REPORT.md + Alpha/Beta/Gamma + síntese suite
Modo: sem alterações de código
Suite (última síntese): 432 passed · 0 failed · 8 todo · VERDICT wave: APPROVE

1. Resumo executivo
O MVP marketplace (Phases 6–7 + P0 + R1–R4) está funcionalmente fechado. Não há blockers P0 conhecidos.

O que falta é sobretudo:

Commit do trabalho uncommitted
Cobertura de testes G5–G12 (e um cenário G3 original por ordem_insercao)
UI residual (picker de dias na procura; teto mensal)
Itens fora do MVP (zonas/polígonos)
Alinhamento estimado vs spec MVP: ~90–95% (antes da wave Alpha/Beta/Gamma estava ~65–70% na auditoria profunda).

2. Já fechado (não reinventar)
Bloco	Estado
Phase 6 T22–T31
Done (T31 pushed; T29–T30 uncommitted)
Phase 7 T32–T35
Done (uncommitted)
P0 hardening
leave_passenger, DROP UPDATE client em propostas/acordos/acordos_passageiros/lista_espera, membros owner-only
R1 dias
procuras.dias_semana + intersecção estrita
R2 waitlist UI
Hub motorista direct / waitlist separados
R3 adenda
pendente_passageiro → accept_agreement_adenda → aceite
R4 copy
Empty passageiro sem «zona»
Alpha G1–G4
Cascata irmãs, N_actual<N_proposto, overbooking, leave→RPC
BD (MCP verificado agora): RPCs accept_proposal, reject_proposal, leave_passenger, leave_grupo_membro, promote_waitlist, renegotiate_agreement_pricing, apply_due_agreement_adendas, accept_agreement_adenda existem. Políticas UPDATE client nas 4 tabelas críticas: nenhuma (OK).

3. Dívida de cobertura — G1–G12 (actualizado)
Gap original	Estado actual	Nota
G1 Cascata irmãs no aceite
Feito (Alpha)
Assert Vitest
G2 N_actual < N_proposto
Feito (Alpha)
G3 Aceite por ordem_insercao
Ainda aberto
Alpha G3 cobriu overbooking, não este cenário
G4 Capacidade = soma N_activos multi-acordo
Ainda aberto
Em it.todo (como G10)
G5 Leave → promote FIFO sem auto-aceitar
Parcial
Servidor + Alpha G4 (contrato RPC); E2E FIFO dedicado ainda it.todo
G6 Sense B created_by motorista
Aberto (it.todo)
G7 Copy adenda «próximo mês»
Parcial
R3 + UI/testes MyAgreements; audit dedicado ainda todo
G8 Router waitlist_promoted
Parcial
Rota existe em notificationRouter; assert dedicado em falta
G9 Falta quota/dias_uteis numérica
Aberto
Fórmula no trigger; assert numérico Vitest em falta
G10 Overbooking multi-acordo
Parcial
Overbooking serviço em Alpha G3; multi-acordo explícito em falta
G11 RLS sem UPDATE client
Feito no produto
Confirmado MCP; falta smoke/advisor automatizado no audit
G12 UI hubs sem jargon
Aberto
Smoke/grep dedicado em falta
Prioridade sugerida para próxima wave de testes: G3 (ordem_insercao) → G4/G10 (capacidade multi-acordo) → G6 → G9 → G5 E2E → G8/G12 → G11 advisors.

4. Gaps de produto / UX (não são bugs P0)
Item	Severidade	Evidência
Picker dias_semana na procura
P1 UX
Serviço grava default Seg–Sex; PassengerDashboard não expõe escolha de dias
UI teto_mensal_kz
P2
Campo no serviço; sem UI óbvia no hub
Soft-hide / desactivar oferta
P2 / pós-MVP
is_hidden_by_user filtrado em acordos; fluxo completo de desactivar oferta pouco evidenciado
Zonas / polígonos / raio residencial
Fora do MVP
Explicitamente excluído
Traceability MKT-* na spec.md
Docs
Vários MKT ainda «Pending» apesar do código Done
CHECKPOINT «Verdade dura» adenda
Docs
Ainda fala em «MVP aplica de imediato» — desactualizado face a R3 (effective_from + consentimento)
Lista RPC no CHECKPOINT §Stack
Docs
Não lista accept_agreement_adenda / leave_* / cancel_proposal
Smoke browser QA
Opcional
Contas no CHECKPOINT; não há evidência de passe manual recente nesta sessão
Commit
Operacional
Working tree suja desde 8603aa6; suite verde — pronto a commit se pedires
5. O que não falta (mitigações da auditoria antiga)
Já resolvidos e não devem voltar à fila P0:

Leave client a falhar sob RLS → RPC leave_passenger
UPDATE client forjar propostas/acordos/waitlist → policies DROP
Auto-aprovação de grupo → owner + RLS
Matching dias no-op (procura sem coluna) → R1
Adenda sem consentimento passageiro → R3
Hub motorista a fundir direct+waitlist com CTA errado → R2
Copy «zona» no empty passageiro → R4
Inbox exports / cancel própria / flex sem OD / Phase 7 A/B → feitos na wave paralela + T32–T35
6. Backlog recomendado (ordem)
Commit (pedido explícito) — pacote Alpha/Beta/Gamma + resto uncommitted
Alpha II — G3 ordem_insercao, G4/G10 capacidade multi-acordo, G6 sense B
UI micro — picker dias na procura (e opcionalmente teto mensal)
Docs — alinhar CHECKPOINT/spec MKT-* e lista de RPCs
QA manual — contas CHECKPOINT (fluxo A/B + adenda + waitlist)
Fora do MVP — zonas/polígonos (só se produto pedir)
7. Veredicto
VERDICT: APPROVE (produto MVP)
ISSUES:
- Dívida de cobertura G3 original + G5–G12 (não bloqueante)
- UI dias na procura ainda sem picker (default Seg–Sex no serviço)
- Docs parcialmente desactualizados (adenda / MKT status / RPCs)
- Trabalho uncommitted (commit só sob pedido)
NEXT: commit se quiseres; depois wave testes G3/G4/G6 ou picker dias
Nada foi alterado neste passo — só revisão e relatório.