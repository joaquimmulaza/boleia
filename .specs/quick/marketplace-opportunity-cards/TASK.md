# Cartões de oportunidade + RouteIndicator

## Goal
Slice visual do feed de oportunidades (Figma `OUrBNaukPsXB14x2nwGSJy`, página `78:2`). Cartão de descoberta e `RouteIndicator`. O toque no cartão não cria proposta.

## Inventário (antes do código)
- `OfertaMatchCard` — match/waitlist/browse do hub. Seta Lucide, chip de estado, rota inventada na flexível («Sem origem/destino fixos»). Não é o cartão da página Figma.
- `DriverOfertaCard` — oferta do próprio motorista (editar/despublicar). Fora deste slice.
- `TextFade` — fade horizontal de 1 linha, só com overflow, sem ellipsis.
- `ProposalSheet` / `OverlayShell` / `SheetDragHandle` — sheets já existem. Detalhe e envio ficam no slice seguinte.
- `MarketplaceExplore` — feed público com markup inline (seta + «Entrar para propor»).
- Não existe `RouteIndicator`.

## Plano (diff mínimo)
1. Estender `TextFade` com `lines={2}` (fade só se a 3.ª linha for cortada). Sem componente novo de fade.
2. `RouteIndicator` — pontos + linha em CSS, altura do bloco, sem SVG do Figma e sem ícone Lucide.
3. `OpportunityCard` + modelo puro (`opportunityCard.js`) — o cartão actual não cumpre rota zero na flexível, CTA separado do toque, nem «Definido no acordo».
4. Trocar só o markup de `/explorar`. Hubs (`OfertaMatchCard`, procuras do motorista) ficam para o slice seguinte.

## Locks deste slice
- Toque (`onOpen`) ≠ CTA (`onCta`). O cartão não cria proposta.
- Oferta fixa: `RouteIndicator` com origem e destino reais.
- Flexível sem OD: zero rota inventada; título «Disponível para acordos».
- Preço real + modo («Por passageiro» / «Total do acordo»). Sem preço: «Definido no acordo». Nunca «A partir de». `TOTAL_ACORDO` não multiplica por N.
- CTA oferta «Propor acordo»; procura/grupo «Enviar proposta»; label `#06130b`. Sem lugares: CTA off e texto «Sem lugares disponíveis». 1 lugar é texto.
- Feed público só oportunidades vivas. O cartão não tem estado «expirada».
- OD no cartão: máx. 2 linhas + `TextFade` se a 3.ª for cortada; nome acessível = texto completo.
- Preço e CTA no rodapé, fora do botão de detalhe.
- Erro de carga em `/explorar`: «Não foi possível carregar as oportunidades» + «Tentar novamente». Loading e vazio com texto.

## Fora deste PR (slice seguinte)
- Detalhe (incl. frame `97:2`: «Disponível para acordos» + horário, um preço, sem rota, sem × N).
- Sheet do motorista: «Este número fica fixo nesta proposta.» (não no stepper do passageiro).
- Falha de envio: «Não foi possível enviar a proposta.»
- Chrome dos sheets (pega, Fechar, drag, Esc, reduced motion) — já existe em `OverlayShell`; não se reabre aqui.
- Trocar `OfertaMatchCard` e os cartões de procura do hub motorista.
- Headline opcional no detalhe flexível-total (soft, não bloqueia).
- Sem schema, migração ou contrato Supabase.
