# Landing Page Refresh — Design

## Gate status

```text
VERDICT: APPROVE
ISSUES:
- Mobbin: falhou (plano free / paid required) — degradado; design segue UI Skills + v0 + tokens locais
- UI Skills: ibelick/baseline-ui aplicado (hierarquia, a11y icon buttons, text-balance/pretty, h-dvh)
NEXT: Execute paralelo (nav / hero / sections)
```

## Flow (visitante não autenticado)

```
Landing (/)
  → Header: âncoras | Entrar | Menu mobile
  → Hero: dual CTA Passageiro | Motorista → /auth?mode=register&role=…
  → Como funciona → Vantagens → Segurança
  → CTA final → /auth
  → Footer: Entrar | Contacto mailto | Termos/Privacidade honestos
```

## Estados

| Superfície | Estados |
|------------|---------|
| Menu mobile | fechado / aberto; Escape, overlay, link → fecha |
| Hero | estático (sem loading remoto — sem imagem externa) |
| Secções | conteúdo sempre presente (página estática) |
| Theme | light/dark via ThemeToggle existente |

## Componentes shadcn / repo

| Peça | Fonte |
|------|--------|
| CTAs | Reutilizar `src/components/ui/button.jsx` (variantes) **ou** botões com classes tokens primary (como landing actual) |
| Menu mobile | Padrão drawer de `NotificationBell.jsx` (overlay + painel) — **não** obrigatório instalar Sheet neste ciclo |
| ThemeToggle | `src/components/ThemeToggle` |

Não instalar novos primitivos shadcn neste ciclo salvo necessidade (button já existe).

## Referências

### UI Skills (`ibelick/baseline-ui`)

- `aria-label` em botão Menu icon-only
- `h-dvh` / `min-h-dvh`; `text-balance` headings; `text-pretty` body
- Gradiente no hero: **pedido explícito** no Spec/HANDOFF (excepção à regra “never gradients” do baseline)
- Sem purple/glow; accent único emerald `#10b748`

### Mobbin

- **Degradado** — MCP exige plano pago. Sem screens.

### v0 (One)

- Chat ID: `faoKylQkkKB`
- Título: Boleia Certa — Landing Refresh
- Prompt: BUILD NOW (gerar UI, não só plano) — **interface gerada** (`finishReason: stop`, file-edit `app/page.tsx`, build + browser check)
- Headline v0 de referência: «Casa e trabalho. No mesmo caminho.»
- Eyebrow: «A boleia que faz sentido»
- Connection: `live::v0::default::b1c567adf6fe4a22abee4972d3091ad4`
- Nota: v0 gerou em sandbox Next/TSX — adaptar para Vite + JSX no repo (não dump cego)
- **Regra SoT:** se resposta for só plano → Send Message «Implementa agora…»; gate só com código/preview

## Direcção visual (contrato de implementação)

### Hero (LP-02)

- Full-bleed: gradiente urbano `primary` → `background-light/dark` (+ padrão subtil CSS se útil)
- Sem `googleusercontent` / URLs stock
- Marca `/boleia-logo.png` hero-level
- Headline + 1 frase + CTAs + mock JSX (Oferta / Procura / Acordo · Kz)
- Sem card chrome no hero; mock é o âncora visual do produto

### Header (LP-01, LP-04)

- Desktop: links `#como-funciona`, `#vantagens`, `#seguranca`
- Mobile: `button` Menu + painel; `aria-expanded` / `aria-controls`
- Entrar → `/auth`

### Secções (LP-03, LP-06)

- Copy marketplace PT-PT; soft claim CTA; footer sem Blog

## Tokens

- `--color-primary` / `primary` `#10b748`
- `bg-background-light` / `dark:bg-background-dark`
- `font-display`

## Arquitectura de ficheiros

Ver `tasks.md` — scopes disjuntos para paralelismo.
