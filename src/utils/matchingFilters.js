import {
  MATCH_TIME_TOLERANCE_MINUTES,
  MATCH_RADIUS_ORIGIN_METERS,
  MATCH_RADIUS_DESTINATION_METERS,
} from './matchingConfig';
import { haversineMeters } from './geo';

/**
 * Converte "HH:MM" (ou "HH:MM:SS") em minutos desde meia-noite.
 * @param {string} timeStr
 * @returns {number}
 */
function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string') {
    throw new Error('Horário inválido.');
  }
  const parts = timeStr.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('Horário inválido.');
  }
  return hours * 60 + minutes;
}

/**
 * Compatibilidade horária: |t1 − t2| ≤ tolerância (minutos).
 * @param {string} timeA - "HH:MM"
 * @param {string} timeB - "HH:MM"
 * @param {number} [toleranceMinutes=MATCH_TIME_TOLERANCE_MINUTES]
 * @returns {boolean}
 */
export function isTimeCompatible(
  timeA,
  timeB,
  toleranceMinutes = MATCH_TIME_TOLERANCE_MINUTES,
) {
  const delta = Math.abs(parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB));
  return delta <= toleranceMinutes;
}

/**
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @param {number} [radiusMeters=MATCH_RADIUS_ORIGIN_METERS]
 * @returns {boolean}
 */
export function isOriginWithinRadius(
  lat1,
  lng1,
  lat2,
  lng2,
  radiusMeters = MATCH_RADIUS_ORIGIN_METERS,
) {
  return haversineMeters(lat1, lng1, lat2, lng2) <= radiusMeters;
}

/**
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @param {number} [radiusMeters=MATCH_RADIUS_DESTINATION_METERS]
 * @returns {boolean}
 */
export function isDestinationWithinRadius(
  lat1,
  lng1,
  lat2,
  lng2,
  radiusMeters = MATCH_RADIUS_DESTINATION_METERS,
) {
  return haversineMeters(lat1, lng1, lat2, lng2) <= radiusMeters;
}

/**
 * Aceite directo vs waitlist: usa N_candidato vs vagas (nunca lotação do preço).
 * @param {number} nCandidato
 * @param {number} vagasDisponiveis
 * @returns {boolean}
 */
export function canAcceptDirectly(nCandidato, vagasDisponiveis) {
  return nCandidato <= vagasDisponiveis;
}

/**
 * Intersecção real de dias da semana (1=Seg … 7=Dom).
 * Ambos os lados têm de ter pelo menos um dia; vazio/ausente → incompatível.
 * Compatível só com intersecção não-vazia. Aceita números ou strings (JSON/BD).
 * @param {number[] | string[] | null | undefined} daysA
 * @param {number[] | string[] | null | undefined} daysB
 * @returns {boolean}
 */
export function isDaysCompatible(daysA, daysB) {
  const a = normalizeDays(daysA);
  const b = normalizeDays(daysB);
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  return a.some((d) => setB.has(d));
}

/**
 * @param {unknown} days
 * @returns {number[]}
 */
function normalizeDays(days) {
  if (!Array.isArray(days)) return [];
  return days
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d));
}

/**
 * OD completo (4 coords finitas) — exigido só para oferta fixa.
 * @param {{
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 * }} side
 * @returns {boolean}
 */
function hasCompleteOd(side) {
  const coords = [
    side?.origin_lat,
    side?.origin_lng,
    side?.destination_lat,
    side?.destination_lng,
  ];
  return coords.every((c) => c != null && c !== '' && Number.isFinite(Number(c)));
}

/**
 * Classifica match oferta ↔ procura/grupo (sem routing).
 * Fixa: tempo + dias + geo OD + capacidade.
 * Flexível: tempo + dias + capacidade (**sem** OD / residência).
 * Dias: intersecção real; vazio/ausente num lado → incompatível.
 *
 * @param {{
 *   oferta: {
 *     departure_time: string,
 *     origin_lat?: number | null,
 *     origin_lng?: number | null,
 *     destination_lat?: number | null,
 *     destination_lng?: number | null,
 *     vagas_disponiveis: number,
 *     flexibilidade_rota?: boolean,
 *     dias_semana?: number[] | null,
 *   },
 *   procura: {
 *     preferred_time: string,
 *     origin_lat?: number | null,
 *     origin_lng?: number | null,
 *     destination_lat?: number | null,
 *     destination_lng?: number | null,
 *     dias_semana?: number[] | null,
 *   },
 *   n_candidato: number,
 * }} input
 * @returns {'direct' | 'waitlist' | 'incompatible'}
 */
export function evaluateMatch({ oferta, procura, n_candidato }) {
  if (!isTimeCompatible(oferta.departure_time, procura.preferred_time)) {
    return 'incompatible';
  }

  if (!isDaysCompatible(oferta.dias_semana, procura.dias_semana)) {
    return 'incompatible';
  }

  const isFlex = Boolean(oferta.flexibilidade_rota);

  if (!isFlex) {
    if (!hasCompleteOd(oferta) || !hasCompleteOd(procura)) {
      return 'incompatible';
    }

    const originOk = isOriginWithinRadius(
      Number(oferta.origin_lat),
      Number(oferta.origin_lng),
      Number(procura.origin_lat),
      Number(procura.origin_lng),
    );
    const destOk = isDestinationWithinRadius(
      Number(oferta.destination_lat),
      Number(oferta.destination_lng),
      Number(procura.destination_lat),
      Number(procura.destination_lng),
    );

    if (!originOk || !destOk) {
      return 'incompatible';
    }
  }

  if (canAcceptDirectly(n_candidato, oferta.vagas_disponiveis)) {
    return 'direct';
  }

  return 'waitlist';
}
