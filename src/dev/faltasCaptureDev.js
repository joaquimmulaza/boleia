import { isDevCaptureRoutesEnabled } from '../utils/devCaptureAccess';
import {
  faltasCaptureGetAbsences,
  faltasCaptureGetAgreementsForPassenger,
  faltasCaptureListPagamentos,
} from './faltasCaptureFixtures';

/** @returns {boolean} */
function isFaltasCaptureUrl() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path.includes('/__dev/faltas-capture/')
    || path.includes('/__dev/faltas-capture-liquidado/');
}

/**
 * @returns {{
 *   getAbsences?: (acordoId: string) => Promise<object[]>,
 *   listPagamentosByAcordo?: (acordoId: string) => Promise<object[]>,
 *   getAgreementsForPassenger?: (passengerId: string) => Promise<object[]>,
 * } | null}
 */
export function getFaltasCaptureDevBridge() {
  if (!import.meta.env.DEV || !isDevCaptureRoutesEnabled()) return null;
  if (!isFaltasCaptureUrl()) return null;
  return {
    getAbsences: faltasCaptureGetAbsences,
    listPagamentosByAcordo: faltasCaptureListPagamentos,
    getAgreementsForPassenger: faltasCaptureGetAgreementsForPassenger,
  };
}
