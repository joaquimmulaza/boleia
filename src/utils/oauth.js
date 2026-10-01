/** @typedef {'google' | 'apple' | 'facebook' | 'linkedin_oidc'} OAuthProviderId */

export const OAUTH_PENDING_KEY = 'bc_oauth_pending';
export const OAUTH_PROVIDER_KEY = 'bc_oauth_provider';
export const OAUTH_MESSAGE_KEY = 'bc_oauth_message';

/** Ordem visual: Google, Apple, Facebook, LinkedIn. */
export const OAUTH_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin_oidc', label: 'LinkedIn' },
];

/**
 * @param {string | null | undefined} providerId
 * @returns {string}
 */
export function getProviderLabel(providerId) {
  const found = OAUTH_PROVIDERS.find((item) => item.id === providerId);
  return found?.label || 'o fornecedor';
}

/**
 * @param {string | null | undefined} providerId
 * @returns {providerId is OAuthProviderId}
 */
export function isOAuthProvider(providerId) {
  return OAUTH_PROVIDERS.some((item) => item.id === providerId);
}

/**
 * Perfil criado por OAuth ainda sem telefone ou papel.
 * `undefined` (contas antigas / testes) não bloqueia.
 * @param {{ perfil_completo?: boolean } | null | undefined} profile
 * @returns {boolean}
 */
export function needsProfileSetup(profile) {
  return profile?.perfil_completo === false;
}

/**
 * Regra de linking alinhada ao GoTrue: só email verificado associa conta existente.
 * A execução é no servidor; esta função documenta e testa a decisão.
 * @param {{ emailVerified?: boolean, existingUserWithEmail?: boolean, identityAlreadyLinked?: boolean }} input
 * @returns {'reject_duplicate_identity' | 'link_existing' | 'do_not_link' | 'create_user'}
 */
export function decideAccountLink({
  emailVerified = false,
  existingUserWithEmail = false,
  identityAlreadyLinked = false,
} = {}) {
  if (identityAlreadyLinked) return 'reject_duplicate_identity';
  if (existingUserWithEmail && emailVerified) return 'link_existing';
  if (existingUserWithEmail && !emailVerified) return 'do_not_link';
  return 'create_user';
}

/**
 * @param {Array<{ provider?: string }> | null | undefined} identities
 * @param {string} providerId
 * @returns {boolean}
 */
export function isProviderLinked(identities, providerId) {
  return Array.isArray(identities) && identities.some((item) => item?.provider === providerId);
}

/**
 * Não desassociar a última forma de entrar, nem identidades que não são OAuth social.
 * @param {Array<{ provider?: string }> | null | undefined} identities
 * @param {{ provider?: string } | null | undefined} identity
 * @returns {boolean}
 */
export function canUnlinkIdentity(identities, identity) {
  if (!Array.isArray(identities) || identities.length < 2) return false;
  return isOAuthProvider(identity?.provider);
}

/**
 * @param {URLSearchParams | { get: (key: string) => string | null }} params
 * @returns {{ error: string, description: string } | null}
 */
export function parseOAuthCallback(params) {
  const error = params?.get?.('error');
  if (!error) return null;
  const description = params.get('error_description') || params.get('error_code') || '';
  return { error, description };
}

/**
 * Mensagem PT-PT. Nunca devolve a descrição crua (pode ter tokens).
 * @param {{ error?: string, errorCode?: string, providerLabel?: string }} input
 * @returns {string}
 */
export function mapOAuthError({ error = '', errorCode = '', providerLabel = 'o fornecedor' } = {}) {
  const code = `${error} ${errorCode}`.toLowerCase();
  if (code.includes('access_denied') || code.includes('cancel')) {
    return `Cancelaste o início de sessão com ${providerLabel}.`;
  }
  if (
    code.includes('bad_oauth_state')
    || code.includes('flow_state')
    || code.includes('invalid_state')
    || code.includes('csrf')
  ) {
    return 'A sessão de início de sessão expirou. Tenta novamente.';
  }
  if (code.includes('redirect') || code.includes('invalid_request') || code.includes('callback')) {
    return 'Não foi possível concluir o redireccionamento. Tenta novamente.';
  }
  if (
    (code.includes('identity') && (code.includes('exist') || code.includes('already') || code.includes('linked')))
    || code.includes('identity_already_exists')
  ) {
    return 'Este método já está associado a outra conta.';
  }
  if (code.includes('manual linking') || code.includes('manual_linking')) {
    return 'A associação de contas ainda não está activa neste ambiente.';
  }
  if (code.includes('already registered') || (code.includes('email') && code.includes('exist'))) {
    return 'Já existe uma conta com este email. Entra com a palavra-passe e associa o método no perfil.';
  }
  return `Não foi possível iniciar sessão com ${providerLabel}. Tenta novamente.`;
}

/**
 * @param {{ auth: { signInWithOAuth: Function } }} client
 * @param {OAuthProviderId} provider
 * @param {{ tipoPerfil?: string, redirectTo: string }} options
 */
export async function startOAuthSignIn(client, provider, { tipoPerfil, redirectTo } = {}) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
    sessionStorage.setItem(OAUTH_PROVIDER_KEY, provider);
  }

  const data = {};
  if (tipoPerfil === 'Passageiro' || tipoPerfil === 'Motorista') {
    data.tipo_perfil = tipoPerfil;
  }

  const result = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: false,
      ...(Object.keys(data).length > 0 ? { data } : {}),
    },
  });

  if (result?.error && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
  }

  return result;
}
