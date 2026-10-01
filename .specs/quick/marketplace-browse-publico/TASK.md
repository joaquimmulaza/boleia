# Marketplace browse público + propor sem oferta

## Goal
Marketplace convencional: ver ofertas e procuras **sem inscrição**; motorista vê procuras **sem oferta activa**; «Enviar proposta» **cria oferta mínima** na acção (espelho ENG#23).

## Decisões (produto)
1. Browse anónimo em `/explorar` (ofertas + procuras), só leitura; CTAs → `/auth`.
2. Motorista autenticado: lista procuras sem gate de oferta; propor sem oferta publicada → `buildOfertaMinimaFromProcura` + `createOferta` + `createProposta`.

## AC
1. Anon SELECT RLS (ofertas `disponivel|parcial`; procuras `activa|em_negociacao`) + GRANT SELECT.
2. `listOfertasDisponiveis` / `listProcurasDisponiveis` funcionam sem sessão (feed público).
3. Rota pública `/explorar` com tabs Ofertas | Procuras; CTA «Entrar para propor» → `/auth`.
4. `DriverDashboard`: sem empty-state «precisa oferta activa»; carrega `listProcurasDisponiveis` sempre.
5. Sem oferta: toggle «Só compatíveis» desactivado/oculto; «Enviar proposta» disponível no browse.
6. Util `buildOfertaMinimaFromProcura` (flexível, OD null, horário/dias da procura; preço do sheet).
7. Passageiro browse sem procura: já OK (ENG#4/#23) — preservar.
8. Testes Vitest verdes; sem jargon N_* na UI.

## Fora de âmbito
- Contactos/telefone públicos; inventar OD em flexível; zonas.
