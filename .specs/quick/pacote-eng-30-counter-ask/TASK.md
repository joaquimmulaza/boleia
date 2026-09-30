# PACOTE #30 — Counter-ask preço na proposta

## Objetivo
Desbloquear valor mensal editável ao criar proposta (counter-ask), mantendo default = ask da oferta.

## AC
1. Passageiro/motorista pode editar valor mensal (Kz) ao propor.
2. RPC recebe valor escolhido pelo utilizador.
3. Default pré-preenchido com `valor_mensal_ask_kz`.
4. Validação: valor > 0.
5. Flex: sem inventar OD.
6. Idempotência #29 intacta.

## Escopo
- `PropostaValorInput`, `propostaValor.js`
- `PassengerDashboard`, `DriverDashboard`
- `PacoteEng30Acceptance.test.jsx`
