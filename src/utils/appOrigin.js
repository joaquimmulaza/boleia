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
 * Redirect pós-confirmação de email no registo (ignora VITE_APP_URL).
 * Usa a origem do browser + `/auth` para bater com a allow-list GoTrue
 * (`…/auth`, não só a origem nua).
 * @returns {string}
 */
export const getEmailConfirmRedirectUrl = () => {
  if (typeof window !== 'undefined') return `${window.location.origin}/auth`;
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
