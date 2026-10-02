# Login social — design

## Gate

Stitch MCP (`user-stitch`) falhou na autenticação (timeout). UI Skills MCP não está ligado neste ambiente. Mobbin não foi consultado. O ecrã não é uma superfície nova: reutiliza o cartão de [`src/pages/Auth.jsx`](src/pages/Auth.jsx) (max-w 400px, `rounded-2xl`, `h-14`, `bg-primary`, fundo `background-light` / `dark`).

Constraints aplicadas (baseline de UI, sem inventar outro visual):

- Alvos de toque altos (`h-14`, largura total).
- Um CTA preenchido (Entrar / Registar / Continuar). Os providers são botões de contorno, para não competir com o formulário.
- Copy de acção: «Continuar com {Provider}», não só o nome da marca.
- Estado pending no próprio botão e os outros desactivados.
- Erro em `role="alert"`, sem jargão técnico.
- Foco visível (`focus-visible:ring`).
- Ícones de marca decorativos (`aria-hidden`); o nome acessível está no botão.

## Flow

1. Entrar ou Criar Conta mostra quatro botões, divisor «ou», depois email e palavra-passe.
2. Clique → «A ligar ao {Provider}...» → redirect do Supabase.
3. Volta a `/auth`. Perfil incompleto → completar nome, telefone e papel. Perfil completo → hub.
4. Cancelamento ou erro → mesma página, botões outra vez activos, alerta curto.
5. Perfil → «Métodos de início de sessão» com visto ou «Associar».

## Estados

- Idle, pending por provider, sucesso (sai da página), cancelado, erro de provider, state inválido, email em falta no completar perfil, manual linking desligado.

## Componentes

- `SocialAuthButtons` — botões outline, sem primitivo shadcn novo (o ecrã Auth já não usa Button do registry).
- `LoginMethodsSection` — lista no cartão branco do perfil, igual aos blocos de dados pessoais.
- Tokens existentes: `primary`, `background-light`, `background-dark`.

## Stitch

Project resolution não concluída: metadata `.stitch/metadata.json` ausente e o MCP não autenticou. Sem `projectId` e sem screen id. Não se usou v0.

VERDICT: APPROVE com ressalva de SoT Stitch indisponível; implementação limitada ao shell já em produção.
