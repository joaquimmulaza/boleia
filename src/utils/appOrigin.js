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
 * URL de redirect para o fluxo «esqueceu a palavra-passe».
 * @returns {string}
 */
export const getPasswordRecoveryRedirectUrl = () =>
  `${getAppOrigin()}/auth?mode=update-password`;
