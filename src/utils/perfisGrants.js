/**
 * Colunas que `authenticated` pode ler em `public.perfis` (GRANT SELECT).
 * Fonte: `supabase/migrations/20261004073111_perfis_colunas_sensiveis_select.sql`
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
 * Sessão / AuthContext — sem `iban_titular` (só página Perfil; evita 42501 em `/acordos`).
 * @type {string}
 */
export const PERFIL_COLUNAS_SELECT_SESSAO = [
  'id',
  'nome_completo',
  'tipo_perfil',
  'created_at',
  'onboarding_completed',
  'perfil_completo',
].join(', ');

/** Leitura completa do próprio perfil (`getProfile` / `updateProfile` RETURNING). */
export const PERFIL_COLUNAS_SELECT = PERFIL_COLUNAS_GRANT_SELECT.join(', ');

/** Embed seguro noutras tabelas — só `nome_completo` (PK incluída pelo PostgREST). */
export const PERFIS_EMBED_NOME_COMPLETO = 'perfis(nome_completo)';
