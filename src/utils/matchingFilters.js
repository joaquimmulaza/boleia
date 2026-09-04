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
 * Classifica match oferta ↔ procura/grupo (sem routing).
 * @param {{
 *   oferta: {
 *     departure_time: string,
 *     origin_lat: number,
 *     origin_lng: number,
 *     destination_lat: number,
 *     destination_lng: number,
 *     vagas_disponiveis: number,
 *   },
 *   procura: {
 *     preferred_time: string,
 *     origin_lat: number,
 *     origin_lng: number,
 *     destination_lat: number,
 *     destination_lng: number,
 *   },
 *   n_candidato: number,
 * }} input
 * @returns {'direct' | 'waitlist' | 'incompatible'}
 */
export function evaluateMatch({ oferta, procura, n_candidato }) {
  if (!isTimeCompatible(oferta.departure_time, procura.preferred_time)) {
    return 'incompatible';
  }

  const originOk = isOriginWithinRadius(
    oferta.origin_lat,
    oferta.origin_lng,
    procura.origin_lat,
    procura.origin_lng,
  );
  const destOk = isDestinationWithinRadius(
    oferta.destination_lat,
    oferta.destination_lng,
    procura.destination_lat,
    procura.destination_lng,
  );

  if (!originOk || !destOk) {
    return 'incompatible';
  }

  if (canAcceptDirectly(n_candidato, oferta.vagas_disponiveis)) {
    return 'direct';
  }

  return 'waitlist';
}
