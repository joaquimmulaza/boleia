/**
 * Origem pública da app para redirects Supabase Auth.
 * Preferir VITE_APP_URL (produção canónica) sobre window.location.origin
 * para evitar emails com domínios Vercel protegidos por SSO.
 * @returns {string}
 */
export const getAppOrigin = () => {
  const configured = import.meta.env.VITE_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

/**
 * Origem do browser actual (ignora VITE_APP_URL).
 * Usada no registo para o link de confirmação bater certo com o domínio onde a pessoa se inscreveu.
 * @returns {string}
 */
export const getEmailConfirmRedirectUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

/**
 * URL de redirect para o fluxo «esqueceu a palavra-passe».
 * @returns {string}
 */
export const getPasswordRecoveryRedirectUrl = () =>
  `${getAppOrigin()}/auth?mode=update-password`;

/**
 * URL para onde o Supabase devolve o browser depois do OAuth.
 * O callback do provider é o do GoTrue, não este endereço.
 * @returns {string}
 */
export const getOAuthRedirectUrl = () => `${getAppOrigin()}/auth`;
