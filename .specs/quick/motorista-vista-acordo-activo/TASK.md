# Motorista — vista pagamentos em acordo activo

## Objetivo
Motorista em acordo **activo** vê secção read-only de pagamentos dos passageiros via RPC `list_pagamentos_pendentes_motorista_acordo` (sem alargar RLS).

## Requisitos
- Painel visível no detalhe quando `tipoPerfil === 'Motorista'` e acordo activo.
- S4 (`comprovativo_enviado`): linha com `valor_comprovativo` + texto de prazo «até {data}» (sem countdown).
- Estados: pendente, comprovativo (S4), excesso (S6b) — testes de componente.
- Terminado: mantém comportamento actual (`acordoTerminado`).

## Fora de âmbito
- Notificações, `leave_passenger`, `terminate_agreement`, migrações.
