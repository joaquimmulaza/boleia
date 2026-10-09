import { resolvePostLoginPath } from './authReturnPath.js';

/** Formato UUID (Supabase `uuid`); validação estrita de forma, não de versão RFC. */
const OPEN_ACORDO_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** sessionStorage — só UUID validado, nunca path completo. */
export const AUTH_OPEN_ACORDO_STORAGE_KEY = 'bc_auth_open_acordo_id';

/**
 * @param {string | null | undefined} raw
 * @returns {string | null} UUID normalizado ou null se inválido
 */
export function sanitizeOpenAcordoId(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || !OPEN_ACORDO_UUID_RE.test(trimmed)) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized === NIL_UUID) return null;
  return normalized;
}

/**
 * @param {string} search — com ou sem `?`
 * @returns {string | null}
 */
export function parseOpenAcordoIdFromSearch(search) {
  const qs = search.startsWith('?') ? search.slice(1) : search;
  if (!qs) return null;
  return sanitizeOpenAcordoId(new URLSearchParams(qs).get('openAcordoId'));
}

/**
 * URL de login: só `openAcordoId` (UUID) e flag opcional `sessionEnded=1`.
 * @param {{ openAcordoId?: string | null, sessionEnded?: boolean }} [options]
 * @returns {string}
 */
export function buildAuthUrlWithOpenAcordo({ openAcordoId, sessionEnded = false } = {}) {
  const params = new URLSearchParams();
  const id = sanitizeOpenAcordoId(openAcordoId);
  if (id) params.set('openAcordoId', id);
  if (sessionEnded) params.set('sessionEnded', '1');
  const qs = params.toString();
  return qs ? `/auth?${qs}` : '/auth';
}

/**
 * Destino pós-login quando há `openAcordoId` na query (prioridade sobre `next`).
 * ID inválido → `/acordos` (sem deep link).
 * @param {string | null | undefined} nextRaw
 * @param {string | null | undefined} openAcordoIdRaw
 * @param {string | null | undefined} tipoPerfil
 * @returns {string}
 */
export function resolvePostLoginPathWithOpenAcordo(nextRaw, openAcordoIdRaw, tipoPerfil) {
  if (openAcordoIdRaw != null && String(openAcordoIdRaw).trim() !== '') {
    const id = sanitizeOpenAcordoId(openAcordoIdRaw);
    return id ? `/acordos?openAcordoId=${encodeURIComponent(id)}` : '/acordos';
  }
  return resolvePostLoginPath(nextRaw, tipoPerfil);
}

/**
 * @param {string | null | undefined} openAcordoIdRaw
 * @returns {string}
 */
export function buildAcordosPathForOpenAcordo(openAcordoIdRaw) {
  const id = sanitizeOpenAcordoId(openAcordoIdRaw);
  return id ? `/acordos?openAcordoId=${encodeURIComponent(id)}` : '/acordos';
}
