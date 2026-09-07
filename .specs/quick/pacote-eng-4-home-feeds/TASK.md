# PACOTE ENG #4 — Home feeds (parte eng)

## Objetivo
Passageiro autenticado vê ofertas e grupos na entrada, sem formulário de procura obrigatório.

## Acceptance
- ENG-4-1: Home lista ofertas (fixa + flexível sem OD inventada) e grupos (incompletos ok)
- ENG-4-2: Feeds autenticados (rota `/passageiro` + serviço com auth)
- ENG-4-3: Propor/pedir entrada pede mínimo só na acção (sem procura → CTA criar procura)
- ENG-4-4: WhatsApp não substitui fluxo in-app (sem regressão)
- ENG-4-5: UI nunca inventa OD (reutilizar `labelRotaOferta`)

## Diff mínimo
- `OfertaService.listOfertasDisponiveis` — browse autenticado
- `PassengerDashboard` — feed browse quando sem procura activa
- Testes TDD
