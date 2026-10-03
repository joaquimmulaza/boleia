# Remover Apple Sign-In da UI

## Problema
Não há conta paga de Apple Developer. O ecrã `/auth` e o perfil ainda oferecem Continuar com Apple / Associar Apple (`signInWithOAuth` / `linkIdentity` com `provider: 'apple'`). Google, Facebook e LinkedIn (OIDC) estão em produção e ficam iguais.

## Onde
- Lista canónica: `src/utils/oauth.js` (`OAUTH_PROVIDERS`).
- Botões: `src/components/SocialAuthButtons.jsx` (mapeia a lista).
- Perfil: `src/components/LoginMethodsSection.jsx` (Associar / Desassociar a partir da mesma lista).
- `startOAuthSignIn` recusa um id que não esteja na lista, para o cliente não chamar `signInWithOAuth({ provider: 'apple' })`.

## Fora
- Dashboard Supabase, `supabase/config.toml` e `.env.example` (bloco Apple). Remover o bloco local arriscava o ficheiro partilhado com os outros providers. A configuração morta fica.
- `apple-touch-icon` / meta PWA em `index.html`.
- Segredos. Nada de credenciais no git.

## Design
Sem ecrã novo. O cartão de `/auth` mantém os botões de contorno (`h-14`, «Continuar com {Provider}») na ordem Google, Facebook, LinkedIn. O ícone da Apple sai. Estados pending, erro e palavra-passe inalterados.

## AC
- `/auth` (Entrar e Criar Conta) não tem «Continuar com Apple».
- Perfil não oferece Associar Apple.
- Google, Facebook e LinkedIn continuam e chamam o mesmo `signInWithOAuth` / `linkIdentity`.
- Testes OAuth verdes; lint limpo nos ficheiros tocados.
