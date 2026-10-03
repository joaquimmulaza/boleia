# Login social (Google, Facebook, LinkedIn)

A app usa **Supabase Auth**. O browser chama `signInWithOAuth` com PKCE. Os client secrets ficam no Supabase (Dashboard em produção, variáveis de ambiente no CLI local). Nada disto leva o prefixo `VITE_`.

Não há teste end-to-end contra os fornecedores neste repositório: as credenciais não estão no ambiente.

## Providers

| Provider na app | Id Supabase | Produto na consola |
| --- | --- | --- |
| Google | `google` | Google Cloud OAuth client (Web) |
| Facebook | `facebook` | Facebook Login |
| LinkedIn | `linkedin_oidc` | Sign In with LinkedIn using OpenID Connect |

Apple (`apple`) não aparece em `/auth` nem em «Associar» no perfil. O bloco `[auth.external.apple]` em `supabase/config.toml` e as variáveis `SUPABASE_AUTH_EXTERNAL_APPLE_*` ficam no repositório para não alterar a configuração partilhada com os outros providers. Não voltar a oferecer o botão sem conta Apple Developer.

Scopes: os mínimos do GoTrue (`openid`, `email`, `profile` onde o provider os usa). Não pedir permissões extra.

## Redirects

Callback que se regista **em cada consola de provider** (não é o URL da app):

`{VITE_SUPABASE_URL}/auth/v1/callback`

URLs para onde o Supabase pode devolver o browser (Authentication → URL Configuration):

| Ambiente | Redirect |
| --- | --- |
| Local | `http://localhost:5173/auth` |
| Local (alternativo) | `http://127.0.0.1:5173/auth` |
| Produção | `https://boleia-cyan.vercel.app/auth` |

O domínio de produção é o de `VITE_APP_URL` / `scripts/update-supabase-auth-urls.mjs`. Não há outro domínio canónico no repositório.

Para actualizar a allow list com um Personal Access Token:

`SUPABASE_ACCESS_TOKEN=... node scripts/update-supabase-auth-urls.mjs`

## Variáveis

Ver `.env.example`. Nomes:

- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
- `SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET`
- `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`
- `SUPABASE_AUTH_EXTERNAL_LINKEDIN_OIDC_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_LINKEDIN_OIDC_SECRET`

O `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` é o client secret **já gerado** (JWT). Team ID, Key ID e o ficheiro `.p8` configuram-se só no Dashboard Supabase. Não os colocar no frontend nem no Git.

## Como criar as credenciais

### Google

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web.
2. Authorized redirect URI: o callback Supabase acima.
3. Copiar Client ID e Client secret para o provider Google no Dashboard Supabase.

### Facebook

1. Meta for Developers → criar app → Facebook Login → Settings.
2. Valid OAuth Redirect URI: o callback Supabase.
3. Client ID = App ID. Client secret = App Secret.
4. O email pode não vir. O provider local tem `email_optional = true`. A app deixa continuar e pede telefone no ecrã de completar perfil.

### Apple (não oferecido na app)

A UI não chama este provider. A secção fica só como registo da configuração de servidor, que não foi removida.

1. Apple Developer → Identifiers → Services ID (este é o Client ID) com Sign in with Apple.
2. Return URL: o callback Supabase.
3. Criar uma Key com Sign in with Apple. No Dashboard Supabase preencher Services ID, Team ID, Key ID e a private key. O GoTrue assina o client secret.
4. A Apple pode devolver um email relay (`@privaterelay.appleid.com`). Guardar esse email. O nome só vem no primeiro login; o trigger `handle_new_user` copia-o para `perfis.nome_completo`.

### LinkedIn

1. LinkedIn Developers → app → Products → «Sign In with LinkedIn using OpenID Connect».
2. Redirect URL: o callback Supabase.
3. No Supabase, provider **LinkedIn (OIDC)** — não o LinkedIn antigo.
4. Client ID e Primary Client Secret.

## Configuração local

`supabase/config.toml` tem Google, Facebook, LinkedIn (OIDC) e o bloco Apple deixado no sítio, com `env(...)` e `enable_manual_linking = true`. Sem as variáveis, o CLI local não consegue falar com o IdP. A app em Vite contra o projecto remoto usa o Dashboard, não este ficheiro. A UI só lista Google, Facebook e LinkedIn.

## Configuração de produção

1. Dashboard → Authentication → Providers → ligar cada um e colar os secrets.
2. Authentication → URL Configuration → acrescentar os redirects da tabela.
3. Activar **Manual linking** para o botão «Associar» no perfil (`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`).
4. Confirmar que o email do projecto continua a exigir confirmação no registo por palavra-passe.

O linking automático do GoTrue associa o provider a uma conta **só se o email do provider vier verificado** e coincidir com um utilizador existente. Email não verificado não liga contas. Se os emails forem diferentes, a pessoa entra com a palavra-passe e usa «Associar» no perfil.

## Conta nova

OAuth → `auth.users` + `auth.identities` → trigger `handle_new_user`.

Se faltar telefone ou papel, `perfis.perfil_completo` fica `false`. A app abre `/auth?mode=completar-perfil` (nome, telefone `+244`, passageiro ou motorista) antes do hub. O nome que o provider mandou vem preenchido. Não se pede outra vez a palavra-passe.

Conta já completa volta ao hub (`/passageiro` ou `/motorista`).

## PWA e telemóvel

O fluxo é redirect de página inteira para HTTPS e volta ao mesmo origin. Funciona em Safari iOS, Chrome Android e desktop, desde que o redirect esteja na allow list.

Num iPhone com a PWA no ecrã inicial, o fornecedor pode abrir o Safari. A sessão regressa se o redirect for `https://boleia-cyan.vercel.app/auth`. Não há URL scheme nativo.

## Troubleshooting

| Sintoma | O que verificar |
| --- | --- |
| «Não foi possível iniciar sessão…» | Provider desligado ou secret errado no Dashboard. Ver a consola do browser e os logs Auth do Supabase. |
| Cancelaste o início de sessão | A pessoa fechou o ecrã do fornecedor (`access_denied`). |
| Sessão expirou | State PKCE perdido (outro browser, storage limpo). Tentar de novo no mesmo browser. |
| Redirect inválido | URL exacto em falta na allow list do Supabase ou no provider. |
| Método já noutra conta | Essa identidade OAuth já está ligada a outro `auth.users`. |
| Já existe conta com este email | Entrar com palavra-passe e associar no perfil. Não ligar por email não verificado. |
| Associar diz que não está activo | Manual linking desligado no Dashboard. |
| Perfil não grava | Migração `oauth_perfil_completo` por aplicar (`perfil_completo`, `tipo_perfil` anulável). |

## O que fica manual

- Criar as apps Google, Facebook e LinkedIn nas consolas e colar secrets no Dashboard.
- Correr o script de redirects (precisa de `SUPABASE_ACCESS_TOKEN`).
- Ligar Manual linking em produção.
- Apple: Team ID, Key ID e `.p8` só no Dashboard.
