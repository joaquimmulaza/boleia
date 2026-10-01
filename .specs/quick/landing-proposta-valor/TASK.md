# Landing — proposta de valor e email

## Pedido

Sincronizar `main`, trocar o contacto da landing e alinhar a copy ao problema real (boleia diária em Luanda combinada fora da plataforma) e ao fluxo que o produto já faz.

## Passagem 1 (feito)

- `git pull origin main` (fast-forward 44a73f6..d35c161). Alterações locais de docs foram stash/pop.
- Email do footer: `joaquimmulazadev@gmail.com` (Contacto, Termos, Privacidade).
- Copy: dor (mensagens soltas), proposta que a outra pessoa aceita, oferta flexível sem rota marcada, grupo incompleto, preço mensal registado, saída sem recalcular quotas, faltas com regra, pagamento por comprovativo.
- FAQ `#perguntas` e CTA «Criar conta» no header (registo; o papel escolhe-se no formulário).
- Sem números inventados, sem páginas legais, sem KYC, sem Multicaixa automático.

## Passagem 2 — copywriter (da dor à acção)

Feedback do fundador: copy correcta mas fria e difícil para leigos; sem dor, sem proposta de valor. Motoristas incluem rota flexível (Yango, Heetch, táxi, renda extra), não só commuters.

- Skill `.cursor/skills/boleia-copywriter/SKILL.md` (+ espelho `.agent/subagents/boleia-copywriter.md`): dor → alívio → prova → pedido; «tu»; orçamento de palavras; claims proibidos.
- Copy final: `COPY.md` (mesma pasta), produzida pelo subagente copywriter.

### Gate de design (ui-designer)

- UI Skills `ibelick/baseline-ui` reconsultada: sem gradiente novo, sem animação nova, `text-balance` em títulos / `text-pretty` em parágrafos, `tabular-nums` em valores Kz, `size-*` em quadrados, um accent (`primary`). O gradiente do hero é pré-existente (refresh LP-01) e mantém-se; não se acrescenta outro.
- Estrutura: 5 blocos — Hero → «O que muda» (`#o-que-muda`) → «Como funciona» (`#como-funciona`) → «Perguntas» (`#perguntas`) → CTA. Sai a secção «Segurança» (`#seguranca`): a palavra é claim proibido e o conteúdo (preço registado, lugar reservado) vive em «O que muda» e nas Perguntas. `#vantagens` passa a `#o-que-muda`.
- «O que muda» = recomposição do padrão de cartão já existente (`LandingBenefits`): grelha 2 colunas (`md:grid-cols-2`), cada coluna com cabeçalho (ícone Lucide + «Passageiro» / «Motorista») e 3 itens `h3` + `p`. Sem primitivo novo; sem Stitch screen nova (o projecto Stitch `8575463146283895778` não tem ecrã de landing; recomposição de padrão existente, não ecrã novo — anotado).
- Hero: mesmo layout; cartão 2 passa de «Quem precisa de boleia» para «Oferta flexível» (sem rota marcada · Seg–Sex · 6h–9h · 3 lugares) — mostra o motorista de aplicativo logo no primeiro ecrã.
- Header: 3 âncoras (O que muda, Como funciona, Perguntas) na ordem da página.
- Estados: landing estática, sem loading/erro; CTAs navegam para `/auth?mode=register&role=…`.

### Testes (TDD)

- Dor concreta no hero e em «O que muda» (`/táxi|paragem|trânsito/`).
- Motorista: `/renda extra|rendimento/` e `/aplicativo|Yango|táxi/` e `/sem rota marcada/`.
- Orçamento: headline ≤10 palavras; frase de apoio do hero ≤45 palavras; respostas FAQ ≤35.
- Claims proibidos em toda a landing: `/seguro|segurança|verificad|garantid|multicaixa|proxypay/i`; jargon `N_*`, `1:N`, `marketplace`, `matching`, `custódia`.
- Âncoras `#o-que-muda`, `#como-funciona`, `#perguntas`; `#seguranca` e `#vantagens` ausentes.

## Fora

Páginas de Termos/Privacidade. Regra das faltas (meio dia / dia) sai da landing — vive no detalhe do acordo.

## Verificação

Testes Vitest da landing + lint nos ficheiros tocados; ui-qa + code-reviewer + copywriter (review) com `VERDICT`.
