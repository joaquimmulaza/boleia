/**
 * Colunas que `authenticated` pode ler em `public.perfis` (GRANT SELECT).
 * Fonte: migrações com GRANT SELECT (…) ON TABLE public.perfis.
 * Sem `*` — PostgREST devolve 42501 se pedir coluna não grantada.
 *
 * @type {readonly string[]}
 */
export const PERFIL_COLUNAS_GRANT_SELECT = [
  'id',
  'nome_completo',
  'tipo_perfil',
  'created_at',
  'onboarding_completed',
  'iban_titular',
  'perfil_completo',
];

/**
 * Colunas pedidas pelo AuthContext em `fetchProfile`.
 * PR segurança futuro: remover `'iban_titular'` desta lista (uma linha).
 *
 * @type {readonly string[]}
 */
export const PERFIL_COLUNAS_AUTH_CONTEXT = [
  'id',
  'nome_completo',
  'tipo_perfil',
  'created_at',
  'onboarding_completed',
  'iban_titular',
  'perfil_completo',
];

export const PERFIL_COLUNAS_AUTH_CONTEXT_SELECT = PERFIL_COLUNAS_AUTH_CONTEXT.join(', ');

/** Leitura completa do próprio perfil (`getProfile` / `updateProfile` RETURNING). */
export const PERFIL_COLUNAS_SELECT = PERFIL_COLUNAS_GRANT_SELECT.join(', ');

/** Embed seguro noutras tabelas — só `nome_completo` (PK incluída pelo PostgREST). */
export const PERFIS_EMBED_NOME_COMPLETO = 'perfis(nome_completo)';
